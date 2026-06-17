<?php
/**
 * CHURCH PORTAL REST API
 * Single-file PHP 8+ & SQLite Backend API
 * Automatically bootstraps tables if absent.
 */

declare(strict_types=1);

// Configure CORS and JSON Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// -------------------------------------------------------------
// 1. DATABASE & TABLE CONFIGURATION
// -------------------------------------------------------------
$dbFile = __DIR__ . '/database.sqlite';
try {
    $pdo = new PDO("sqlite:" . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    
    // Enable SQLite foreign keys
    $pdo->exec("PRAGMA foreign_keys = ON;");
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed", "details" => $e->getMessage()]);
    exit();
}

/**
 * Bootstrap and seed database schemas on first run
 */
function bootstrapDatabase(PDO $pdo): void {
    // 1. Admins Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL
    );");

    // 2. Members Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        whatsAppNumber TEXT UNIQUE NOT NULL,
        lastAttendanceDate TEXT,
        currentStatus TEXT,
        attendedAtTime TEXT,
        gender TEXT,
        notes TEXT,
        messageSent INTEGER DEFAULT 0,
        messageSentDate TEXT,
        messageDeliveryStatus TEXT
    );");

    // 3. Workers Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS workers (
        id TEXT PRIMARY KEY,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        whatsAppNumber TEXT UNIQUE NOT NULL,
        lastAttendanceDate TEXT,
        currentStatus TEXT,
        attendedAtTime TEXT,
        gender TEXT,
        notes TEXT,
        messageSent INTEGER DEFAULT 0,
        messageSentDate TEXT,
        messageDeliveryStatus TEXT
    );");

    // 4. Attendance Transaction Log
    $pdo->exec("CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        personId TEXT NOT NULL,
        personType TEXT NOT NULL,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        whatsAppNumber TEXT,
        gender TEXT,
        timestamp TEXT NOT NULL
    );");

    // 5. Sundays Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS sundays (
        id TEXT PRIMARY KEY,
        date TEXT UNIQUE NOT NULL
    );");

    // 6. Settings Key-Value Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        val TEXT NOT NULL
    );");

    // 7. WhatsApp Logs Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS whatsapp_logs (
        id TEXT PRIMARY KEY,
        personId TEXT NOT NULL,
        personType TEXT NOT NULL,
        whatsAppNumber TEXT NOT NULL,
        messageContent TEXT NOT NULL,
        deliveryStatus TEXT NOT NULL,
        sentAt TEXT NOT NULL
    );");

    // 8. Audit Logs Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        adminId TEXT NOT NULL,
        adminEmail TEXT NOT NULL,
        action TEXT NOT NULL,
        timestamp TEXT NOT NULL
    );");

    // Seed default first Super Admin if admins table is empty
    $countStmt = $pdo->query("SELECT COUNT(*) FROM admins");
    if ($countStmt && $countStmt->fetchColumn() == 0) {
        $stmt = $pdo->prepare("INSERT INTO admins (id, email, role) VALUES (?, ?, ?)");
        $stmt->execute([
            "sa_" . bin2hex(random_bytes(4)),
            "fidelisemus@gmail.com",
            "Super Admin"
        ]);
    }

    // Seed default active Subscription state in Settings
    $subCheck = $pdo->query("SELECT COUNT(*) FROM settings WHERE id = 'subscription_status'");
    if ($subCheck && $subCheck->fetchColumn() == 0) {
        $act = date('c');
        $exp = date('c', strtotime('+30 days'));
        $subData = [
            "id" => "subscription_status",
            "planType" => "Monthly",
            "activationDate" => $act,
            "expiryDate" => $exp,
            "licenseKey" => "CHM-ACTIVE-MONTHLY-882"
        ];
        $stmt = $pdo->prepare("INSERT INTO settings (id, val) VALUES ('subscription_status', ?)");
        $stmt->execute([json_encode($subData)]);
    }

    // Seed default WhatsApp Configuration in Settings
    $waCheck = $pdo->query("SELECT COUNT(*) FROM settings WHERE id = 'whatsapp_config'");
    if ($waCheck && $waCheck->fetchColumn() == 0) {
        $waData = [
            "churchWhatsAppNumber" => "+2349029957453",
            "phoneNumberId" => "",
            "accessToken" => "",
            "businessAccountId" => "",
            "memberTemplate" => "Happy Sunday {Name} and hope all is well. We didn't see you in church today. Hope to see you next Sunday, and please feel free to reach out to the church pastor if you need any assistance. God bless you.",
            "workerTemplate" => "Dearest worker {Name}, we missed your valuable service in church today as part of our core team. We hope everything is well. Please reach out to your department leader if you need any support. See you next Sunday. God bless your labor of love!"
        ];
        $stmt = $pdo->prepare("INSERT INTO settings (id, val) VALUES ('whatsapp_config', ?)");
        $stmt->execute([json_encode($waData)]);
    }
}

