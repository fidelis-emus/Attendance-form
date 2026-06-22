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

  getStatus() {
    return {
      status: this.status,
      qrCodeDataUrl: this.qrCodeDataUrl,
      connectedNumber: this.connectedNumber,
      lastConnectedTime: this.lastConnectedTime
    };
  }

  async init() {
    if (this.sock) {
      console.log("WhatsApp client already defined. Skipping duplicate initialization.");
      return;
    }
    await this.connect();
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
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          console.log(`WhatsApp connection closed due to:`, lastDisconnect?.error, `, statusCode: ${statusCode}, reconnecting: ${shouldReconnect}`);
          
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

          if (shouldReconnect) {
            // Reconnect automatically with appropriate delay (handle conflict 411 carefully)
            const delay = statusCode === 411 ? 15000 : 5000;
            if (statusCode === 411) {
              console.warn("Session conflict (411) detected. Delaying connection loop by 15s to allow other session resources to free up...");
            }
            setTimeout(() => this.connect(), delay);
          } else {
            console.log("Logged out from WhatsApp. Wiping credentials session directory...");
            this.clearSession();
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

      this.sock.ev.on("creds.update", saveCreds);

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

  private clearSession() {
    try {
      if (fs.existsSync(this.sessionDir)) {
        fs.rmSync(this.sessionDir, { recursive: true, force: true });
        console.log("Successfully deleted session directory:", this.sessionDir);
      }
    } catch (err) {
      console.error("Error clearing WhatsApp session directory:", err);
    }
  }
}

export const whatsappService = new WhatsAppService();
