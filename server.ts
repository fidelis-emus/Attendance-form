import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { MongoClient, ObjectId } from "mongodb";
import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;
const app = express();
app.use(express.json());

// Helper: Match MongoDB queries with equality checks
function matchQuery(item: any, query: any): boolean {
  if (!query || Object.keys(query).length === 0) return true;
  for (const key of Object.keys(query)) {
    if (query[key] !== undefined && item[key] !== query[key]) return false;
  }
  return true;
}

// Helper: Sort records based on MongoDB sort specifications
function sortItems(items: any[], sortQuery: any): any[] {
  if (!sortQuery) return items;
  const key = Object.keys(sortQuery)[0];
  const direction = sortQuery[key]; // -1 for desc, 1 for asc
  return [...items].sort((a, b) => {
    const valA = a[key];
    const valB = b[key];
    if (valA === undefined) return 1;
    if (valB === undefined) return -1;
    if (valA < valB) return direction === -1 ? 1 : -1;
    if (valA > valB) return direction === -1 ? -1 : 1;
    return 0;
  });
}

// Local Database Fallback implementation
class LocalCollection {
  constructor(private name: string, private db: LocalDatabase) {}

  find(query: any = {}, options: any = {}) {
    const getFiltered = async () => {
      const items = await this.db.readCollection(this.name);
      return items.filter(item => matchQuery(item, query));
    };
    return {
      sort: (sortQuery: any) => {
        return {
          toArray: async () => {
            const filtered = await getFiltered();
            return sortItems(filtered, sortQuery);
          }
        };
      },
      toArray: async () => {
        return await getFiltered();
      }
    };
  }

  async findOne(query: any) {
    const items = await this.db.readCollection(this.name);
    const item = items.find(item => matchQuery(item, query));
    return item || null;
  }

  async insertOne(doc: any) {
    const items = await this.db.readCollection(this.name);
    const newDoc = { ...doc };
    if (!newDoc._id) {
      newDoc._id = generateId();
    }
    items.push(newDoc);
    await this.db.writeCollection(this.name, items);
    return { acknowledged: true, insertedId: newDoc._id };
  }

  async updateOne(query: any, update: any, options: any = {}) {
    const items = await this.db.readCollection(this.name);
    let updated = false;
    for (let item of items) {
      if (matchQuery(item, query)) {
        const setObj = update.$set || {};
        for (const key of Object.keys(setObj)) {
          item[key] = setObj[key];
        }
        updated = true;
      }
    }
    if (!updated && options.upsert) {
      const newDoc = { ...query };
      const setObj = update.$set || {};
      for (const key of Object.keys(setObj)) {
        newDoc[key] = setObj[key];
      }
      if (!newDoc.id && query.id) {
        newDoc.id = query.id;
      }
      if (!newDoc._id) {
        newDoc._id = generateId();
      }
      items.push(newDoc);
      updated = true;
    }
    if (updated) {
      await this.db.writeCollection(this.name, items);
    }
    return { acknowledged: true, modifiedCount: updated ? 1 : 0 };
  }

  async deleteOne(query: any) {
    const items = await this.db.readCollection(this.name);
    const initialLen = items.length;
    const filtered = items.filter(item => !matchQuery(item, query));
    if (filtered.length !== initialLen) {
      await this.db.writeCollection(this.name, filtered);
    }
    return { acknowledged: true, deletedCount: initialLen - filtered.length };
  }

  async countDocuments(query: any = {}) {
    const items = await this.db.readCollection(this.name);
    const filtered = items.filter(item => matchQuery(item, query));
    return filtered.length;
  }
}

class LocalDatabase {
  private dataDir = path.join(process.cwd(), "local_db");

  constructor() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  collection(name: string) {
    return new LocalCollection(name, this);
  }