/**
 * Runs a schema check upon startup to ensure all necessary tables for attendance
 * and subscription tracking exist in the SQLite database.
 */
function checkSchema(PDO $pdo): void {
    $requiredTables = [
        'admins',
        'members',
        'workers',
        'attendance',
        'sundays',
        'settings',
        'whatsapp_logs',
        'audit_logs'
    ];
    
    foreach ($requiredTables as $tableName) {
        $stmt = $pdo->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = :name");
        $stmt->execute([':name' => $tableName]);
        if (!$stmt->fetch()) {
            error_log("SQLite Schema Check: Table '{$tableName}' is missing. Re-bootstrapping database.");
            bootstrapDatabase($pdo);
            return;
        }
    }
    error_log("SQLite Schema Check: All database tables are present and verified.");
}

bootstrapDatabase($pdo);
checkSchema($pdo);

// -------------------------------------------------------------
// 2. REQUEST PARSING & ROUTING UTILITIES
// -------------------------------------------------------------
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Strip potential query parameters
if (($pos = strpos($requestUri, '?')) !== false) {
    $requestUri = substr($requestUri, 0, $pos);
}

// Normalize paths (assuming api.php can be visited at /api.php/v1/resource or via rewrite as /api/resource)
$basePath = '';
if (str_contains($requestUri, 'api.php')) {
    $basePath = substr($requestUri, 0, strpos($requestUri, 'api.php') + 7);
} elseif (str_starts_with($requestUri, '/api')) {
    $basePath = '/api';
}
$route = substr($requestUri, strlen($basePath));

// Helper: Read JSON payload
function getJsonPayload(): array {
    $rawInput = file_get_contents('php://input');
    if (empty($rawInput)) {
        return [];
    }
    return json_decode($rawInput, true) ?? [];
}

// Helper: GUID generator
function generateGuid(): string {
    return bin2hex(random_bytes(4)) . '-' . bin2hex(random_bytes(2)) . '-' . bin2hex(random_bytes(2)) . '-' . bin2hex(random_bytes(8));
}

