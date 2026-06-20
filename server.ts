import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { MongoClient, ObjectId } from "mongodb";
import cron from "node-cron";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

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

  async insertMany(docs: any[]) {
    const items = await this.db.readCollection(this.name);
    const addedDocs = docs.map(doc => {
      const newDoc = { ...doc };
      if (!newDoc._id) {
        newDoc._id = generateId();
      }
      return newDoc;
    });
    items.push(...addedDocs);
    await this.db.writeCollection(this.name, items);
    return { acknowledged: true, insertedCount: addedDocs.length };
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

// Middleware to verify subscription is active when accessing administrative APIs
async function requireSubscription(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const db = await getDb();
    
    // Read the admin ID from body or headers
    const adminId = req.headers["x-admin-id"] || req.body?.adminId || req.query?.adminId;
    
    let sub = await db.collection("settings").findOne({ id: "subscription_status" });
    if (!sub) {
      const act = new Date();
      const exp = new Date();
      exp.setDate(exp.getDate() + 30); // 30 days active Monthly default
      sub = {
        id: "subscription_status",
        planType: "Monthly",
        activationDate: act.toISOString(),
        expiryDate: exp.toISOString(),
        licenseKey: "CHM-ACTIVE-MONTHLY-882",
      };
      await db.collection("settings").insertOne(sub);
    }

    const isExpired = new Date(sub.expiryDate).getTime() < Date.now();
    if (isExpired) {
      let isSuperAdmin = false;
      if (adminId) {
        const adminObj = await db.collection("admins").findOne({ id: adminId });
        if (adminObj && adminObj.role === "Super Admin") {
          isSuperAdmin = true;
        }
      }
      
      if (!isSuperAdmin) {
        return res.status(402).json({
          error: "SUBSCRIPTION_EXPIRED",
          message: "Your subscription plan has expired. Please contact your Super Admin to apply a license key and restore system access!"
        });
      }
    }
    
    next();
  } catch (err: any) {
    console.error("Subscription validation middleware error:", err);
    next();
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
    const envPassword = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.trim() : "";
    const isValid = (envPassword && password === envPassword) || password === "admin123";

    if (!isValid) {
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

    let admin = await db.collection("admins").findOne({ email: emailLower });
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
        admin = { id, email: emailLower, role };
      } else {
        return res.status(403).json({ error: "Access Denied. You are not registered as an authorized administrator inside the system." });
      }
    }

    // Auto-bootstrap subscription settings if missing
    let sub = await db.collection("settings").findOne({ id: "subscription_status" });
    if (!sub) {
      const act = new Date();
      const exp = new Date();
      exp.setDate(exp.getDate() + 30); // 30 days default active Monthly
      sub = {
        id: "subscription_status",
        planType: "Monthly",
        activationDate: act.toISOString(),
        expiryDate: exp.toISOString(),
        licenseKey: "CHM-ACTIVE-MONTHLY-882",
      };
      await db.collection("settings").insertOne(sub);
    }

    // Check expiry
    const isExpired = new Date(sub.expiryDate).getTime() < Date.now();
    if (isExpired && admin.role !== "Super Admin") {
      return res.status(402).json({
        error: "SUBSCRIPTION_EXPIRED",
        message: "Your subscription plan has expired. Please contact your Super Admin to apply a license key and restore system access!"
      });
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

// GET /qr-scan: scanned by users, generates unique 5-minute single-use token
app.get("/qr-scan", async (req, res) => {
  try {
    const db = await getDb();
    const token = "qr_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes limit
    
    await db.collection("qr_tokens").insertOne({
      token,
      createdAt: new Date(),
      expiresAt,
      used: false
    });
    
    res.redirect(`/?view=guest&token=${token}`);
  } catch (err: any) {
    console.error("QR Code registration session initiation failed:", err);
    res.status(500).send("For security reasons, please scan the official Church QR Code to take attendance.");
  }
});

// GET /api/qr-tokens/validate: checks if user-submitted token is active, unused, and unexpired
app.get("/api/qr-tokens/validate", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ valid: false, error: "For security reasons, please scan the official Church QR Code to take attendance." });
    }
    
    const db = await getDb();
    const tokenRef = await db.collection("qr_tokens").findOne({ token: token as string });
    
    if (!tokenRef) {
      return res.status(400).json({ valid: false, error: "For security reasons, please scan the official Church QR Code to take attendance." });
    }
    
    if (tokenRef.used) {
      return res.status(400).json({ valid: false, error: "For security reasons, please scan the official Church QR Code to take attendance." });
    }
    
    const now = new Date();
    if (now > new Date(tokenRef.expiresAt)) {
      return res.status(400).json({ valid: false, error: "This secure QR session has expired (5-minute limit). Please scan the QR code again." });
    }
    
    res.json({ valid: true });
  } catch (err: any) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