  async readCollection(name: string): Promise<any[]> {
    const filePath = path.join(this.dataDir, `${name}.json`);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    } catch (err) {
      console.error(`Error reading collection ${name}:`, err);
      return [];
    }
  }

  async writeCollection(name: string, data: any[]): Promise<void> {
    const filePath = path.join(this.dataDir, `${name}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error(`Error writing collection ${name}:`, err);
    }
  }
}

let mongoClient: MongoClient | null = null;
let mongoDbInstance: any = null;

async function getDb() {
  if (mongoDbInstance) return mongoDbInstance;
  
  const mUri = process.env.MONGODB_URI;
  if (!mUri) {
    console.warn("⚠️ MONGODB_URI environment variable is not set. Falling back to robust Local File Database storage to preserve full application function offline!");
    mongoDbInstance = new LocalDatabase();
    return mongoDbInstance;
  }
  
  console.log("Connecting to MongoDB database cluster...");
  try {
    mongoClient = new MongoClient(mUri);
    await mongoClient.connect();
    
    const dbName = mUri.split("/").pop()?.split("?")[0] || "church_attendance";
    mongoDbInstance = mongoClient.db(dbName);
    console.log(`Connected to MongoDB database: ${dbName}`);
    return mongoDbInstance;
  } catch (err) {
    console.error("MongoDB Connection Failed, fallback to local backup db directory:", err);
    console.warn("⚠️ Local File Database activated to bypass system launch blocks.");
    mongoDbInstance = new LocalDatabase();
    return mongoDbInstance;
  }
}

// Helper: Generate structured 24-char unique id string
function generateId(): string {
  return new ObjectId().toHexString();
}

// Helper: Format Date as YYYY-MM-DD
function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

// Helper: Find Sunday Date for a given date
function getSundayOfDate(d: Date): string {
  const target = new Date(d);
  const day = target.getDay();
  target.setDate(target.getDate() - day);
  return formatDate(target);
}

// Helper: Get automatic Sundays for previous, current, and next year
function getAutomaticSundays(): string[] {
  const currentYear = new Date().getFullYear();
  const sundays: string[] = [];
  const years = [currentYear - 1, currentYear, currentYear + 1];
  for (const year of years) {
    const d = new Date(year, 0, 1);
    while (d.getDay() !== 0) {
      d.setDate(d.getDate() + 1);
    }
    while (d.getFullYear() === year) {
      sundays.push(d.toISOString().split("T")[0]);
      d.setDate(d.getDate() + 7);
    }
  }
  return sundays;
}

// Background scheduler helper: Calculate all Sundays of current year and next year, and insert them automatically into the database
async function ensureMonthlySundaysInserted() {
  try {
    const db = await getDb();
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];
    const computedSundays: string[] = [];

    for (const year of years) {
      const d = new Date(year, 0, 1);
      // Align to first Sunday of the year
      while (d.getDay() !== 0) {
        d.setDate(d.getDate() + 1);
      }
      while (d.getFullYear() === year) {
        computedSundays.push(formatDate(d));
        d.setDate(d.getDate() + 7);
      }
    }

    // Retrieve already registered Sundays in db
    const existingDocs = await db.collection("sundays").find({}).toArray();
    const existingSet = new Set(existingDocs.map((doc: any) => doc.date));

    // Determine which calculated entries are missing
    const missingSundays = computedSundays.filter(date => !existingSet.has(date));

    // Bulk insert newly calculated missing Sundays
    if (missingSundays.length > 0) {
      console.log(`[Automated Sunday Scheduler] Inserting ${missingSundays.length} automatically calculated Sundy service dates...`);
      const payload = missingSundays.map(date => ({
        id: generateId(),
        date
      }));
      await db.collection("sundays").insertMany(payload);
    }
  } catch (err) {
    console.error("Failed to run automated Sunday calculator schedule:", err);
  }
}

// Function to fetch and merge all sundays, ensuring computed ones are inserted
async function getAllServiceSundays(): Promise<string[]> {
  // Always trigger the automated insertion on request to keep dates completely refreshed
  await ensureMonthlySundaysInserted();
  try {
    const db = await getDb();
    const customDocs = await db.collection("sundays").find({}).toArray();
    const customDates: string[] = customDocs.map((doc: any) => String(doc.date));
    
    // Merge, remove duplicates
    const allSundaysSet = new Set<string>(customDates);
    // Sort chronological DESCENDING (newest first)
    return Array.from(allSundaysSet).sort((a, b) => b.localeCompare(a));
  } catch (err) {
    console.error("Error fetching custom sundays, returning only automatic:", err);
    return getAutomaticSundays().sort((a, b) => b.localeCompare(a));
  }
}

// Helper: Add an Audit Log
async function addAuditLog(userId: string, userEmail: string, action: string) {
  try {
    const db = await getDb();
    await db.collection("audit_logs").insertOne({
      id: generateId(),
      userId,
      userEmail,
      action,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

// ==========================================
// API ROUTES
// ==========================================

// Authenticate and Bootstrap admin credentials
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const emailLower = email.trim().toLowerCase();
    const systemPassword = process.env.ADMIN_PASSWORD || "admin123";

    if (password !== systemPassword) {
      return res.status(401).json({ error: "Invalid access credentials." });
    }

    const db = await getDb();

    // Bootstrap Admin: Check if fidelisemus@gmail.com
    if (emailLower === "fidelisemus@gmail.com") {
      const existing = await db.collection("admins").findOne({ email: emailLower });
      if (!existing) {
        const id = generateId();
        await db.collection("admins").insertOne({
          id,
          email: emailLower,
          role: "Super Admin",
        });
        await addAuditLog(id, emailLower, `Auto-registered bootstrapped Super Admin: ${emailLower}`);
      }
    }

    const admin = await db.collection("admins").findOne({ email: emailLower });
    if (!admin) {
      const totalCount = await db.collection("admins").countDocuments();
      if (totalCount === 0) {
        // Auto-bootstrap is also allowed for first-come first-registered email if DB is totally empty
        const id = generateId();
        const role = "Super Admin";
        await db.collection("admins").insertOne({
          id,
          email: emailLower,
          role,
        });
        await addAuditLog(id, emailLower, `Empty database auto-registration bootstrap admin: ${emailLower}`);
        return res.json({ id, email: emailLower, role });
      }
      return res.status(403).json({ error: "Access Denied. You are not registered as an authorized administrator inside the system." });
    }

    res.json({
      id: admin.id,
      email: admin.email,
      role: admin.role,
    });
  } catch (err: any) {
    console.error("Verification failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// Submit Attendance Form (Public Client endpoint)
app.post("/api/attendance/submit", async (req, res) => {
  try {
    const { firstName, lastName, whatsAppNumber, attendeeType, submissionDate } = req.body;

    if (!firstName || !lastName || !whatsAppNumber || !attendeeType) {
      return res.status(400).json({ error: "Missing required fields (firstName, lastName, whatsAppNumber, attendeeType)" });
    }

    const dateUsed = submissionDate ? submissionDate : getSundayOfDate(new Date());
    const personType = attendeeType === "worker" ? "worker" : "member";
    const collectionName = personType === "worker" ? "workers" : "members";

    // Format phone with + if missing but numeric
    let phoneNum = whatsAppNumber.trim();
    if (!phoneNum.startsWith("+") && /^\d+$/.test(phoneNum)) {
      phoneNum = "+" + phoneNum;
    }

    const db = await getDb();
    
    // Check if duplicate in respective collections
    const existing = await db.collection(collectionName).findOne({ whatsAppNumber: phoneNum });

    let personId = "";
    if (!existing) {
      // Create new profile record
      personId = generateId();
      await db.collection(collectionName).insertOne({
        id: personId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        whatsAppNumber: phoneNum,
        lastAttendanceDate: dateUsed,
        currentStatus: "Present",
        attendedAtTime: new Date().toISOString(),
        messageSent: false,
        messageSentDate: null,
        messageDeliveryStatus: null,
      });
    } else {
      // Update existing profile details
      personId = existing.id;
      await db.collection(collectionName).updateOne(
        { id: personId },
        {
          $set: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            lastAttendanceDate: dateUsed,
            currentStatus: "Present",
            attendedAtTime: new Date().toISOString(),
            messageSent: false,
            messageSentDate: null,
            messageDeliveryStatus: null,
          }
        }
      );
    }

    // Record Sunday Attendance roster transaction
    const checkDupRef = await db.collection("attendance").findOne({
      date: dateUsed,
      personId: personId
    });

    if (!checkDupRef) {
      await db.collection("attendance").insertOne({
        id: generateId(),
        date: dateUsed,
        personId,
        personType,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        whatsAppNumber: phoneNum,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ message: "God Bless you. Enjoy the rest of the service in God's presence." });
  } catch (err: any) {
    console.error("Attendance submission failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// Admin-triggered real-time attendance quick toggle
app.post("/api/attendance/toggle", async (req, res) => {
  try {
    const { personId, personType, date, adminEmail, adminId } = req.body;
    if (!personId || !personType) {
      return res.status(400).json({ error: "Missing personId or personType" });
    }

    const todaySunday = getSundayOfDate(new Date());
    const targetDate = date && date !== "all" ? date : todaySunday;
    const db = await getDb();
    const collectionName = personType === "worker" ? "workers" : "members";

    // Grab person details
    const person = await db.collection(collectionName).findOne({ id: personId });
    if (!person) {
      return res.status(404).json({ error: "Person not found in database records" });
    }

    // Check if check-in record exists for this specific Sunday
    const existing = await db.collection("attendance").findOne({
      personId,
      date: targetDate
    });

    let newStatus: "Present" | "Absent";

    if (existing) {
      // Toggle to Absent -> Delete the check-in record
      await db.collection("attendance").deleteOne({ personId, date: targetDate });
      newStatus = "Absent";

      // Re-evaluate person status attributes
      const pastRecords = await db.collection("attendance")
        .find({ personId })
        .sort({ date: -1 })
        .toArray();
      const latestPastDate = pastRecords.length > 0 ? pastRecords[0].date : "";
      const latestPastTime = pastRecords.length > 0 ? pastRecords[0].timestamp : null;

      const isDefaultToday = targetDate === todaySunday;
      const updateSet: any = {
        lastAttendanceDate: latestPastDate
      };
      if (isDefaultToday) {
        updateSet.currentStatus = "Absent";
      }

      await db.collection(collectionName).updateOne(
        { id: personId },
        { $set: updateSet }
      );

      await addAuditLog(
        adminId || "unknown",
        adminEmail || "admin@church.org",
        `Admin toggled attendance: Marked ${person.firstName} ${person.lastName} as Absent for ${targetDate}`
      );
    } else {
      // Toggle to Present -> Create database check-in entry
      const checkInTime = new Date().toISOString();
      await db.collection("attendance").insertOne({
        id: generateId(),
        date: targetDate,
        personId,
        personType,
        firstName: person.firstName,
        lastName: person.lastName,
        whatsAppNumber: person.whatsAppNumber,
        timestamp: checkInTime
      });
      newStatus = "Present";

      const isDefaultToday = targetDate === todaySunday;
      const shouldUpdateDate = !person.lastAttendanceDate || targetDate >= person.lastAttendanceDate;

      const updateSet: any = {};
      if (shouldUpdateDate) {
        updateSet.lastAttendanceDate = targetDate;
      }
      if (isDefaultToday || shouldUpdateDate) {
        updateSet.currentStatus = "Present";
        updateSet.attendedAtTime = checkInTime;
      }

      if (Object.keys(updateSet).length > 0) {
        await db.collection(collectionName).updateOne(
          { id: personId },
          { $set: updateSet }
        );
      }

      await addAuditLog(
        adminId || "unknown",
        adminEmail || "admin@church.org",
        `Admin toggled attendance: Marked ${person.firstName} ${person.lastName} as Present for ${targetDate}`
      );
    }

    res.json({ success: true, newStatus });
  } catch (err: any) {
    console.error("Attendance quick toggle failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET Dashboards Stats
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const todaySunday = getSundayOfDate(new Date());
    const db = await getDb();

    const [members, workers, attendance, waLogs] = await Promise.all([
      db.collection("members").find({}, { projection: { _id: 0 } }).toArray(),
      db.collection("workers").find({}, { projection: { _id: 0 } }).toArray(),
      db.collection("attendance").find({ date: todaySunday }, { projection: { _id: 0 } }).toArray(),
      db.collection("whatsapp_logs").find({}, { projection: { _id: 0 } }).toArray(),
    ]);

    const totalMembers = members.length;
    const totalWorkers = workers.length;

    let membersPresent = 0;
    let workersPresent = 0;

    attendance.forEach((rec: any) => {
      if (rec.personType === "worker") {
        workersPresent++;
      } else {
        membersPresent++;
      }
    });

    const absentMembers = Math.max(0, totalMembers - membersPresent);
    const absentWorkers = Math.max(0, totalWorkers - workersPresent);

    const totalWAMessages = waLogs.length;

    // Delivery stats
    let sentCount = 0;
    let delivCount = 0;
    let readCount = 0;
    let failCount = 0;

    waLogs.forEach((rec: any) => {
      const status = rec.deliveryStatus;
      if (status === "Sent") sentCount++;
      else if (status === "Delivered") delivCount++;
      else if (status === "Read") readCount++;
      else if (status === "Failed") failCount++;
    });

    res.json({
      totalMembers,
      totalWorkers,
      membersPresent,
      workersPresent,
      absentMembers,
      absentWorkers,
      totalWAMessages,
      deliveryStats: {
        Sent: sentCount,
        Delivered: delivCount,
        Read: readCount,
        Failed: failCount,
      },
      todaySunday,
    });
  } catch (err: any) {
    console.error("Failed to load dashboard stats:", err);
    res.status(500).json({ error: err.message });
  }
});

// CRUD for Members
app.get("/api/members", async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("members").find({}, { projection: { _id: 0 } }).toArray();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/members", async (req, res) => {
  try {
    const { firstName, lastName, whatsAppNumber, currentStatus, lastAttendanceDate, adminEmail, adminId, notes } = req.body;
    if (!firstName || !lastName || !whatsAppNumber) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const id = generateId();
    const data = {
      id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      whatsAppNumber: whatsAppNumber.trim(),
      lastAttendanceDate: lastAttendanceDate || "",
      currentStatus: currentStatus || "Absent",
      notes: notes || "",
      messageSent: false,
      messageSentDate: null,
      messageDeliveryStatus: null,
    };
    const db = await getDb();
    await db.collection("members").insertOne(data);

    await addAuditLog(
      adminId || "unknown",
      adminEmail || "admin@church.org",
      `Created member: ${firstName} ${lastName}`
    );

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/members/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    delete body.id;
    delete body._id;
    
    const db = await getDb();
    await db.collection("members").updateOne({ id }, { $set: body });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/members/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminEmail, adminId } = req.body;
    const db = await getDb();
    
    await db.collection("members").deleteOne({ id });

    await addAuditLog(
      adminId || "unknown",
      adminEmail || "admin@church.org",
      `Deleted member with ID: ${id}`
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CRUD for Workers
app.get("/api/workers", async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("workers").find({}, { projection: { _id: 0 } }).toArray();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/workers", async (req, res) => {
  try {
    const { firstName, lastName, whatsAppNumber, currentStatus, lastAttendanceDate, adminEmail, adminId, notes } = req.body;
    if (!firstName || !lastName || !whatsAppNumber) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const id = generateId();
    const data = {
      id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      whatsAppNumber: whatsAppNumber.trim(),
      lastAttendanceDate: lastAttendanceDate || "",
      currentStatus: currentStatus || "Absent",
      notes: notes || "",
      messageSent: false,
      messageSentDate: null,
      messageDeliveryStatus: null,
    };
    const db = await getDb();
    await db.collection("workers").insertOne(data);

    await addAuditLog(
      adminId || "unknown",
      adminEmail || "admin@church.org",
      `Created worker: ${firstName} ${lastName}`
    );

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/workers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    delete body.id;
    delete body._id;
    
    const db = await getDb();
    await db.collection("workers").updateOne({ id }, { $set: body });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/workers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminEmail, adminId } = req.body;
    const db = await getDb();
    
    await db.collection("workers").deleteOne({ id });

    await addAuditLog(
      adminId || "unknown",
      adminEmail || "admin@church.org",
      `Deleted worker with ID: ${id}`
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Attendance History list
app.get("/api/attendance", async (req, res) => {
  try {
    const db = await getDb();
    const records = await db.collection("attendance").find({}, { projection: { _id: 0 } }).toArray();
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Admin list
app.get("/api/admins", async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("admins").find({}, { projection: { _id: 0 } }).toArray();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Admin role mapping
app.post("/api/admins", async (req, res) => {
  try {
    const { id, email, role, adminEmail, adminId } = req.body;
    if (!email || !role || !id) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    const db = await getDb();
    
    await db.collection("admins").updateOne(
      { id },
      {
        $set: {
          id,
          email: email.trim().toLowerCase(),
          role,
        }
      },
      { upsert: true }
    );

    await addAuditLog(
      adminId || "unknown",
      adminEmail || "admin@church.org",
      `Added or modified administrator rights for: ${email} as ${role}`
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Admin
app.delete("/api/admins/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminEmail, adminId } = req.body;
    const db = await getDb();

    const targetAdmin = await db.collection("admins").findOne({ id });
    const targetEmail = targetAdmin?.email || "unknown";

    await db.collection("admins").deleteOne({ id });

    await addAuditLog(
      adminId || "unknown",
      adminEmail || "admin@church.org",
      `Revoked administrator rights for: ${targetEmail}`
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SUNDAY DATES MANAGEMENT ENDPOINTS
// ==========================================

// GET all Sunday Service Dates (Automatic + Custom)
app.get("/api/sundays", async (req, res) => {
  try {
    const list = await getAllServiceSundays();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST to ADD a custom Sunday Date manual definition
app.post("/api/sundays", async (req, res) => {
  try {
    const { date, adminEmail, adminId } = req.body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Please specify a valid Sunday date in YYYY-MM-DD format." });
    }

    const db = await getDb();
    
    // Check if duplicate
    const existing = await db.collection("sundays").findOne({ date });
    if (!existing) {
      await db.collection("sundays").insertOne({
        id: generateId(),
        date
      });
      await addAuditLog(
        adminId || "unknown",
        adminEmail || "admin@church.org",
        `Manually defined custom Sunday service date: ${date}`
      );
    }

    res.json({ success: true, date });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a custom Sunday Date manual definition
app.delete("/api/sundays/:date", async (req, res) => {
  try {
    const { date } = req.params;
    const { adminEmail, adminId } = req.body;
    const db = await getDb();

    await db.collection("sundays").deleteOne({ date });
    await addAuditLog(
      adminId || "unknown",
      adminEmail || "admin@church.org",
      `Removed manually defined Sunday service date: ${date}`
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET system audit logs
app.get("/api/audit-logs", async (req, res) => {
  try {
    const db = await getDb();
    const logs = await db.collection("audit_logs").find({}, { projection: { _id: 0 } }).sort({ timestamp: -1 }).toArray();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// WhatsApp settings
app.get("/api/whatsapp/config", async (req, res) => {
  try {
    const db = await getDb();
    const doc = await db.collection("settings").findOne({ id: "whatsapp_config" }, { projection: { _id: 0 } });
    const memberDefault = "Happy Sunday {Name} and hope all is well. We didn't see you in church today. Hope to see you next Sunday, and please feel free to reach out to the church pastor if you need any assistance. God bless you.";
    const workerDefault = "Dearest worker {Name}, we missed your valuable service in church today as part of our core team. We hope everything is well. Please reach out to your department leader if you need any support. See you next Sunday. God bless your labor of love!";
    
    if (doc) {
      res.json({
        ...doc,
        churchWhatsAppNumber: doc.churchWhatsAppNumber || "+2349029957453",
        memberTemplate: doc.memberTemplate || memberDefault,
        workerTemplate: doc.workerTemplate || workerDefault,
      });
    } else {
      res.json({
        churchWhatsAppNumber: "+2349029957453",
        phoneNumberId: "",
        accessToken: "",
        businessAccountId: "",
        memberTemplate: memberDefault,
        workerTemplate: workerDefault,
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/whatsapp/config", async (req, res) => {
  try {
    const { churchWhatsAppNumber, phoneNumberId, accessToken, businessAccountId, memberTemplate, workerTemplate, adminEmail, adminId } = req.body;
    const db = await getDb();

    await db.collection("settings").updateOne(
      { id: "whatsapp_config" },
      {
        $set: {
          id: "whatsapp_config",
          churchWhatsAppNumber: churchWhatsAppNumber || "",
          phoneNumberId: phoneNumberId || "",
          accessToken: accessToken || "",
          businessAccountId: businessAccountId || "",
          memberTemplate: memberTemplate || "",
          workerTemplate: workerTemplate || "",
        }
      },
      { upsert: true }
    );

    await addAuditLog(
      adminId || "unknown", 
      adminEmail || "admin@church.org", 
      "Updated WhatsApp Business Cloud API Configuration credentials"
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET message logs
app.get("/api/whatsapp/logs", async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("whatsapp_logs").find({}, { projection: { _id: 0 } }).sort({ sentAt: -1 }).toArray();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Backup Database (direct download format)
app.get("/api/backup/export", async (req, res) => {
  try {
    const collections = ["members", "workers", "attendance", "whatsapp_logs", "settings", "admins", "audit_logs"];
    const backup: any = {};
    const db = await getDb();

    for (const col of collections) {
      backup[col] = await db.collection(col).find({}, { projection: { _id: 0 } }).toArray();
    }

    const pad = (n: number) => String(n).padStart(2, "0");
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    res.setHeader("Content-disposition", `attachment; filename=church_attendance_backup_${dateStr}.json`);
    res.set("Content-Type", "application/json");
    res.send(JSON.stringify(backup, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Webhook Verifier (GET)
app.get("/api/whatsapp/webhook", (req, res) => {
  const verifyToken = "CHURCH_ATTENDANCE_VERIFY_TOKEN";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      console.log("Meta Webhook verified successfully!");
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
  res.sendStatus(400);
});

// Webhook status listener (POST)
app.post("/api/whatsapp/webhook", async (req, res) => {
  const body = req.body;
  
  if (body.object) {
    try {
      const changes = body.entry?.[0]?.changes?.[0];
      const value = changes?.value;
      const statusObj = value?.statuses?.[0];

      if (statusObj) {
        const wamid = statusObj.id;
        const rawStatus = statusObj.status;
        
        let deliveryStatus: "Sent" | "Delivered" | "Read" | "Failed" = "Sent";
        if (rawStatus === "delivered") deliveryStatus = "Delivered";
        else if (rawStatus === "read") deliveryStatus = "Read";
        else if (rawStatus === "failed") deliveryStatus = "Failed";

        const db = await getDb();
        const log = await db.collection("whatsapp_logs").findOne({ wamid });
        
        if (log) {
          await db.collection("whatsapp_logs").updateOne({ wamid }, { $set: { deliveryStatus } });

          const personCol = log.personType === "worker" ? "workers" : "members";
          await db.collection(personCol).updateOne(
            { id: log.personId },
            { $set: { messageDeliveryStatus: deliveryStatus } }
          );

          console.log(`Updated WhatsApp delivery status for ${wamid} to ${deliveryStatus}`);
        }
      }
    } catch (err) {
      console.error("Webhook processing failed:", err);
    }
    return res.status(200).send("EVENT_RECEIVED");
  }
  res.sendStatus(404);
});

// Manual WhatsApp resend
app.post("/api/whatsapp/resend", async (req, res) => {
  try {
    const { personId, personType, whatsAppNumber, messageContent, adminEmail, adminId } = req.body;
    
    if (!whatsAppNumber || !messageContent || !personId) {
      return res.status(400).json({ error: "Missing target fields" });
    }

    const db = await getDb();
    const config = await db.collection("settings").findOne({ id: "whatsapp_config" }, { projection: { _id: 0 } });

    let deliveryStatus: "Sent" | "Failed" = "Sent";
    let wamid = null;
    let errorMessage = "";

    try {
      if (config && config.phoneNumberId && config.accessToken) {
        const data = await sendWhatsAppMessage(config, whatsAppNumber, messageContent);
        wamid = data.messages?.[0]?.id || null;
      } else {
        throw new Error("Meta credentials missing - manual resend");
      }
    } catch (sendErr: any) {
      console.error("Meta sending error during manual resend:", sendErr);
      deliveryStatus = "Failed";
      errorMessage = sendErr.message;
    }

    const personCol = personType === "worker" ? "workers" : "members";
    const person = await db.collection(personCol).findOne({ id: personId });
    const personName = person ? `${person.firstName} ${person.lastName}` : "Unknown";

    const logId = generateId();
    await db.collection("whatsapp_logs").insertOne({
      id: logId,
      personId,
      personName,
      personType,
      whatsAppNumber,
      messageContent,
      sentAt: new Date().toISOString(),
      deliveryStatus,
      wamid,
    });

    await db.collection(personCol).updateOne(
      { id: personId },
      {
        $set: {
          messageSent: true,
          messageSentDate: new Date().toISOString(),
          messageDeliveryStatus: deliveryStatus,
        }
      }
    );

    await addAuditLog(
      adminId || "unknown", 
      adminEmail || "admin@church.org", 
      `Manually resent WhatsApp message to ${personName} (${whatsAppNumber})`
    );

    if (deliveryStatus === "Failed") {
      return res.status(200).json({ success: false, error: errorMessage || "Failed to deliver via Meta WhatsApp Business API." });
    }

    res.json({ success: true, wamid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Core Follow-up Runner Function
async function executeSundayFollowups(): Promise<{ processedCount: number; failedCount: number; logs: any[] }> {
  console.log("Triggering Sunday 6:00 PM Absent check...");
  
  const todaySun = getSundayOfDate(new Date());
  const prevSundayDate = new Date();
  prevSundayDate.setDate(prevSundayDate.getDate() - 7);
  const prevSun = getSundayOfDate(prevSundayDate);

  const db = await getDb();
  const config = await db.collection("settings").findOne({ id: "whatsapp_config" }, { projection: { _id: 0 } });

  const [prevAtt, todayAtt] = await Promise.all([
    db.collection("attendance").find({ date: prevSun }, { projection: { _id: 0 } }).toArray(),
    db.collection("attendance").find({ date: todaySun }, { projection: { _id: 0 } }).toArray(),
  ]);

  const presentTodayIds = new Set<string>();
  todayAtt.forEach((rec: any) => {
    presentTodayIds.add(rec.personId);
  });

  const absenteesList: Array<{
    personId: string;
    personType: "member" | "worker";
    firstName: string;
    lastName: string;
    whatsAppNumber: string;
  }> = [];

  prevAtt.forEach((rec: any) => {
    if (!presentTodayIds.has(rec.personId)) {
      absenteesList.push({
        personId: rec.personId,
        personType: rec.personType,
        firstName: rec.firstName,
        lastName: rec.lastName,
        whatsAppNumber: rec.whatsAppNumber,
      });
    }
  });

  const memberDefault = "Happy Sunday {Name} and hope all is well. We didn't see you in church today. Hope to see you next Sunday, and please feel free to reach out to the church pastor if you need any assistance. God bless you.";
  const workerDefault = "Dearest worker {Name}, we missed your valuable service in church today as part of our core team. We hope everything is well. Please reach out to your department leader if you need any support. See you next Sunday. God bless your labor of love!";

  const memberTemplate = config?.memberTemplate || memberDefault;
  const workerTemplate = config?.workerTemplate || workerDefault;
  
  let processedCount = 0;
  let failedCount = 0;
  const executionLogs: any[] = [];

  for (const person of absenteesList) {
    const personCol = person.personType === "worker" ? "workers" : "members";
    let deliveryStatus: "Sent" | "Failed" = "Sent";
    let wamid = null;

    const rawTemplate = person.personType === "worker" ? workerTemplate : memberTemplate;
    const messageText = rawTemplate
      .replace(/{Name}/g, person.firstName)
      .replace(/{FullName}/g, `${person.firstName} ${person.lastName}`);

    try {
      if (config && config.phoneNumberId && config.accessToken) {
        const result = await sendWhatsAppMessage(config, person.whatsAppNumber, messageText);
        wamid = result.messages?.[0]?.id || null;
        processedCount++;
      } else {
        throw new Error("Meta credentials are not configured in system settings.");
      }
    } catch (err: any) {
      console.error(`Failed to send automated follow up to ${person.whatsAppNumber}:`, err.message);
      deliveryStatus = "Failed";
      failedCount++;
    }

    await db.collection("whatsapp_logs").insertOne({
      id: generateId(),
      personId: person.personId,
      personName: `${person.firstName} ${person.lastName}`,
      personType: person.personType,
      whatsAppNumber: person.whatsAppNumber,
      messageContent: messageText,
      sentAt: new Date().toISOString(),
      deliveryStatus,
      wamid,
    });

    await db.collection(personCol).updateOne(
      { id: person.personId },
      {
        $set: {
          currentStatus: "Absent",
          attendedAtTime: null,
          messageSent: true,
          messageSentDate: new Date().toISOString(),
          messageDeliveryStatus: deliveryStatus,
        }
      }
    );

    executionLogs.push({
      name: `${person.firstName} ${person.lastName}`,
      status: deliveryStatus,
      phone: person.whatsAppNumber,
      error: deliveryStatus === "Failed" ? "Meta API config missing or transmission failed." : null,
    });
  }

  // Set members absent if they did not attend today
  const allMembers = await db.collection("members").find({}, { projection: { _id: 0 } }).toArray();
  for (const m of allMembers) {
    if (!presentTodayIds.has(m.id) && m.lastAttendanceDate !== todaySun) {
      await db.collection("members").updateOne({ id: m.id }, { $set: { currentStatus: "Absent", attendedAtTime: null } });
    }
  }

  const allWorkers = await db.collection("workers").find({}, { projection: { _id: 0 } }).toArray();
  for (const w of allWorkers) {
    if (!presentTodayIds.has(w.id) && w.lastAttendanceDate !== todaySun) {
      await db.collection("workers").updateOne({ id: w.id }, { $set: { currentStatus: "Absent", attendedAtTime: null } });
    }
  }

  return { processedCount, failedCount, logs: executionLogs };
}

// Dynamic trigger for developers/Admins to instantly test Sunday follow-ups
app.post("/api/whatsapp/trigger-sunday-followup", async (req, res) => {
  try {
    const { adminEmail, adminId } = req.body;
    const result = await executeSundayFollowups();

    await addAuditLog(
      adminId || "system",
      adminEmail || "admin@church.org",
      `Explicitly triggered automated Sunday attendance comparison and WhatsApp follow-up runs. Sent: ${result.processedCount}, Failed: ${result.failedCount}`
    );

    res.json({
      success: true,
      processedCount: result.processedCount,
      failedCount: result.failedCount,
      logs: result.logs,
      message: "Follow-up verification check complete."
    });
  } catch (err: any) {
    console.error("Manual trigger exception:", err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function: Send Meta API Request
async function sendWhatsAppMessage(config: any, toPhone: string, textBody: string) {
  const cleanPhone = toPhone.trim().replace(/\+/g, "").replace(/\s/g, "");
  const url = `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "text",
      text: {
        body: textBody
      }
    })
  });

  const data = await response.json() as any;
  if (!response.ok) {
    throw new Error(data.error?.message || "Meta Cloud API response failure.");
  }
  return data;
}