// Helper: Audit logger
function logAudit(PDO $pdo, string $adminId, string $adminEmail, string $action): void {
    $stmt = $pdo->prepare("INSERT INTO audit_logs (id, adminId, adminEmail, action, timestamp) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([generateGuid(), $adminId, $adminEmail, $action, date('c')]);
}

// Helper: Calc Sunday date
function getSundayOfDate(string $dateStr): string {
    $time = strtotime($dateStr);
    $dayOfWeek = (int)date('w', $time);
    if ($dayOfWeek === 0) {
        return date('Y-m-d', $time);
    }
    // Advance to next Sunday
    return date('Y-m-d', strtotime('next Sunday', $time));
}

// -------------------------------------------------------------
// 3. ROUTE REGISTRY AND ENDPOINT RESOLUTION
// -------------------------------------------------------------

// Match /auth/login
if ($route === '/auth/login' && $requestMethod === 'POST') {
    $payload = getJsonPayload();
    $email = trim($payload['email'] ?? '');
    $password = $payload['password'] ?? '';

    if (empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(["error" => "Email and password are required credentials."]);
        exit();
    }

    // Standard system password from Environment variable or fallback
    $envPassword = getenv('ADMIN_PASSWORD') ? trim(getenv('ADMIN_PASSWORD')) : '';
    $isValid = ($envPassword && $password === $envPassword) || $password === 'admin123';
    if (!$isValid) {
        http_response_code(401);
        echo json_encode(["error" => "Invalid access credentials."]);
        exit();
    }

    $emailLower = strtolower($email);
    
    // Auto-bootstrap fidelisemus@gmail.com
    if ($emailLower === "fidelisemus@gmail.com") {
        $stmt = $pdo->prepare("SELECT * FROM admins WHERE email = ?");
        $stmt->execute([$emailLower]);
        if (!$stmt->fetch()) {
            $pdo->prepare("INSERT INTO admins (id, email, role) VALUES (?, ?, 'Super Admin')")
                ->execute([generateGuid(), $emailLower]);
        }
    }

    $stmt = $pdo->prepare("SELECT * FROM admins WHERE email = ?");
    $stmt->execute([$emailLower]);
    $admin = $stmt->fetch();

    if (!$admin) {
        http_response_code(403);
        echo json_encode(["error" => "Access Denied. You are not registered as an authorized administrator."]);
        exit();
    }

    // Verify Subscription status
    $subStmt = $pdo->query("SELECT val FROM settings WHERE id = 'subscription_status'");
    $subWrapper = $subStmt->fetch();
    if ($subWrapper) {
        $sub = json_decode($subWrapper['val'], true);
        $isExpired = strtotime($sub['expiryDate'] ?? date('c')) < time();
        if ($isExpired && $admin['role'] !== 'Super Admin') {
            http_response_code(402);
            echo json_encode([
                "error" => "SUBSCRIPTION_EXPIRED",
                "message" => "Your subscription plan has expired. Please contact your Super Admin to apply a license key and restore system access!"
            ]);
            exit();
        }
    }

    echo json_encode([
        "id" => $admin['id'],
        "email" => $admin['email'],
        "role" => $admin['role']
    ]);
    exit();
}

// Match /subscription/info
if ($route === '/subscription/info' && $requestMethod === 'GET') {
    $stmt = $pdo->query("SELECT val FROM settings WHERE id = 'subscription_status'");
    $row = $stmt->fetch();
    $sub = json_decode($row['val'], true);
    $sub['isExpired'] = strtotime($sub['expiryDate']) < time();
    echo json_encode($sub);
    exit();
}

// Match /subscription/apply
if ($route === '/subscription/apply' && $requestMethod === 'POST') {
    $payload = getJsonPayload();
    $planType = $payload['planType'] ?? 'Monthly';
    $adminId = $payload['adminId'] ?? 'system';
    $adminEmail = $payload['adminEmail'] ?? 'superadmin@church.org';

    if (!in_array($planType, ['Monthly', 'Quarterly', 'Yearly'])) {
        http_response_code(400);
        echo json_encode(["error" => "Invalid subscription plan selected."]);
        exit();
    }

    // Verify administrator is Super Admin if provided
    if ($adminId !== 'system') {
        $stmt = $pdo->prepare("SELECT * FROM admins WHERE id = ?");
        $stmt->execute([$adminId]);
        $adm = $stmt->fetch();
        if (!$adm || $adm['role'] !== 'Super Admin') {
            http_response_code(403);
            echo json_encode(["error" => "Access Denied: Only Super Administrators can apply subscription license modifications."]);
            exit();
        }
    }

    $daysToAdd = 30;
    if ($planType === 'Quarterly') {
        $daysToAdd = 90;
    } elseif ($planType === 'Yearly') {
        $daysToAdd = 365;
    }

    $act = date('c');
    $exp = date('c', strtotime("+$daysToAdd days"));
    $key = "CH-" . strtoupper(substr($planType, 0, 3)) . "-LIC-" . rand(1000, 9999);

    $subData = [
        "id" => "subscription_status",
        "planType" => $planType,
        "activationDate" => $act,
        "expiryDate" => $exp,
        "licenseKey" => $key
    ];

    $stmt = $pdo->prepare("INSERT INTO settings (id, val) VALUES ('subscription_status', ?) ON CONFLICT(id) DO UPDATE SET val = excluded.val");
    $stmt->execute([json_encode($subData)]);

    logAudit($pdo, $adminId, $adminEmail, "Applied subscription license: {$planType} plan (keys generated: {$key})");

    $subData['isExpired'] = false;
    echo json_encode([
        "success" => true,
        "subscription" => $subData
    ]);
    exit();
}

// Match /attendance/submit (Public checkout client form)
if ($route === '/attendance/submit' && $requestMethod === 'POST') {
    $payload = getJsonPayload();
    $firstName = trim($payload['firstName'] ?? '');
    $lastName = trim($payload['lastName'] ?? '');
    $whatsAppNumber = trim($payload['whatsAppNumber'] ?? '');
    $attendeeType = $payload['attendeeType'] ?? ''; // member / worker
    $submissionDate = $payload['submissionDate'] ?? '';
    $gender = $payload['gender'] ?? '';

    if (empty($firstName) || empty($lastName) || empty($whatsAppNumber) || empty($attendeeType)) {
        http_response_code(400);
        echo json_encode(["error" => "Missing required fields (firstName, lastName, whatsAppNumber, attendeeType)"]);
        exit();
    }

    $dateUsed = !empty($submissionDate) ? $submissionDate : getSundayOfDate(date('Y-m-d'));
    $collectionTable = ($attendeeType === 'worker') ? 'workers' : 'members';

    // Format phone
    if (!str_starts_with($whatsAppNumber, '+') && ctype_digit($whatsAppNumber)) {
        $whatsAppNumber = '+' . $whatsAppNumber;
    }

    // Check duplicate directory profile
    $stmt = $pdo->prepare("SELECT * FROM {$collectionTable} WHERE whatsAppNumber = ?");
    $stmt->execute([$whatsAppNumber]);
    $existing = $stmt->fetch();

    $personId = '';
    if (!$existing) {
        $personId = generateGuid();
        $ins = $pdo->prepare("INSERT INTO {$collectionTable} (id, firstName, lastName, whatsAppNumber, lastAttendanceDate, currentStatus, attendedAtTime, gender) VALUES (?, ?, ?, ?, ?, 'Present', ?, ?)");
        $ins->execute([
            $personId, $firstName, $lastName, $whatsAppNumber, $dateUsed, date('c'), $gender
        ]);
    } else {
        $personId = $existing['id'];
        $upd = $pdo->prepare("UPDATE {$collectionTable} SET firstName = ?, lastName = ?, lastAttendanceDate = ?, currentStatus = 'Present', attendedAtTime = ?, gender = ? WHERE id = ?");
        $upd->execute([
            $firstName, $lastName, $dateUsed, date('c'), $gender ?: $existing['gender'], $personId
        ]);
    }

    // Check duplicate roster record for today
    $checkDup = $pdo->prepare("SELECT * FROM attendance WHERE date = ? AND personId = ?");
    $checkDup->execute([$dateUsed, $personId]);
    if (!$checkDup->fetch()) {
        $insAtt = $pdo->prepare("INSERT INTO attendance (id, date, personId, personType, firstName, lastName, whatsAppNumber, gender, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $insAtt->execute([
            generateGuid(), $dateUsed, $personId, $attendeeType, $firstName, $lastName, $whatsAppNumber, $gender, date('c')
        ]);
    }

    echo json_encode(["message" => "God Bless you. Enjoy the rest of the service in God's presence."]);
    exit();
}

