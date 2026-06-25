import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import pino from "pino";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";

export type ConnectionStatus = "disconnected" | "connecting" | "qrcode" | "connected";

class WhatsAppService {
  private sock: any = null;
  private status: ConnectionStatus = "disconnected";
  private qrCodeDataUrl: string | null = null;
  private connectedNumber: string | null = null;
  private lastConnectedTime: string | null = null;
  private pinoLogger = pino({ level: "silent" });
  private sessionDir = path.join(process.cwd(), "local_db", "baileys-session");
  private getDbFn: (() => Promise<any>) | null = null;
  private saveTimeout: any = null;

  getStatus() {
    return {
      status: this.status,
      qrCodeDataUrl: this.qrCodeDataUrl,
      connectedNumber: this.connectedNumber,
      lastConnectedTime: this.lastConnectedTime
    };
  }

  async init(getDbFn?: () => Promise<any>) {
    if (getDbFn) {
      this.getDbFn = getDbFn;
    }
    if (this.sock) {
      console.log("WhatsApp client already defined. Skipping duplicate initialization.");
      return;
    }
    await this.connect();
  }

  private async getDb() {
    if (this.getDbFn) {
      return await this.getDbFn();
    }
    return null;
  }

  private queueSaveSession() {
    if (this.saveTimeout) {
      return; // Already scheduled a save soon
    }
    this.saveTimeout = setTimeout(async () => {
      this.saveTimeout = null;
      await this.saveSessionToDb();
    }, 15000); // Debounce updates by 15 seconds to prevent server freezing
  }

  private async saveSessionToDb() {
    try {
      const db = await this.getDb();
      if (!db || !fs.existsSync(this.sessionDir)) return;
      
      const files = await fs.promises.readdir(this.sessionDir);
      
      const fileDocs = [];
      for (const file of files) {
        const filePath = path.join(this.sessionDir, file);
        try {
          const stat = await fs.promises.stat(filePath);
          if (stat.isFile()) {
            const content = await fs.promises.readFile(filePath, "utf-8");
            fileDocs.push({
              filename: file,
              content: content
            });
          }
        } catch (fileErr) {
          // File may have been deleted or locked during sync
        }
      }

      await db.collection("baileys_session").updateOne(
        { id: "session_bundle" },
        { 
          $set: { 
            id: "session_bundle",
            files: fileDocs,
            updatedAt: new Date().toISOString()
          } 
        },
        { upsert: true }
      );

      console.log(`[Baileys Sync] Synchronized ${fileDocs.length} session files as a single bundle document to database.`);
    } catch (err: any) {
      console.error("[Baileys Sync] Failed to save session to database:", err.message);
    }
  }

  private async restoreSessionFromDb() {
    try {
      const db = await this.getDb();
      if (!db) return;
      
      const doc = await db.collection("baileys_session").findOne({ id: "session_bundle" });
      if (doc && Array.isArray(doc.files) && doc.files.length > 0) {
        if (!fs.existsSync(this.sessionDir)) {
          fs.mkdirSync(this.sessionDir, { recursive: true });
        }
        for (const fileDoc of doc.files) {
          const filePath = path.join(this.sessionDir, fileDoc.filename);
          fs.writeFileSync(filePath, fileDoc.content, "utf-8");
        }
        console.log(`[Baileys Sync] Restored ${doc.files.length} session files from database bundle.`);
      } else {
        // Fallback: Check old individual docs style just in case
        const docs = await db.collection("baileys_session").find({ id: { $ne: "session_bundle" } }).toArray();
        const validDocs = docs.filter(d => d.filename && d.content);
        if (validDocs && validDocs.length > 0) {
          if (!fs.existsSync(this.sessionDir)) {
            fs.mkdirSync(this.sessionDir, { recursive: true });
          }
          for (const d of validDocs) {
            const filePath = path.join(this.sessionDir, d.filename);
            fs.writeFileSync(filePath, d.content, "utf-8");
          }
          console.log(`[Baileys Sync] Restored ${validDocs.length} legacy session files from database.`);
        } else {
          console.log("[Baileys Sync] No session files found in database to restore.");
        }
      }
    } catch (err: any) {
      console.error("[Baileys Sync] Failed to restore session from database:", err.message);
    }
  }