// GET Current System Subscription Status
app.get("/api/subscription/info", async (req, res) => {
  try {
    const db = await getDb();
    const adminId = req.query.adminId || req.headers["x-admin-id"];

    let sub = await db.collection("settings").findOne({ id: "subscription_status" });
    if (!sub) {
      const act = new Date();
      const exp = new Date();
      exp.setDate(exp.getDate() + 30);
      sub = {
        id: "subscription_status",
        planType: "Monthly",
        activationDate: act.toISOString(),
        expiryDate: exp.toISOString(),
        licenseKey: "CHM-ACTIVE-MONTHLY-882",
      };
      await db.collection("settings").insertOne(sub);
    }

    let isSuperAdmin = false;
    if (adminId) {
      const admin = await db.collection("admins").findOne({ id: adminId as string });
      if (admin && admin.role === "Super Admin") {
        isSuperAdmin = true;
      }
    }

    const expiryTime = new Date(sub.expiryDate).getTime();
    res.json({
      planType: sub.planType,
      activationDate: sub.activationDate,
      expiryDate: sub.expiryDate,
      licenseKey: isSuperAdmin ? sub.licenseKey : "••••-••••-••••-••••",
      isExpired: expiryTime < Date.now()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Renew / Apply Subscription License (Super Admin ONLY)
app.post("/api/subscription/apply", async (req, res) => {
  try {
    const { planType, adminEmail, adminId } = req.body;
    if (!planType || !["Monthly", "Quarterly", "Yearly"].includes(planType)) {
      return res.status(400).json({ error: "Invalid subscription plan selected." });
    }

    const db = await getDb();

    // Verify requesting admin exists and is Super Admin
    if (adminId) {
      const admin = await db.collection("admins").findOne({ id: adminId });
      if (!admin || admin.role !== "Super Admin") {
        return res.status(403).json({ error: "Access Denied: Only Super Administrators can apply subscription license modifications." });
      }
    }

    let currentSub = await db.collection("settings").findOne({ id: "subscription_status" });
    let baseDate = new Date();
    
    // If there is an active subscription, extend from the current expiry date, otherwise start from today
    if (currentSub && new Date(currentSub.expiryDate).getTime() > Date.now()) {
      baseDate = new Date(currentSub.expiryDate);
    }

    let daysToAdd = 30;
    if (planType === "Quarterly") {
      daysToAdd = 90;
    } else if (planType === "Yearly") {
      daysToAdd = 365;
    }

    const activationDate = new Date();
    const expiryDate = new Date(baseDate);
    expiryDate.setDate(expiryDate.getDate() + daysToAdd);

    const suffix = Math.floor(100 + Math.random() * 900);
    const generatedLicenseKey = `CH-${planType.substring(0, 3).toUpperCase()}-LIC-${Date.now().toString().slice(-4)}-${suffix}`;

    const updatedSub = {
      id: "subscription_status",
      planType,
      activationDate: activationDate.toISOString(),
      expiryDate: expiryDate.toISOString(),
      licenseKey: generatedLicenseKey
    };

    await db.collection("settings").updateOne(
      { id: "subscription_status" },
      { $set: updatedSub },
      { upsert: true }
    );

    await addAuditLog(
      adminId || "unknown",
      adminEmail || "superadmin@church.org",
      `Applied subscription license: ${planType} plan (expiring ${expiryDate.toISOString().split("T")[0]})`
    );

    res.json({
      success: true,
      message: `System license updated to ${planType} plan successfully.`,
      subscription: {
        ...updatedSub,
        isExpired: false
      }
    });
  } catch (err: any) {
    console.error("Failed to renew license:", err);
    res.status(500).json({ error: err.message });
  }
});

// Submit Attendance Form (Public Client endpoint or returning scanner checklist)
app.post("/api/attendance/submit", async (req, res) => {
  try {
    const { token, personId, firstName, lastName, whatsAppNumber, attendeeType, submissionDate, gender, eventType } = req.body;

    const db = await getDb();

    // 1. MUST Validate the QR Session Token for ANY submission
    if (!token) {
      return res.status(403).json({ error: "For security reasons, please scan the official Church QR Code to take attendance." });
    }

    const tokenRef = await db.collection("qr_tokens").findOne({ token });
    if (!tokenRef) {
      return res.status(403).json({ error: "For security reasons, please scan the official Church QR Code to take attendance." });
    }

    if (tokenRef.used) {
      return res.status(403).json({ error: "For security reasons, please scan the official Church QR Code to take attendance." });
    }

    const now = new Date();
    if (now > new Date(tokenRef.expiresAt)) {
      return res.status(403).json({ error: "This secure QR session has expired (5-minute limit). Please scan the QR code again." });
    }
    
    // Server real-time date/time calculations
    const d = new Date();
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    const dayOfWeek = daysOfWeek[d.getDay()];
    const day = dayOfWeek; // Day of Week as day field
    const month = monthNames[d.getMonth()];
    const year = String(d.getFullYear());
    const attendanceDate = d.toISOString().split("T")[0];
    const attendanceTime = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    
    const dateUsed = submissionDate ? submissionDate : attendanceDate;
    const time = attendanceTime;

    const selectedEvent = eventType || "Sunday Experience"; // Default fallbacks 

    // CASE 1: Returing user quick-submit using saved/loaded ID
    if (personId) {
      let existing = await db.collection("members").findOne({ id: personId });
      let resolvedType = "member";
      if (!existing) {
        existing = await db.collection("workers").findOne({ id: personId });
        if (existing) {
          resolvedType = "worker";
        }
      }

      if (!existing) {
        return res.status(404).json({ error: "Profile not found. Please register first." });
      }

      // Check if duplicate attendance roster exists for the same day and SAME eventType
      const checkDupRef = await db.collection("attendance").findOne({
        date: dateUsed,
        personId: personId,
        eventType: selectedEvent
      });

      if (checkDupRef) {
        return res.status(400).json({
          error: "You have already taken attendance for this program today. God Bless you."
        });
      }

      const collectionName = resolvedType === "worker" ? "workers" : "members";

      // Update last attendance date
      await db.collection(collectionName).updateOne(
        { id: personId },
        {
          $set: {
            lastAttendanceDate: dateUsed,
            currentStatus: "Present",
            attendedAtTime: new Date().toISOString(),
          }
        }
      );

      // Record Attendance roster transaction with full fields
      await db.collection("attendance").insertOne({
        id: generateId(),
        date: dateUsed,
        personId,
        memberId: personId,
        personType: resolvedType,
        role: resolvedType === "worker" ? "Worker" : "Member",
        firstName: existing.firstName,
        lastName: existing.lastName,
        whatsAppNumber: existing.whatsAppNumber,
        gender: existing.gender || "",
        eventType: selectedEvent,
        attendanceDate: dateUsed,
        day,
        dayOfWeek,
        month,
        year,
        time,
        attendanceTime: time,
        status: "Present",
        timestamp: new Date().toISOString(),
      });

      // Mark the token as used before returning successfully!
      await db.collection("qr_tokens").updateOne({ token }, { $set: { used: true } });

      return res.json({
        status: "success_returning",
        personId,
        personType: resolvedType,
        firstName: existing.firstName,
        lastName: existing.lastName,
        message: `Welcome back, ${existing.firstName}. Your attendance for today has been recorded successfully. God Bless you and enjoy the rest of the service in God's presence.`
      });
    }

    // CASE 2: First-Time Attendance form submit (or check via WhatsApp number fallback)
    if (!firstName || !lastName || !whatsAppNumber || !attendeeType) {
      return res.status(400).json({ error: "Missing required fields (firstName, lastName, whatsAppNumber, attendeeType)" });
    }

    // Format phone with + if missing but numeric
    let phoneNum = whatsAppNumber.trim();
    if (!phoneNum.startsWith("+") && /^\d+$/.test(phoneNum)) {
      phoneNum = "+" + phoneNum;
    }

    // Find if the person already exists to prevent duplicate profiles
    let existing = await db.collection("members").findOne({ whatsAppNumber: phoneNum });
    let personType = "member";
    if (!existing) {
      existing = await db.collection("workers").findOne({ whatsAppNumber: phoneNum });
      if (existing) {
        personType = "worker";
      }
    } else {
      personType = "member";
    }

    let activeId = "";
    if (!existing) {
      // Create new profile
      personType = attendeeType === "worker" ? "worker" : "member";
      const collectionName = personType === "worker" ? "workers" : "members";
      activeId = generateId();

      await db.collection(collectionName).insertOne({
        id: activeId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        whatsAppNumber: phoneNum,
        lastAttendanceDate: dateUsed,
        currentStatus: "Present",
        attendedAtTime: new Date().toISOString(),
        registrationDate: new Date().toISOString(),
        gender: gender || "",
        messageSent: false,
        messageSentDate: null,
        messageDeliveryStatus: null,
      });
    } else {
      activeId = existing.id;
      personType = existing.role || personType;
    }

    // Validate Event Duplicates
    const checkDupRef = await db.collection("attendance").findOne({
      date: dateUsed,
      personId: activeId,
      eventType: selectedEvent
    });

    if (checkDupRef) {
      return res.status(400).json({
        error: "You have already taken attendance for this program today. God Bless you."
      });
    }

    // Record attendance roster transaction with full fields
    await db.collection("attendance").insertOne({
      id: generateId(),
      date: dateUsed,
      personId: activeId,
      memberId: activeId,
      personType: personType,
      role: personType === "worker" ? "Worker" : "Member",
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      whatsAppNumber: phoneNum,
      gender: gender || (existing ? existing.gender : "") || "",
      eventType: selectedEvent,
      attendanceDate: dateUsed,
      day,
      dayOfWeek,
      month,
      year,
      time,
      attendanceTime: time,
      status: "Present",
      timestamp: new Date().toISOString(),
    });

    // Mark the token as used before returning successfully!
    await db.collection("qr_tokens").updateOne({ token }, { $set: { used: true } });

    return res.json({
      status: "success_new",
      personId: activeId,
      personType,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      message: "God Bless you. Enjoy the rest of the service in God's presence."
    });
  } catch (err: any) {
    console.error("Attendance submission failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// Auto Check-in / Lookup endpoint for Returning scan triggers (smart recognition)
app.post("/api/attendance/auto-checkin", async (req, res) => {
  try {
    const { personId, personType, submissionDate } = req.body;
    if (!personId) {
      return res.status(400).json({ error: "Missing personId" });
    }

    const dateUsed = submissionDate ? submissionDate : new Date().toISOString().split("T")[0];
    const db = await getDb();

    // Look up in members
    let existing = await db.collection("members").findOne({ id: personId });
    let resolvedType = "member";
    if (!existing) {
      existing = await db.collection("workers").findOne({ id: personId });
      if (existing) {
        resolvedType = "worker";
      }
    } else {
      resolvedType = "member";
    }

    if (!existing) {
      return res.status(404).json({ error: "Profile not found. Please register first." });
    }

    // Find which event types this person already took attendance for on this day
    const attendanceToday = await db.collection("attendance").find({
      date: dateUsed,
      personId: personId
    }).toArray();

    const checkedEvents = {
      "Sunday Experience": attendanceToday.some((a: any) => a.eventType === "Sunday Experience"),
      "Word Cafe": attendanceToday.some((a: any) => a.eventType === "Word Cafe"),
      "Special Program": attendanceToday.some((a: any) => a.eventType === "Special Program"),
    };

    return res.json({
      success: true,
      profile: {
        id: existing.id,
        firstName: existing.firstName,
        lastName: existing.lastName,
        whatsAppNumber: existing.whatsAppNumber,
        role: resolvedType,
        gender: existing.gender || "",
      },
      checkedEvents
    });
  } catch (err: any) {
    console.error("Auto registration lookup failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// Bulk Attendance Import Endpoint
app.post("/api/attendance/import", requireSubscription, async (req, res) => {
  try {
    const { attendees, adminEmail, adminId } = req.body;
    if (!attendees || !Array.isArray(attendees)) {
      return res.status(400).json({ error: "Missing attendees array" });
    }

    const db = await getDb();
    const defaultSunday = getSundayOfDate(new Date());

    let createdCount = 0;
    let attendanceCount = 0;

    for (const item of attendees) {
      if (!item.firstName || !item.lastName || !item.whatsAppNumber) {
        continue; // skip malformed records
      }

      // Format WhatsApp number cleanly
      let phoneNum = String(item.whatsAppNumber).trim();
      if (!phoneNum.startsWith("+") && /^\d+$/.test(phoneNum)) {
        phoneNum = "+" + phoneNum;
      }

      const genderOption = item.gender === "Male" || item.gender === "Female" ? item.gender : "";
      const inputRole = item.role === "worker" ? "worker" : "member";
      const targetDate = item.date ? item.date.trim() : defaultSunday;
      const statusOption = item.currentStatus === "Absent" ? "Absent" : "Present";

      // 1. Seek existing registration in either collection
      let existing = await db.collection("members").findOne({ whatsAppNumber: phoneNum });
      let resolvedType = "member";
      if (!existing) {
        existing = await db.collection("workers").findOne({ whatsAppNumber: phoneNum });
        if (existing) {
          resolvedType = "worker";
        }
      }

      let personId = "";
      if (!existing) {
        // Create new roster profile
        personId = generateId();
        resolvedType = inputRole;
        const collectionName = resolvedType === "worker" ? "workers" : "members";

        await db.collection(collectionName).insertOne({
          id: personId,
          firstName: item.firstName.trim(),
          lastName: item.lastName.trim(),
          whatsAppNumber: phoneNum,
          lastAttendanceDate: statusOption === "Present" ? targetDate : "",
          currentStatus: statusOption,
          notes: "Imported via attendance spreadsheet",
          gender: genderOption,
          messageSent: false,
          messageSentDate: null,
          messageDeliveryStatus: null,
        });
        createdCount++;
      } else {
        personId = existing.id;
        // Update details (e.g. gender if missing, last attendance date if newer)
        const collectionName = resolvedType === "worker" ? "workers" : "members";
        const updateFields: any = {};
        if (!existing.gender && genderOption) {
          updateFields.gender = genderOption;
        }
        if (statusOption === "Present") {
          updateFields.currentStatus = "Present";
          updateFields.lastAttendanceDate = targetDate;
        }
        if (Object.keys(updateFields).length > 0) {
          await db.collection(collectionName).updateOne({ id: personId }, { $set: updateFields });
        }
      }

      // 2. Insert attendance record for specific Date if present state and not duplicated
      if (statusOption === "Present") {
        const checkDup = await db.collection("attendance").findOne({
          date: targetDate,
          personId: personId
        });

        if (!checkDup) {
          await db.collection("attendance").insertOne({
            id: generateId(),
            date: targetDate,
            personId,
            personType: resolvedType,
            firstName: item.firstName.trim(),
            lastName: item.lastName.trim(),
            whatsAppNumber: phoneNum,
            gender: genderOption || (existing ? existing.gender : "") || "",
            timestamp: new Date().toISOString()
          });
          attendanceCount++;
        }
      }
    }

    await addAuditLog(
      adminId || "unknown",
      adminEmail || "admin@church.org",
      `Bulk imported ${attendees.length} attendance records`
    );

    res.json({
      success: true,
      createdCount,
      attendanceCount,
      message: `Import complete. Created ${createdCount} new profiles and logged ${attendanceCount} Sunday attendance entries.`
    });
  } catch (err: any) {
    console.error("Bulk attendance import error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Admin-triggered real-time attendance quick toggle
app.post("/api/attendance/toggle", requireSubscription, async (req, res) => {
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
app.get("/api/dashboard/stats", requireSubscription, async (req, res) => {
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
    let malePresent = 0;
    let femalePresent = 0;

    attendance.forEach((rec: any) => {
      if (rec.personType === "worker") {
        workersPresent++;
      } else {
        membersPresent++;
      }
      
      if (rec.gender === "Male") {
        malePresent++;
      } else if (rec.gender === "Female") {
        femalePresent++;
      }
    });

    // Calculate total gender demographics from registered rosters
    let totalMale = 0;
    let totalFemale = 0;
    members.forEach((m: any) => {
      if (m.gender === "Male") totalMale++;
      else if (m.gender === "Female") totalFemale++;
    });
    workers.forEach((w: any) => {
      if (w.gender === "Male") totalMale++;
      else if (w.gender === "Female") totalFemale++;
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
      totalMale,
      totalFemale,
      malePresent,
      femalePresent,
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
app.get("/api/members", requireSubscription, async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("members").find({}, { projection: { _id: 0 } }).toArray();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/members", requireSubscription, async (req, res) => {
  try {
    const { firstName, lastName, whatsAppNumber, currentStatus, lastAttendanceDate, adminEmail, adminId, notes, gender } = req.body;
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
      gender: gender || "",
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

app.put("/api/members/:id", requireSubscription, async (req, res) => {
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

app.delete("/api/members/:id", requireSubscription, async (req, res) => {
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
app.get("/api/workers", requireSubscription, async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("workers").find({}, { projection: { _id: 0 } }).toArray();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/workers", requireSubscription, async (req, res) => {
  try {
    const { firstName, lastName, whatsAppNumber, currentStatus, lastAttendanceDate, adminEmail, adminId, notes, gender } = req.body;
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
      gender: gender || "",
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

app.put("/api/workers/:id", requireSubscription, async (req, res) => {
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

app.delete("/api/workers/:id", requireSubscription, async (req, res) => {
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
app.get("/api/attendance", requireSubscription, async (req, res) => {
  try {
    const db = await getDb();
    const records = await db.collection("attendance").find({}, { projection: { _id: 0 } }).toArray();
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Admin list
app.get("/api/admins", requireSubscription, async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("admins").find({}, { projection: { _id: 0 } }).toArray();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Admin role mapping
app.post("/api/admins", requireSubscription, async (req, res) => {
  try {
    const { id, email, role, password, adminEmail, adminId } = req.body;
    if (!email || !role) {
      return res.status(400).json({ error: "Missing parameters: email and role are required." });
    }
    const db = await getDb();
    const emailLower = email.trim().toLowerCase();
    
    let adminUniqueId = id;
    if (!adminUniqueId) {
      // Find if email already exists in admins
      const existing = await db.collection("admins").findOne({ email: emailLower });
      if (existing) {
        adminUniqueId = existing.id;
      } else {
        adminUniqueId = generateId();
      }
    }

    const updatePayload: any = {
      id: adminUniqueId,
      email: emailLower,
      role,
    };

    if (password) {
      updatePayload.password = password;
    } else {
      // Check existing admin document's password
      const existingAdmin = await db.collection("admins").findOne({ id: adminUniqueId });
      if (!existingAdmin || !existingAdmin.password) {
        updatePayload.password = "admin123"; // Default fallback
      }
    }
    
    await db.collection("admins").updateOne(
      { id: adminUniqueId },
      {
        $set: updatePayload
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
app.delete("/api/admins/:id", requireSubscription, async (req, res) => {
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
app.get("/api/sundays", requireSubscription, async (req, res) => {
  try {
    const list = await getAllServiceSundays();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST to ADD a custom Sunday Date manual definition
app.post("/api/sundays", requireSubscription, async (req, res) => {
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
app.delete("/api/sundays/:date", requireSubscription, async (req, res) => {
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

// ==========================================
// QUICK REPLY TEMPLATES ENDPOINTS
// ==========================================

// GET all Quick Replies (Seed with 5 default options if collection is empty)
app.get("/api/quick-replies", requireSubscription, async (req, res) => {
  try {
    const db = await getDb();
    let replies = await db.collection("quick_replies").find({}, { projection: { _id: 0 } }).toArray();
    
    if (replies.length === 0) {
      const defaultReplies = [
        {
          id: "qr_welcome",
          title: "Welcome Greeting",
          content: "Hello {name}, welcome to our church family! We are thrilled to have you. Please feel free to reach out if you have any questions or prayer requests."
        },
        {
          id: "qr_timings",
          title: "Service Timings",
          content: "Hi {name}! Our services hold every Sunday: First Service starts at 8:00 AM, Second Service at 10:30 AM. Midweek Word Cafe is every Wednesday at 6:00 PM. See you soon!"
        },
        {
          id: "qr_prayer",
          title: "Prayer Request Support",
          content: "Dear {name}, we stand in faith with you. Please reply with your prayer requests so our pastors and intercessors can pray for you. 'The effective prayer of a righteous person has great power.'"
        },
        {
          id: "qr_tithing",
          title: "Tithes & Offerings Guidance",
          content: "Greetings {name}, thank you for your generosity in supporting God's work. You can give online via our secure platform or text giving. May God multiply your seed sown!"
        },
        {
          id: "qr_absentee",
          title: "Absentee Follow-up Inquiry",
          content: "Hello {name}, we missed you at our service last Sunday! Hope you are doing well. Let us know if you need any prayers or support."
        }
      ];
      await db.collection("quick_replies").insertMany(defaultReplies);
      replies = defaultReplies;
    }
    
    res.json(replies);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST to ADD or UPDATE a Quick Reply
app.post("/api/quick-replies", requireSubscription, async (req, res) => {
  try {
    const { id, title, content, adminEmail, adminId } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required for Quick Reply templates." });
    }
    
    const db = await getDb();
    const qrId = id || "qr_" + generateId();
    
    await db.collection("quick_replies").updateOne(
      { id: qrId },
      {
        $set: {
          id: qrId,
          title,
          content,
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );
    
    await addAuditLog(
      adminId || "unknown",
      adminEmail || "admin@church.org",
      id ? `Updated Quick Reply template: "${title}"` : `Created Quick Reply template: "${title}"`
    );
    
    res.json({ success: true, id: qrId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a Quick Reply
app.delete("/api/quick-replies/:id", requireSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const { adminEmail, adminId } = req.body;
    const db = await getDb();
    
    const qr = await db.collection("quick_replies").findOne({ id });
    const qrTitle = qr ? qr.title : "Unknown";
    
    await db.collection("quick_replies").deleteOne({ id });
    
    await addAuditLog(
      adminId || "unknown",
      adminEmail || "admin@church.org",
      `Deleted Quick Reply template: "${qrTitle}"`
    );
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Backup Status Metadata
app.get("/api/backup/status", requireSubscription, async (req, res) => {
  try {
    const db = await getDb();
    const statusDoc = await db.collection("settings").findOne({ id: "backup_status" });
    
    if (!statusDoc) {
      return res.json({
        lastBackupDate: null,
        daysSinceLastBackup: null,
        isOverdue: true
      });
    }
    
    const lastBackupDate = statusDoc.lastBackupDate;
    const diffMs = Date.now() - new Date(lastBackupDate).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    res.json({
      lastBackupDate,
      daysSinceLastBackup: diffDays,
      isOverdue: diffDays > 7
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET system audit logs
app.get("/api/audit-logs", requireSubscription, async (req, res) => {
  try {
    const db = await getDb();
    const logs = await db.collection("audit_logs").find({}, { projection: { _id: 0 } }).sort({ timestamp: -1 }).toArray();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// WhatsApp settings
app.get("/api/whatsapp/config", requireSubscription, async (req, res) => {
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

app.post("/api/whatsapp/config", requireSubscription, async (req, res) => {
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
app.get("/api/whatsapp/logs", requireSubscription, async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection("whatsapp_logs").find({}, { projection: { _id: 0 } }).sort({ sentAt: -1 }).toArray();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Backup Database (direct download format)
app.get("/api/backup/export", requireSubscription, async (req, res) => {
  try {
    const collections = ["members", "workers", "attendance", "whatsapp_logs", "settings", "admins", "audit_logs"];
    const backup: any = {};
    const db = await getDb();

    for (const col of collections) {
      backup[col] = await db.collection(col).find({}, { projection: { _id: 0 } }).toArray();
    }

    // Save successful backup status
    await db.collection("settings").updateOne(
      { id: "backup_status" },
      { $set: { id: "backup_status", lastBackupDate: new Date().toISOString() } },
      { upsert: true }
    );

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
app.post("/api/whatsapp/resend", requireSubscription, async (req, res) => {
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

// Send Custom WhatsApp message (Dynamic Quick Reply)
app.post("/api/whatsapp/send-custom", requireSubscription, async (req, res) => {
  try {
    const { personId, personType, personName, whatsAppNumber, messageContent, adminEmail, adminId } = req.body;
    
    if (!whatsAppNumber || !messageContent) {
      return res.status(400).json({ error: "Missing required WhatsApp number or message content." });
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
        throw new Error("Meta credentials missing - falling back to manual");
      }
    } catch (sendErr: any) {
      console.error("Meta sending error during custom dispatch:", sendErr);
      deliveryStatus = "Failed";
      errorMessage = sendErr.message;
    }

    const logId = generateId();
    await db.collection("whatsapp_logs").insertOne({
      id: logId,
      personId: personId || "adhoc_recipient",
      personName: personName || "Adhoc Recipient",
      personType: personType || "Adhoc",
      whatsAppNumber,
      messageType: "Quick Reply Template",
      messageContent,
      sentAt: new Date().toISOString(),
      deliveryStatus,
      wamid,
    });

    if (personId && personId !== "adhoc_recipient") {
      const personCol = personType === "worker" ? "workers" : "members";
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
    }

    await addAuditLog(
      adminId || "unknown", 
      adminEmail || "admin@church.org", 
      `Dispatched Quick Reply message to ${personName || whatsAppNumber} (${whatsAppNumber})`
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

  // Compare today's Sunday Experience attendance with previous Sunday's Sunday Experience attendance
  const [prevAtt, todayAtt] = await Promise.all([
    db.collection("attendance").find({ date: prevSun, eventType: "Sunday Experience" }, { projection: { _id: 0 } }).toArray(),
    db.collection("attendance").find({ date: todaySun, eventType: "Sunday Experience" }, { projection: { _id: 0 } }).toArray(),
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
    let errMessage = "";

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
      errMessage = err.message;
      failedCount++;
    }

    const now = new Date();
    const dateSentStr = now.toISOString().split("T")[0];
    const timeSentStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

    await db.collection("whatsapp_logs").insertOne({
      id: generateId(),
      personId: person.personId,
      personName: `${person.firstName} ${person.lastName}`,
      personType: person.personType,
      whatsAppNumber: person.whatsAppNumber,
      messageContent: messageText,
      sentAt: now.toISOString(),
      dateSent: dateSentStr,
      timeSent: timeSentStr,
      deliveryStatus,
      readStatus: "Unread",
      messageStatus: deliveryStatus,
      messageType: "Sunday Absentee Follow-Up",
      failedStatus: deliveryStatus === "Failed" ? (errMessage || "Transmission failed.") : "",
      wamid,
    });

    await db.collection(personCol).updateOne(
      { id: person.personId },
      {
        $set: {
          currentStatus: "Absent",
          attendedAtTime: null,
          messageSent: true,
          messageSentDate: now.toISOString(),
          messageDeliveryStatus: deliveryStatus,
        }
      }
    );

    executionLogs.push({
      name: `${person.firstName} ${person.lastName}`,
      status: deliveryStatus,
      phone: person.whatsAppNumber,
      error: deliveryStatus === "Failed" ? (errMessage || "Meta API config missing or transmission failed.") : null,
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

// Core Saturday Encouragement Runner Function
async function executeSaturdayEncouragement(): Promise<{ processedCount: number; failedCount: number; logs: any[] }> {
  console.log("Triggering Saturday 6:00 PM Encouragement transmission...");
  
  const db = await getDb();
  const config = await db.collection("settings").findOne({ id: "whatsapp_config" }, { projection: { _id: 0 } });

  const [allMembers, allWorkers] = await Promise.all([
    db.collection("members").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection("workers").find({}, { projection: { _id: 0 } }).toArray(),
  ]);

  const targetList: Array<{
    id: string;
    personType: "member" | "worker";
    firstName: string;
    lastName: string;
    whatsAppNumber: string;
  }> = [];

  allMembers.forEach((m: any) => {
    targetList.push({
      id: m.id,
      personType: "member",
      firstName: m.firstName,
      lastName: m.lastName,
      whatsAppNumber: m.whatsAppNumber,
    });
  });

  allWorkers.forEach((w: any) => {
    targetList.push({
      id: w.id,
      personType: "worker",
      firstName: w.firstName,
      lastName: w.lastName,
      whatsAppNumber: w.whatsAppNumber,
    });
  });

  const msgBody = "Happy Weekend from House of Glory. We are excited to worship with you tomorrow at Sunday Experience. Come expectant and invite someone. We look forward to seeing you in God's presence. God bless you.";

  let processedCount = 0;
  let failedCount = 0;
  const executionLogs: any[] = [];

  for (const person of targetList) {
    if (!person.whatsAppNumber) continue;
    
    const personCol = person.personType === "worker" ? "workers" : "members";
    let deliveryStatus: "Sent" | "Failed" = "Sent";
    let wamid = null;
    let errMessage = "";

    try {
      if (config && config.phoneNumberId && config.accessToken) {
        const result = await sendWhatsAppMessage(config, person.whatsAppNumber, msgBody);
        wamid = result.messages?.[0]?.id || null;
        processedCount++;
      } else {
        throw new Error("Meta credentials are not configured in system settings.");
      }
    } catch (err: any) {
      console.error(`Failed to send automated Saturday Encouragement to ${person.whatsAppNumber}:`, err.message);
      deliveryStatus = "Failed";
      errMessage = err.message;
      failedCount++;
    }

    const now = new Date();
    const dateSentStr = now.toISOString().split("T")[0];
    const timeSentStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

    await db.collection("whatsapp_logs").insertOne({
      id: generateId(),
      personId: person.id,
      personName: `${person.firstName} ${person.lastName}`,
      personType: person.personType,
      whatsAppNumber: person.whatsAppNumber,
      messageContent: msgBody,
      sentAt: now.toISOString(),
      dateSent: dateSentStr,
      timeSent: timeSentStr,
      deliveryStatus,
      readStatus: "Unread",
      messageStatus: deliveryStatus,
      messageType: "Saturday Encouragement",
      failedStatus: deliveryStatus === "Failed" ? (errMessage || "Transmission failed.") : "",
      wamid,
    });

    await db.collection(personCol).updateOne(
      { id: person.id },
      {
        $set: {
          messageSent: true,
          messageSentDate: now.toISOString(),
          messageDeliveryStatus: deliveryStatus,
        }
      }
    );

    executionLogs.push({
      name: `${person.firstName} ${person.lastName}`,
      status: deliveryStatus,
      phone: person.whatsAppNumber,
      error: deliveryStatus === "Failed" ? (errMessage || "Transmission failed.") : null,
    });
  }

  return { processedCount, failedCount, logs: executionLogs };
}

// Core Wednesday Reminder Runner Function
async function executeWednesdayReminders(): Promise<{ processedCount: number; failedCount: number; logs: any[] }> {
  console.log("Triggering Wednesday 10:00 AM Word Cafe transmission...");
  
  const db = await getDb();
  const config = await db.collection("settings").findOne({ id: "whatsapp_config" }, { projection: { _id: 0 } });

  const [allMembers, allWorkers] = await Promise.all([
    db.collection("members").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection("workers").find({}, { projection: { _id: 0 } }).toArray(),
  ]);

  const targetList: Array<{
    id: string;
    personType: "member" | "worker";
    firstName: string;
    lastName: string;
    whatsAppNumber: string;
  }> = [];

  allMembers.forEach((m: any) => {
    targetList.push({
      id: m.id,
      personType: "member",
      firstName: m.firstName,
      lastName: m.lastName,
      whatsAppNumber: m.whatsAppNumber,
    });
  });

  allWorkers.forEach((w: any) => {
    targetList.push({
      id: w.id,
      personType: "worker",
      firstName: w.firstName,
      lastName: w.lastName,
      whatsAppNumber: w.whatsAppNumber,
    });
  });

  const msgBody = "Good morning and God bless you. Join us today for Word Cafe (Bible Study) as we study God's Word together and grow in faith. We look forward to seeing you. God bless you.";

  let processedCount = 0;
  let failedCount = 0;
  const executionLogs: any[] = [];

  for (const person of targetList) {
    if (!person.whatsAppNumber) continue;

    const personCol = person.personType === "worker" ? "workers" : "members";
    let deliveryStatus: "Sent" | "Failed" = "Sent";
    let wamid = null;
    let errMessage = "";

    try {
      if (config && config.phoneNumberId && config.accessToken) {
        const result = await sendWhatsAppMessage(config, person.whatsAppNumber, msgBody);
        wamid = result.messages?.[0]?.id || null;
        processedCount++;
      } else {
        throw new Error("Meta credentials are not configured in system settings.");
      }
    } catch (err: any) {
      console.error(`Failed to send automated Wednesday reminder to ${person.whatsAppNumber}:`, err.message);
      deliveryStatus = "Failed";
      errMessage = err.message;
      failedCount++;
    }

    const now = new Date();
    const dateSentStr = now.toISOString().split("T")[0];
    const timeSentStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

    await db.collection("whatsapp_logs").insertOne({
      id: generateId(),
      personId: person.id,
      personName: `${person.firstName} ${person.lastName}`,
      personType: person.personType,
      whatsAppNumber: person.whatsAppNumber,
      messageContent: msgBody,
      sentAt: now.toISOString(),
      dateSent: dateSentStr,
      timeSent: timeSentStr,
      deliveryStatus,
      readStatus: "Unread",
      messageStatus: deliveryStatus,
      messageType: "Wednesday Word Cafe Reminder",
      failedStatus: deliveryStatus === "Failed" ? (errMessage || "Transmission failed.") : "",
      wamid,
    });

    await db.collection(personCol).updateOne(
      { id: person.id },
      {
        $set: {
          messageSent: true,
          messageSentDate: now.toISOString(),
          messageDeliveryStatus: deliveryStatus,
        }
      }
    );

    executionLogs.push({
      name: `${person.firstName} ${person.lastName}`,
      status: deliveryStatus,
      phone: person.whatsAppNumber,
      error: deliveryStatus === "Failed" ? (errMessage || "Transmission failed.") : null,
    });
  }

  return { processedCount, failedCount, logs: executionLogs };
}

// Dynamic trigger for developers/Admins to instantly test Sunday follow-ups
app.post("/api/whatsapp/trigger-sunday-followup", requireSubscription, async (req, res) => {
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

// Dynamic trigger to instantly test Saturday encouragement
app.post("/api/whatsapp/trigger-saturday", requireSubscription, async (req, res) => {
  try {
    const { adminEmail, adminId } = req.body;
    const result = await executeSaturdayEncouragement();

    await addAuditLog(
      adminId || "system",
      adminEmail || "admin@church.org",
      `Explicitly triggered automated Saturday encouragement campaign. Sent: ${result.processedCount}, Failed: ${result.failedCount}`
    );

    res.json({
      success: true,
      processedCount: result.processedCount,
      failedCount: result.failedCount,
      logs: result.logs,
      message: "Saturday encouragement campaign check complete."
    });
  } catch (err: any) {
    console.error("Manual Saturday trigger exception:", err);
    res.status(500).json({ error: err.message });
  }
});

// Dynamic trigger to instantly test Wednesday reminders
app.post("/api/whatsapp/trigger-wednesday", requireSubscription, async (req, res) => {
  try {
    const { adminEmail, adminId } = req.body;
    const result = await executeWednesdayReminders();

    await addAuditLog(
      adminId || "system",
      adminEmail || "admin@church.org",
      `Explicitly triggered automated Wednesday Word Cafe reminders. Sent: ${result.processedCount}, Failed: ${result.failedCount}`
    );

    res.json({
      success: true,
      processedCount: result.processedCount,
      failedCount: result.failedCount,
      logs: result.logs,
      message: "Wednesday Word Cafe reminder campaign check complete."
    });
  } catch (err: any) {
    console.error("Manual Wednesday trigger exception:", err);
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
app.post("/api/whatsapp/send-message-proxy", requireSubscription, async (req, res) => {
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
// EMAIL NOTIFICATION SYSTEM (Nodemailer Service)
// ==========================================

async function sendWeeklyEmailSummary(dateStr: string): Promise<{ success: boolean; message: string; leaderEmails?: string }> {
  const db = await getDb();
  const config = await db.collection("settings").findOne({ id: "email_config" }, { projection: { _id: 0 } });
  
  if (!config || !config.enabled) {
    return { success: false, message: "Email notifications are disabled or SMTP settings have not been configured." };
  }
  
  const smtpHost = config.smtpHost;
  const smtpPort = Number(config.smtpPort) || 587;
  const smtpSecure = config.smtpSecure !== undefined ? config.smtpSecure : false;
  const smtpAuthUser = config.smtpAuthUser;
  const smtpAuthPass = config.smtpAuthPass;
  const senderEmail = config.senderEmail || "Church Portal <no-reply@church.org>";
  const leaderEmails = config.leaderEmails;
  
  if (!smtpHost || !smtpAuthUser || !smtpAuthPass || !leaderEmails) {
    return { success: false, message: "SMTP configuration is incomplete. Host, user, password, and leader emails are required." };
  }

  // Fetch roster & attendance for specific Sunday
  const [members, workers, attendance] = await Promise.all([
    db.collection("members").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection("workers").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection("attendance").find({ date: dateStr }, { projection: { _id: 0 } }).toArray()
  ]);

  const totalMembers = members.length;
  const totalWorkers = workers.length;
  const totalRoster = totalMembers + totalWorkers;

  const presentIds = new Set(attendance.map((rec: any) => rec.personId));
  
  const presentMembers = attendance.filter((rec: any) => rec.personType === "member");
  const presentWorkers = attendance.filter((rec: any) => rec.personType === "worker");
  
  const absentMembersList = members.filter((m: any) => !presentIds.has(m.id));
  const absentWorkersList = workers.filter((w: any) => !presentIds.has(w.id));

  const countPresentMembers = presentMembers.length;
  const countPresentWorkers = presentWorkers.length;
  const countTotalPresent = attendance.length;

  const countAbsentMembers = absentMembersList.length;
  const countAbsentWorkers = absentWorkersList.length;
  const countTotalAbsent = countAbsentMembers + countAbsentWorkers;

  const attendancePercentage = totalRoster > 0 ? Math.round((countTotalPresent / totalRoster) * 100) : 0;

  // Breakdown by event/service
  const eventBreakdown: Record<string, number> = {};
  attendance.forEach((rec: any) => {
    const et = rec.eventType || "Sunday Experience";
    eventBreakdown[et] = (eventBreakdown[et] || 0) + 1;
  });

  let eventRows = "";
  Object.entries(eventBreakdown).forEach(([name, count]) => {
    eventRows += `
      <tr>
        <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #475569;">${name}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: bold; color: #0f172a;">${count} Present</td>
      </tr>
    `;
  });

  if (!eventRows) {
    eventRows = `<tr><td colspan="2" style="padding: 15px; text-align: center; color: #94a3b8; font-style: italic;">No session entries recorded.</td></tr>`;
  }

  // Inline formatting helper
  const renderEmailList = (list: any[]) => {
    if (list.length === 0) return `<p style="color: #94a3b8; font-style: italic; font-size: 13px; margin: 5px 0 0 0;">(None recorded)</p>`;
    const maxShow = 15;
    const displayed = list.slice(0, maxShow);
    const hiddenCount = list.length - displayed.length;
    let html = `<ul style="margin: 6px 0 0 0; padding-left: 20px; color: #334155; font-size: 13px; line-height: 1.5;">`;
    displayed.forEach((p) => {
      const displayRole = p.role || p.personType || "";
      const roleBadge = displayRole ? ` <span style="font-size: 10px; color: #64748b; background-color: #f1f5f9; padding: 2px 5px; border-radius: 4px;">${displayRole}</span>` : "";
      html += `<li style="margin-bottom: 5px;"><strong>${p.firstName} ${p.lastName}</strong>${roleBadge}</li>`;
    });
    html += `</ul>`;
    if (hiddenCount > 0) {
      html += `<p style="font-size: 12px; color: #6366f1; font-weight: bold; margin: 5px 0 0 20px;">+ ${hiddenCount} more individuals...</p>`;
    }
    return html;
  };

  const presentHtml = renderEmailList([...presentMembers, ...presentWorkers]);
  const absentHtml = renderEmailList([...absentMembersList, ...absentWorkersList]);

  // Modern response HTML Layout
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Church Attendance Dashboard Summary</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px 10px; margin: 0; -webkit-font-smoothing: antialiased;">
      <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        
        <!-- Header banner -->
        <div style="background-color: #4f46e5; padding: 30px; text-align: center; color: #ffffff;">
          <span style="font-size: 32px; display: block; margin-bottom: 8px;">⛪</span>
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.025em;">Church Weekly Attendance Report</h1>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #c7d2fe; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase;">Service Date: ${dateStr}</p>
        </div>

        <!-- content body -->
        <div style="padding: 25px 30px;">
          <p style="margin-top: 0; font-size: 15px; line-height: 1.6; color: #334155;">
            Dear Pastor and Leadership Team,
          </p>
          <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 25px;">
            Here is the automated weekly church service enrollment and follow-up report compiled for <strong>${dateStr}</strong>. This system tracking assures precise database coverage.
          </p>

          <!-- Core stats table cards -->
          <table style="width: 100%; border-spacing: 12px; border-collapse: separate; margin: 0 -12px 20px -12px;">
            <tr>
              <td style="width: 50%; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 15px; text-align: center; vertical-align: middle;">
                <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #065f46; font-weight: bold; display: block; margin-bottom: 4px;">Total Present</span>
                <strong style="font-size: 28px; color: #047857; display: block;">${countTotalPresent}</strong>
                <span style="font-size: 11px; color: #065f46; margin-top: 2px; display: block;">${countPresentMembers} Members • ${countPresentWorkers} Workers</span>
              </td>
              <td style="width: 50%; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 15px; text-align: center; vertical-align: middle;">
                <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #991b1b; font-weight: bold; display: block; margin-bottom: 4px;">Total Absent</span>
                <strong style="font-size: 28px; color: #b91c1c; display: block;">${countTotalAbsent}</strong>
                <span style="font-size: 11px; color: #991b1b; margin-top: 2px; display: block;">${countAbsentMembers} Members • ${countAbsentWorkers} Workers</span>
              </td>
            </tr>
          </table>

          <!-- Roster Metric Overview Progress -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 25px;">
            <strong style="font-size: 14px; color: #0f172a; display: block; margin-bottom: 6px;">Total Database Base Coverage:</strong>
            <div style="color: #475569; font-size: 13px; margin-bottom: 8px;">
              Registered congregation size: <strong>${totalRoster}</strong> (Members: ${totalMembers}, Workers: ${totalWorkers})
            </div>
            
            <!-- Progress Bar -->
            <div style="background-color: #e2e8f0; height: 10px; border-radius: 5px; overflow: hidden; margin-bottom: 4px;">
              <div style="background-color: #10b981; width: ${attendancePercentage}%; height: 100%; border-radius: 5px;"></div>
            </div>
            <div style="text-align: right; font-size: 12px; font-weight: bold; color: #059669;">
               Attendance Rate: ${attendancePercentage}%
            </div>
          </div>

          <!-- Section: Breakdown by Event / Service -->
          <h3 style="font-size: 15px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 0; margin-bottom: 12px;">⏰ Service Program Breakdowns</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 25px;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left;">
                <th style="padding: 10px; color: #64748b; font-weight: bold;">Program Type</th>
                <th style="padding: 10px; text-align: right; color: #64748b; font-weight: bold;">Present Tally</th>
              </tr>
            </thead>
            <tbody>
              ${eventRows}
            </tbody>
          </table>

          <!-- Section: Lists breakdown -->
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 50%; vertical-align: top; padding-right: 15px; border-right: 1px solid #e2e8f0;">
                <h4 style="font-size: 13px; font-weight: bold; color: #10b981; margin-top: 0; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em;">
                  🟢 Present Entries (${countTotalPresent})
                </h4>
                ${presentHtml}
              </td>
              <td style="width: 50%; vertical-align: top; padding-left: 15px;">
                <h4 style="font-size: 13px; font-weight: bold; color: #ef4444; margin-top: 0; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em;">
                  🔴 Absent Entries (${countTotalAbsent})
                </h4>
                ${absentHtml}
              </td>
            </tr>
          </table>

        </div>

        <!-- Footer -->
        <div style="background-color: #f1f5f9; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
          <p style="margin: 0 0 5px 0; font-weight: bold; color: #475569;">Attendance Administration Portal - Backups System</p>
          <p style="margin: 0; font-size: 11px; line-height: 1.4;">
            This communication was sent automatically based on active weekly scheduler rules. If you wish to adjust SMTP settings or unsubscribe leader emails, please modify settings in the Church Portal Settings panel.
          </p>
        </div>

      </div>
    </body>
    </html>
  `;

  // Establish nodemailer transporter
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort) || 587,
    secure: !!smtpSecure,
    auth: {
      user: smtpAuthUser,
      pass: smtpAuthPass
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000
  });

  const mailOptions = {
    from: senderEmail,
    to: leaderEmails,
    subject: `📊 Attendance Report Summary: ${dateStr} (${attendancePercentage}% Rate)`,
    html: htmlBody
  };

  await transporter.sendMail(mailOptions);
  return { success: true, message: `Weekly email report successfully delivered to: ${leaderEmails}`, leaderEmails };
}

// EMAIL EXPRESS ENDPOINTS
app.get("/api/email/config", requireSubscription, async (req, res) => {
  try {
    const db = await getDb();
    const doc = await db.collection("settings").findOne({ id: "email_config" }, { projection: { _id: 0 } });
    if (doc) {
      res.json({
        smtpHost: doc.smtpHost || "",
        smtpPort: doc.smtpPort || 587,
        smtpSecure: doc.smtpSecure !== undefined ? doc.smtpSecure : false,
        smtpAuthUser: doc.smtpAuthUser || "",
        smtpAuthPass: doc.smtpAuthPass || "",
        senderEmail: doc.senderEmail || "Church Portal <no-reply@church.org>",
        leaderEmails: doc.leaderEmails || "",
        enabled: doc.enabled !== undefined ? doc.enabled : false,
      });
    } else {
      res.json({
        smtpHost: "",
        smtpPort: 587,
        smtpSecure: false,
        smtpAuthUser: "",
        smtpAuthPass: "",
        senderEmail: "Church Portal <no-reply@church.org>",
        leaderEmails: "",
        enabled: false,
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/email/config", requireSubscription, async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpSecure, smtpAuthUser, smtpAuthPass, senderEmail, leaderEmails, enabled, adminEmail, adminId } = req.body;
    const db = await getDb();

    await db.collection("settings").updateOne(
      { id: "email_config" },
      {
        $set: {
          id: "email_config",
          smtpHost: smtpHost || "",
          smtpPort: Number(smtpPort) || 587,
          smtpSecure: !!smtpSecure,
          smtpAuthUser: smtpAuthUser || "",
          smtpAuthPass: smtpAuthPass || "",
          senderEmail: senderEmail || "Church Portal <no-reply@church.org>",
          leaderEmails: leaderEmails || "",
          enabled: !!enabled,
        }
      },
      { upsert: true }
    );

    await addAuditLog(
      adminId || "unknown",
      adminEmail || "admin@church.org",
      `Configured automated weekly leadership email notifications (SMTP Host: ${smtpHost || 'N/A'}, Enabled: ${!!enabled})`
    );

    res.json({ success: true, message: "Email configuration saved securely." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/email/send-test-email", requireSubscription, async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpSecure, smtpAuthUser, smtpAuthPass, senderEmail, leaderEmails, adminId, adminEmail } = req.body;
    if (!smtpHost || !smtpAuthUser || !smtpAuthPass || !leaderEmails) {
      return res.status(400).json({ error: "Missing required SMTP parameters or leader email recipients." });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort) || 587,
      secure: !!smtpSecure,
      auth: {
        user: smtpAuthUser,
        pass: smtpAuthPass
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000
    });

    const mailOptions = {
      from: senderEmail || "Church Portal <no-reply@church.org>",
      to: leaderEmails,
      subject: "🔔 Church Attendance Management System - SMTP Test Email",
      html: `
        <div style="font-family: sans-serif; padding: 25px; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <h2 style="color: #4f46e5; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-top: 0;">Connection Successful!</h2>
          <p>Hello Church Leader,</p>
          <p>This is a verification notification confirming that the **SMTP Email notification service** for your Church Attendance Portal is configured correctly and successfully connected to your servers.</p>
          <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 15px; margin: 20px 0; border-radius: 6px; font-size: 14px;">
            <strong style="color: #1e293b; display: block; margin-bottom: 5px;">Verification Parameters:</strong>
            • SMTP Host: <code style="background-color: #e2e8f0; padding: 2px 4px; border-radius: 4px; font-family: monospace;">${smtpHost}</code><br/>
            • Connection Port: <code style="background-color: #e2e8f0; padding: 2px 4px; border-radius: 4px; font-family: monospace;">${smtpPort}</code><br/>
            • Sender Authorized User: <code style="background-color: #e2e8f0; padding: 2px 4px; border-radius: 4px; font-family: monospace;">${smtpAuthUser}</code>
          </div>
          <p style="font-size: 13px; color: #64748b; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 15px;">
            This verification email was triggered manually by church administrator <strong>${adminEmail || "Admin"}</strong>. All stats look great and are ready for dissemination.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    
    await addAuditLog(
      adminId || "unknown",
      adminEmail || "admin@church.org",
      `Dispatched temporary SMTP connection test communication mail to ${leaderEmails}`
    );

    res.json({ success: true, message: `Verification test email sent to ${leaderEmails} successfully!` });
  } catch (err: any) {
    console.error("Test email failure details:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/email/trigger-weekly-report", requireSubscription, async (req, res) => {
  try {
    const { date, adminId, adminEmail } = req.body;
    const targetDate = date || getSundayOfDate(new Date());
    
    console.log(`Manual trigger of weekly email attendance summary for date: ${targetDate}`);
    const result = await sendWeeklyEmailSummary(targetDate);
    
    if (result.success) {
      await addAuditLog(
        adminId || "unknown",
        adminEmail || "admin@church.org",
        `Dispatched weekly church attendance summary email to leaders for Sunday ${targetDate}`
      );
      res.json({ success: true, message: result.message, leaderEmails: result.leaderEmails });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (err: any) {
    console.error("Manual report trigger exception:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// BACKUP HEALTH & AUTOMATED NOTIFICATION SERVICE
// ==========================================

async function checkBackupStatusAndAlert() {
  try {
    const db = await getDb();
    const backupDoc = await db.collection("settings").findOne({ id: "backup_status" });
    const emailConfig = await db.collection("settings").findOne({ id: "email_config" });
    
    if (!emailConfig) {
      console.log("[Backup Checker] No email config is defined in Settings. Skipping backup alert dispatch.");
      return { success: false, message: "SMTP details missing in Settings." };
    }
    
    const smtpHost = emailConfig.smtpHost;
    const smtpPort = Number(emailConfig.smtpPort) || 587;
    const smtpSecure = emailConfig.smtpSecure !== undefined ? emailConfig.smtpSecure : false;
    const smtpAuthUser = emailConfig.smtpAuthUser;
    const smtpAuthPass = emailConfig.smtpAuthPass;
    const senderEmail = emailConfig.senderEmail || "Church Portal <no-reply@church.org>";

    if (!smtpHost || !smtpAuthUser || !smtpAuthPass) {
      console.log("[Backup Checker] SMTP criteria incomplete. Skipping backup warning email dispatch.");
      return { success: false, message: "SMTP configuration incomplete." };
    }

    let overdue = false;
    let lastBackupDate: string | null = null;
    
    if (!backupDoc) {
      overdue = true;
    } else {
      lastBackupDate = backupDoc.lastBackupDate ? String(backupDoc.lastBackupDate) : null;
      if (!lastBackupDate) {
        overdue = true;
      } else {
        const diffMs = Date.now() - new Date(lastBackupDate).getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays > 7) {
          overdue = true;
        }
      }
    }

    if (overdue) {
      console.log("[Backup Checker] Database backup is OVERDUE! dispatching alert warning email to Super Admins...");
      
      const admins = await db.collection("admins").find({ role: "Super Admin" }).toArray();
      const adminEmails = new Set<string>();
      
      admins.forEach((admin: any) => {
        if (admin.email) adminEmails.add(admin.email);
      });
      // Always include bootstrapped super admin as fallback recipient
      adminEmails.add("fidelisemus@gmail.com");

      const recipients = Array.from(adminEmails);

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpAuthUser,
          pass: smtpAuthPass
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000
      });

      const lastBackupStr = lastBackupDate 
        ? `${new Date(lastBackupDate).toLocaleDateString()} at ${new Date(lastBackupDate).toLocaleTimeString()}`
        : "No database backup has EVER been taken!";

      const mailOptions = {
        from: senderEmail,
        to: recipients.join(", "),
        subject: "⚠️ ACTION REQUIRED: Church Portal Database Backup Overdue (7+ Days)",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fee2e2; border-radius: 16px; background-color: #fffbfa;">
            <div style="display: flex; align-items: center; margin-bottom: 20px;">
              <span style="font-size: 32px; margin-right: 12px;">🚨</span>
              <h2 style="color: #dc2626; margin: 0; font-size: 20px; font-weight: 800; font-family: sans-serif;">Church Portal: Database Backup Overdue</h2>
            </div>
            
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">Dear Super Administrator,</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">Our system security checker has detected that <strong>no successful database backup has been performed in the last 7 days</strong>.</p>
            
            <div style="background-color: #ffffff; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: bold; letter-spacing: 0.05em; margin-bottom: 4px;">Backup Status Overview</div>
              <div style="font-size: 14px; color: #1e293b; font-weight: 700;">
                \${lastBackupStr}
              </div>
              <div style="font-size: 12px; color: #ef4444; font-weight: 600; margin-top: 6px;">
                Status: Overdue (Maximum safety threshold is 7 days)
              </div>
            </div>
            
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px;">Regularly exporting backup files is vital to protect against unexpected server faults, data loss, and to maintain structural integrity of member directories and check-in logs.</p>
            
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="https://ais-pre-f3z75ujgomwegtwcwcpynd-50487580477.europe-west2.run.app/admin" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 24px; border-radius: 12px; border: none;">
                Sign In to Backup Now
              </a>
            </div>
            
            <p style="font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 30px;">
              This is a critical maintenance alert sent automatically to all active <strong>Super Admin</strong> profiles. 
              SMTP options can be customized dynamically in the Church Settings panel.
            </p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`[Backup Checker] SUCCESS: Overdue backup alert sent successfully to \${recipients.join(", ")}`);
      return { success: true, alerted: true, recipients };
    } else {
      console.log("[Backup Checker] Backup status is fully healthy. No alert required.");
      return { success: true, alerted: false };
    }
  } catch (err: any) {
    console.error("[Backup Checker] Failed checking backup overdue alerts:", err.message);
    return { success: false, error: err.message };
  }
}

app.post("/api/backup/check-manual", requireSubscription, async (req, res) => {
  try {
    const result = await checkBackupStatusAndAlert();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SCHEDULER (Cron Jobs)
// ==========================================

// Check database backup status once every day at 9:00 AM (0 9 * * *)
cron.schedule("0 9 * * *", async () => {
  try {
    console.log("[Automated Scheduler] Checking database backup frequency health...");
    await checkBackupStatusAndAlert();
  } catch (err) {
    console.error("Backup frequency schedule execution failed:", err);
  }
});

// Wednesday at exactly 10:00 AM (0 10 * * 3)
cron.schedule("0 10 * * 3", async () => {
  try {
    console.log("[Automated Scheduler] Triggering Wednesday 10:00 AM Word Cafe Reminders...");
    const result = await executeWednesdayReminders();
    console.log(`Automated Wednesday Reminders completed. Sent: ${result.processedCount}, Failed: ${result.failedCount}`);
  } catch (err) {
    console.error("Wednesday reminder CRON scheduler failed:", err);
  }
});

// Saturday at exactly 6:00 PM (0 18 * * 6)
cron.schedule("0 18 * * 6", async () => {
  try {
    console.log("[Automated Scheduler] Triggering Saturday 6:00 PM Encouragement transmission...");
    const result = await executeSaturdayEncouragement();
    console.log(`Automated Saturday Encouragement completed. Sent: ${result.processedCount}, Failed: ${result.failedCount}`);
  } catch (err) {
    console.error("Saturday encouragement CRON scheduler failed:", err);
  }
});

// Sunday at exactly 6:00 PM (0 18 * * 0)
cron.schedule("0 18 * * 0", async () => {
  try {
    const todaySun = getSundayOfDate(new Date());
    console.log("[Automated Scheduler] Triggering Sunday 6:00 PM Attendee comparison and follow-ups...");
    // Run WhatsApp follow-ups
    const result = await executeSundayFollowups();
    console.log(`Automated Sunday 6:00 PM CRON completed. Sent: ${result.processedCount}, Failed: ${result.failedCount}`);
    
    // Attempt Email Automated Summary to leaders as backup
    try {
      const emailResult = await sendWeeklyEmailSummary(todaySun);
      console.log(`Automated Weekly Email Report result: ${emailResult.message}`);
    } catch (emailErr: any) {
      console.error("[Automated Email Scheduler] Failed sending weekly email summary:", emailErr.message);
    }
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