// Match /attendance/toggle (Admin quick flip status)
if ($route === '/attendance/toggle' && $requestMethod === 'POST') {
    $payload = getJsonPayload();
    $personId = $payload['personId'] ?? '';
    $personType = $payload['personType'] ?? ''; // member / worker
    $targetDate = $payload['targetDate'] ?? '';
    $adminId = $payload['adminId'] ?? '';
    $adminEmail = $payload['adminEmail'] ?? '';

    if (empty($personId) || empty($personType) || empty($targetDate)) {
        http_response_code(400);
        echo json_encode(["error" => "Missing required toggle properties."]);
        exit();
    }

    $collectionTable = ($personType === 'worker') ? 'workers' : 'members';

    $stmt = $pdo->prepare("SELECT * FROM {$collectionTable} WHERE id = ?");
    $stmt->execute([$personId]);
    $person = $stmt->fetch();

    if (!$person) {
        http_response_code(404);
        echo json_encode(["error" => "Person profile lookup failed"]);
        exit();
    }

    // Toggle active transaction
    $checkAtt = $pdo->prepare("SELECT * FROM attendance WHERE date = ? AND personId = ?");
    $checkAtt->execute([$targetDate, $personId]);
    $record = $checkAtt->fetch();

    $newStatus = 'Absent';
    if (!$record) {
        $newStatus = 'Present';
        // Incur roster check-in
        $ins = $pdo->prepare("INSERT INTO attendance (id, date, personId, personType, firstName, lastName, whatsAppNumber, gender, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $ins->execute([
            generateGuid(), $targetDate, $personId, $personType, $person['firstName'], $person['lastName'], $person['whatsAppNumber'], $person['gender'], date('c')
        ]);

        // Mark on profile
        $upd = $pdo->prepare("UPDATE {$collectionTable} SET currentStatus = 'Present', lastAttendanceDate = ? WHERE id = ?");
        $upd->execute([$targetDate, $personId]);
    } else {
        // Remove from roster
        $del = $pdo->prepare("DELETE FROM attendance WHERE date = ? AND personId = ?");
        $del->execute([$targetDate, $personId]);

        // Flip to Absent on profile
        $upd = $pdo->prepare("UPDATE {$collectionTable} SET currentStatus = 'Absent' WHERE id = ?");
        $upd->execute([$personId]);
    }

    logAudit($pdo, $adminId ?: 'admin', $adminEmail ?: 'admin@church.org', "Toggled attendance status: marked {$person['firstName']} as {$newStatus} for {$targetDate}");

    echo json_encode(["success" => true, "newStatus" => $newStatus]);
    exit();
}