  async connect() {
    try {
      this.status = "connecting";
      this.qrCodeDataUrl = null;

      // Clean up previous socket cleanly if it already exists
      if (this.sock) {
        console.log("Existing WhatsApp socket detected. Cleaning up before connecting...");
        try {
          if (this.sock.ev && typeof this.sock.ev.removeAllListeners === "function") {
            this.sock.ev.removeAllListeners("connection.update");
            this.sock.ev.removeAllListeners("creds.update");
          }
          this.sock.end(undefined);
        } catch (e) {
          console.warn("Could not cleanly end existing socket:", e);
        }
        this.sock = null;
      }

      // Ensure directory exists
      if (!fs.existsSync(path.join(process.cwd(), "local_db"))) {
        fs.mkdirSync(path.join(process.cwd(), "local_db"), { recursive: true });
      }

      await this.restoreSessionFromDb();

      const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
      const { version } = await fetchLatestBaileysVersion();

      console.log(`Starting Baileys WhatsApp client (v${version.join(".")})...`);
      this.sock = (makeWASocket as any).default ? (makeWASocket as any).default({
        version,
        logger: this.pinoLogger,
        auth: state,
        printQRInTerminal: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
      }) : (makeWASocket as any)({
        version,
        logger: this.pinoLogger,
        auth: state,
        printQRInTerminal: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
      });

      this.sock.ev.on("connection.update", async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.status = "qrcode";
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr);
          } catch (qrErr) {
            console.error("Failed to generate QR data URL:", qrErr);
          }
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const isQrTimeout = lastDisconnect?.error && String(lastDisconnect.error).includes("QR refs attempts ended");
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const shouldReconnect = !isLoggedOut && !isQrTimeout;
          
          if (isQrTimeout) {
            console.log("WhatsApp QR registration expired/timeout. Stopping auto-updates to prevent cyclic failure. Click Connect on the dashboard to retry.");
          } else {
            console.log(`WhatsApp connection closed. statusCode: ${statusCode}, reconnecting: ${shouldReconnect}`);
          }
          
          this.status = "disconnected";
          this.connectedNumber = null;
          this.qrCodeDataUrl = null;

          // Clean up reference and listeners
          if (this.sock) {
            try {
              if (this.sock.ev && typeof this.sock.ev.removeAllListeners === "function") {
                this.sock.ev.removeAllListeners("connection.update");
                this.sock.ev.removeAllListeners("creds.update");
              }
            } catch (err) {
              // ignore
            }
            this.sock = null;
          }

          if (isLoggedOut) {
            console.log("Logged out or disabled on WhatsApp. Wiping session...");
            this.clearSession();
          } else if (shouldReconnect) {
            // Reconnect automatically with appropriate delay (handle conflict 411 carefully)
            const delay = statusCode === 411 ? 15000 : 5000;
            if (statusCode === 411) {
              console.warn("Session conflict (411) detected. Delaying connection loop by 15s...");
            }
            setTimeout(() => this.connect(), delay);
          } else {
            console.log("Preserving session for potential reconnection...");
          }
        } else if (connection === "open") {
          console.log("WhatsApp Web connection established successfully!");
          this.status = "connected";
          this.qrCodeDataUrl = null;
          this.lastConnectedTime = new Date().toISOString();
          
          // Get registered phone number from user JID
          const userJid = this.sock.user?.id || "";
          this.connectedNumber = userJid.split(":")[0] || userJid.split("@")[0] || "Connected Account";
        }
      });

      this.sock.ev.on("creds.update", async () => {
        await saveCreds();
        this.queueSaveSession();
      });

    } catch (err) {
      console.error("WhatsApp connection initialization error:", err);
      this.status = "disconnected";
    }
  }

  async sendMessage(phoneNumber: string, text: string): Promise<string> {
    if (this.status !== "connected" || !this.sock) {
      throw new Error("WhatsApp status is not connected. Message dispatch blocked.");
    }

    const cleanJid = this.formatToWhatsAppJID(phoneNumber);
    console.log(`Sending WhatsApp message using Baileys to ${cleanJid}: "${text.substring(0, 30)}..."`);
    
    const sent = await this.sock.sendMessage(cleanJid, { text });
    if (!sent || !sent.key || !sent.key.id) {
      throw new Error("Message submission failed - did not get confirm receipt from socket.");
    }
    return sent.key.id;
  }

  private formatToWhatsAppJID(phone: string): string {
    let clean = phone.trim().replace(/\D/g, ""); // keep only digits
    if (clean.startsWith("0")) {
      clean = "234" + clean.slice(1);
    }
    return `${clean}@s.whatsapp.net`;
  }

  async disconnect() {
    console.log("Disconnecting from WhatsApp explicitly...");
    try {
      if (this.sock) {
        await this.sock.logout();
        this.sock.end(undefined);
      }
    } catch (e) {
      // ignore
    }
    this.sock = null;
    this.status = "disconnected";
    this.connectedNumber = null;
    this.qrCodeDataUrl = null;
    this.clearSession();
  }

  private async clearSession() {
    try {
      if (fs.existsSync(this.sessionDir)) {
        fs.rmSync(this.sessionDir, { recursive: true, force: true });
        console.log("Successfully deleted session directory:", this.sessionDir);
      }
      const db = await this.getDb();
      if (db) {
        await db.collection("baileys_session").deleteMany({});
        console.log("[Baileys Sync] Cleared session collection from database.");
      }
    } catch (err) {
      console.error("Error clearing WhatsApp session directory & collection:", err);
    }
  }
}

export const whatsappService = new WhatsAppService();
