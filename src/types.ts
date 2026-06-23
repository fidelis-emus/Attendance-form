export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  whatsAppNumber: string; // formatted with country code (e.g. +234...)
  lastAttendanceDate: string; // YYYY-MM-DD
  currentStatus: "Present" | "Absent";
  attendedAtTime?: string | null; // checkin timestamp ISO or formatted
  gender?: "Male" | "Female" | string;
  messageSent: boolean;
  messageSentDate: string | null; // ISO String or Date
  messageDeliveryStatus: "Sent" | "Delivered" | "Read" | "Failed" | null;
  role?: string;
}

export interface Worker {
  id: string;
  firstName: string;
  lastName: string;
  whatsAppNumber: string; // formatted with country code
  lastAttendanceDate: string; // YYYY-MM-DD
  currentStatus: "Present" | "Absent";
  attendedAtTime?: string | null; // checkin timestamp ISO or formatted
  gender?: "Male" | "Female" | string;
  messageSent: boolean;
  messageSentDate: string | null;
  messageDeliveryStatus: "Sent" | "Delivered" | "Read" | "Failed" | null;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  personId: string; // References Member or Worker ID
  personType: "member" | "worker" | "children" | "chiden";
  firstName: string;
  lastName: string;
  whatsAppNumber: string;
  gender?: "Male" | "Female" | string;
  timestamp: string; // ISO 8601 string of when they submitted
  
  // Real-time explicit reporting fields
  memberId?: string;
  role?: string;
  eventType?: string; // Program Type
  attendanceDate?: string;
  attendanceTime?: string;
  day?: string; // Day of Week
  month?: string;
  year?: string;
  status?: string; // "Present"
}

export interface WhatsAppLog {
  id: string;
  personId: string;
  personName: string; // Full name for easy display
  personType: "member" | "worker";
  whatsAppNumber: string;
  messageContent: string;
  sentAt: string; // ISO string
  deliveryStatus: "Sent" | "Delivered" | "Read" | "Failed";
  wamid?: string | null; // WhatsApp message ID for webhook tracking
  messageType?: "Saturday Encouragement" | "Wednesday Word Cafe Reminder" | "Sunday Absentee Follow-Up" | string;
  dateSent?: string; // YYYY-MM-DD
  timeSent?: string; // HH:MM:SS or AM/PM
  readStatus?: "Unread" | "Read" | string;
  failedStatus?: string;
}

export interface AppSettings {
  churchWhatsAppNumber: string;
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  memberTemplate?: string;
  workerTemplate?: string;
}

export interface Admin {
  id: string; // Auth UID
  email: string;
  role: "Super Admin" | "Pastor" | "Secretary" | "Admin" | "User";
  password?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  timestamp: string;
}

export interface EmailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpAuthUser: string;
  smtpAuthPass: string;
  senderEmail: string;
  leaderEmails: string;
  enabled: boolean;
}