// Match /dashboard/stats
if ($route === '/dashboard/stats' && $requestMethod === 'GET') {
    $todaySunday = getSundayOfDate(date('Y-m-d'));

    // Count rosters
    $membersCount = (int)$pdo->query("SELECT COUNT(*) FROM members")->fetchColumn();
    $workersCount = (int)$pdo->query("SELECT COUNT(*) FROM workers")->fetchColumn();

    // Attendance breakdown for today
    $attendanceStmt = $pdo->prepare("SELECT * FROM attendance WHERE date = ?");
    $attendanceStmt->execute([$todaySunday]);
    $attendance = $attendanceStmt->fetchAll();

    $membersPresent = 0;
    $workersPresent = 0;
    $malePresent = 0;
    $femalePresent = 0;

    foreach ($attendance as $rec) {
        if ($rec['personType'] === 'worker') {
            $workersPresent++;
        } else {
            $membersPresent++;
        }

        if ($rec['gender'] === 'Male') {
            $malePresent++;
        } elseif ($rec['gender'] === 'Female') {
            $femalePresent++;
        }
    }

    // Demographics totals
    $totalMale = (int)$pdo->query("SELECT COUNT(*) FROM members WHERE gender = 'Male'")->fetchColumn() +
                  (int)$pdo->query("SELECT COUNT(*) FROM workers WHERE gender = 'Male'")->fetchColumn();
    $totalFemale = (int)$pdo->query("SELECT COUNT(*) FROM members WHERE gender = 'Female'")->fetchColumn() +
                    (int)$pdo->query("SELECT COUNT(*) FROM workers WHERE gender = 'Female'")->fetchColumn();

    $absentMembers = max(0, $membersCount - $membersPresent);
    $absentWorkers = max(0, $workersCount - $workersPresent);

    $waMessageCount = (int)$pdo->query("SELECT COUNT(*) FROM whatsapp_logs")->fetchColumn();

    // WHATSAPP Delivery statistics
    $sent = (int)$pdo->query("SELECT COUNT(*) FROM whatsapp_logs WHERE deliveryStatus = 'Sent'")->fetchColumn();
    $delivered = (int)$pdo->query("SELECT COUNT(*) FROM whatsapp_logs WHERE deliveryStatus = 'Delivered'")->fetchColumn();
    $read = (int)$pdo->query("SELECT COUNT(*) FROM whatsapp_logs WHERE deliveryStatus = 'Read'")->fetchColumn();
    $failed = (int)$pdo->query("SELECT COUNT(*) FROM whatsapp_logs WHERE deliveryStatus = 'Failed'")->fetchColumn();

    echo json_encode([
        "totalMembers" => $membersCount,
        "totalWorkers" => $workersCount,
        "membersPresent" => $membersPresent,
        "workersPresent" => $workersPresent,
        "absentMembers" => $absentMembers,
        "absentWorkers" => $absentWorkers,
        "totalMale" => $totalMale,
        "totalFemale" => $totalFemale,
        "malePresent" => $malePresent,
        "femalePresent" => $femalePresent,
        "totalWAMessages" => $waMessageCount,
        "deliveryStats" => [
            "Sent" => $sent,
            "Delivered" => $delivered,
            "Read" => $read,
            "Failed" => $failed
        ],
        "todaySunday" => $todaySunday
    ]);
    exit();
}