// Proxy stateless WhatsApp message request
app.post("/api/whatsapp/send-message-proxy", async (req, res) => {
  try {
    const { phoneNumberId, accessToken, to, text } = req.body;
    if (!phoneNumberId || !accessToken || !to || !text) {
      return res.status(400).json({ error: "Missing required request parameters." });
    }
    const data = await sendWhatsAppMessage({ phoneNumberId, accessToken }, to, text);
    res.json({ success: true, wamid: data.messages?.[0]?.id || null });
  } catch (err: any) {
    console.error("Proxy route transmission failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// SCHEDULER (Cron Job)
// ==========================================

// At exactly 6 PM every Sunday (0 18 * * 0)
cron.schedule("0 18 * * 0", async () => {
  try {
    const result = await executeSundayFollowups();
    console.log(`Automated Sunday 6:00 PM CRON completed. Sent: ${result.processedCount}, Failed: ${result.failedCount}`);
  } catch (err) {
    console.error("CRON task failed during background calculation:", err);
  }
});

// Calculate and ensure all Sundays of the year are inserted automatically every Sunday midnight
cron.schedule("0 0 * * 0", async () => {
  try {
    console.log("[Automated Scheduler] Running scheduled check & insert for Sunday service dates...");
    await ensureMonthlySundaysInserted();
  } catch (err) {
    console.error("Automated Sunday calculation scheduler failed:", err);
  }
});

// ==========================================
// VITE DEV SERVER OR STATIC ASSETS PRODUCTION
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Start Server on PORT 3000 and HOST 0.0.0.0
  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Church Attendance Management Server running on port ${PORT}`);
    // Run initial calculation check & populate on server startup
    try {
      await ensureMonthlySundaysInserted();
      console.log("[Startup] Real-time automated calculation and database insertion of Sunday service dates completed! 'sundaysList' is ready.");
    } catch (startupErr) {
      console.error("[Startup] Initial automated Sunday calculation failed:", startupErr);
    }
  });
}

startServer();