// -------------------------------------------------------------
// 4. RESOURCE CRUD PATTERN (Members, Workers, Sundays, Admins)
// -------------------------------------------------------------

// HELPER: CRUD resource dispatcher
function handleResourceCrud(PDO $pdo, string $table, string $route, string $method): void {
    $trimmedRoute = trim($route, '/');
    $parts = explode('/', $trimmedRoute);
    $resourceName = $parts[0] ?? '';
    $id = $parts[1] ?? '';

    // GET /resource
    if (empty($id) && $method === 'GET') {
        $stmt = $pdo->query("SELECT * FROM {$table}");
        echo json_encode($stmt->fetchAll());
        exit();
    }

    // GET /resource/{id}
    if (!empty($id) && $method === 'GET') {
        $stmt = $pdo->prepare("SELECT * FROM {$table} WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            http_response_code(404);
            echo json_encode(["error" => "Resource not found"]);
            exit();
        }
        echo json_encode($row);
        exit();
    }

    // DELETE /resource/{id}
    if (!empty($id) && $method === 'DELETE') {
        $stmt = $pdo->prepare("DELETE FROM {$table} WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(["success" => true]);
        exit();
    }

    // POST /resource
    if (empty($id) && $method === 'POST') {
        $payload = getJsonPayload();
        if ($table === 'members' || $table === 'workers') {
            if (empty($payload['firstName']) || empty($payload['lastName']) || empty($payload['whatsAppNumber'])) {
                http_response_code(400);
                echo json_encode(["error" => "Missing fields"]);
                exit();
            }
            $newId = generateGuid();
            $stmt = $pdo->prepare("INSERT INTO {$table} (id, firstName, lastName, whatsAppNumber, lastAttendanceDate, currentStatus, notes, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $newId,
                trim($payload['firstName']),
                trim($payload['lastName']),
                trim($payload['whatsAppNumber']),
                $payload['lastAttendanceDate'] ?? '',
                $payload['currentStatus'] ?? 'Absent',
                $payload['notes'] ?? '',
                $payload['gender'] ?? ''
            ]);
            $payload['id'] = $newId;
            echo json_encode($payload);
            exit();
        }
        
        if ($table === 'sundays') {
            if (empty($payload['date'])) {
                http_response_code(400);
                echo json_encode(["error" => "Missing date parameter"]);
                exit();
            }
            $newId = generateGuid();
            $stmt = $pdo->prepare("INSERT INTO sundays (id, date) VALUES (?, ?)");
            $stmt->execute([$newId, $payload['date']]);
            echo json_encode(["id" => $newId, "date" => $payload['date']]);
            exit();
        }

        if ($table === 'admins') {
            if (empty($payload['email']) || empty($payload['role'])) {
                http_response_code(400);
                echo json_encode(["error" => "Missing email or role"]);
                exit();
            }
            $newId = generateGuid();
            $stmt = $pdo->prepare("INSERT INTO admins (id, email, role) VALUES (?, ?, ?)");
            $stmt->execute([$newId, strtolower(trim($payload['email'])), $payload['role']]);
            echo json_encode(["id" => $newId, "email" => $payload['email'], "role" => $payload['role']]);
            exit();
        }
    }

    // PUT /resource/{id}
    if (!empty($id) && $method === 'PUT') {
        $payload = getJsonPayload();
        if ($table === 'members' || $table === 'workers') {
            $fields = [];
            $values = [];
            foreach (['firstName', 'lastName', 'whatsAppNumber', 'lastAttendanceDate', 'currentStatus', 'notes', 'gender'] as $col) {
                if (isset($payload[$col])) {
                    $fields[] = "{$col} = ?";
                    $values[] = $payload[$col];
                }
            }
            if (empty($fields)) {
                http_response_code(400);
                echo json_encode(["error" => "No details to update"]);
                exit();
            }
            $values[] = $id;
            $stmt = $pdo->prepare("UPDATE {$table} SET " . implode(', ', $fields) . " WHERE id = ?");
            $stmt->execute($values);
            echo json_encode(["success" => true]);
            exit();
        }
    }
}

// Map endpoints to handlers
if (str_starts_with($route, '/members')) {
    handleResourceCrud($pdo, 'members', $route, $requestMethod);
}

if (str_starts_with($route, '/workers')) {
    handleResourceCrud($pdo, 'workers', $route, $requestMethod);
}

if (str_starts_with($route, '/sundays')) {
    handleResourceCrud($pdo, 'sundays', $route, $requestMethod);
}

if (str_starts_with($route, '/admins')) {
    handleResourceCrud($pdo, 'admins', $route, $requestMethod);
}

// -------------------------------------------------------------
// 5. SETTINGS, WHATSAPP LOGS & AUDIT LOGS
// -------------------------------------------------------------

// GET WhatsApp configurations
if ($route === '/whatsapp/config' && $requestMethod === 'GET') {
    $stmt = $pdo->query("SELECT val FROM settings WHERE id = 'whatsapp_config'");
    $row = $stmt->fetch();
    echo $row['val'] ?? '{}';
    exit();
}

// POST WhatsApp configurations
if ($route === '/whatsapp/config' && $requestMethod === 'POST') {
    $payload = getJsonPayload();
    $stmt = $pdo->prepare("INSERT INTO settings (id, val) VALUES ('whatsapp_config', ?) ON CONFLICT(id) DO UPDATE SET val = excluded.val");
    $stmt->execute([json_encode($payload)]);
    echo json_encode($payload);
    exit();
}

// GET WhatsApp logs
if ($route === '/whatsapp/logs' && $requestMethod === 'GET') {
    $stmt = $pdo->query("SELECT * FROM whatsapp_logs ORDER BY sentAt DESC");
    echo json_encode($stmt->fetchAll());
    exit();
}

// GET Audit logs
if ($route === '/audit-logs' && $requestMethod === 'GET') {
    $stmt = $pdo->query("SELECT * FROM audit_logs ORDER BY timestamp DESC");
    echo json_encode($stmt->fetchAll());
    exit();
}

// GET All attendance logs
if ($route === '/attendance' && $requestMethod === 'GET') {
    $stmt = $pdo->query("SELECT * FROM attendance ORDER BY timestamp DESC");
    echo json_encode($stmt->fetchAll());
    exit();
}

// Handler fallback 404
http_response_code(404);
echo json_encode(["error" => "API Route not found", "route" => $route]);
exit();
