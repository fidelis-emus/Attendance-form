import React, { useState, useEffect } from "react";
import {
  Users,
  Shield,
  Calendar,
  QrCode,
  Settings,
  LogOut,
  Search,
  FileSpreadsheet,
  Printer,
  Download,
  Mail,
  Send,
  UserPlus,
  Trash2,
  Edit,
  CheckCircle,
  AlertTriangle,
  Activity,
  Moon,
  Sun,
  Sparkles,
  PhoneCall,
  Lock,
  RefreshCw,
  Upload,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import AttendanceForm from "./components/AttendanceForm";
import QrCodeGenerator from "./components/QrCodeGenerator";
import AnalyticsCharts from "./components/AnalyticsCharts";
import {
  Member,
  Worker,
  AttendanceRecord,
  WhatsAppLog,
  AppSettings,
  Admin,
  AuditLog,
  EmailSettings,
} from "./types";

export default function App() {
  // Authentication & Session States
  const [user, setUser] = useState<{
    uid: string;
    email: string;
    displayName?: string;
    role?: string;
  } | null>(null);
  const [adminRole, setAdminRole] = useState<
    "Super Admin" | "Pastor" | "Secretary" | null
  >(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Core App Mode (Guest form register vs Admin dashboard)
  const [viewMode, setViewMode] = useState<"guest" | "admin">("guest");

  // Admin Core Selection Tabs
  const [adminTab, setAdminTab] = useState<
    | "dashboard"
    | "tickets"
    | "registers"
    | "absentees"
    | "campaigns"
    | "settings"
    | "roles"
  >("dashboard");

  // Registers Selection
  const [registerSubTab, setRegisterSubTab] = useState<
    "members" | "workers" | "history"
  >("members");

  // Dashboard / Statistics Filtering states
  const [dashboardProgramFilter, setDashboardProgramFilter] = useState<string>("all");
  const [dashboardDateFilter, setDashboardDateFilter] = useState<string>("all");
  const [dashboardMonthFilter, setDashboardMonthFilter] = useState<string>("all");
  const [dashboardYearFilter, setDashboardYearFilter] = useState<string>("all");
  const [dashboardRoleFilter, setDashboardRoleFilter] = useState<string>("all");

  // Dark Mode States
  const [darkMode, setDarkMode] = useState(false);

  // App Master Datasets
  const [stats, setStats] = useState<any>({
    totalMembers: 0,
    totalWorkers: 0,
    membersPresent: 0,
    workersPresent: 0,
    absentMembers: 0,
    absentWorkers: 0,
    totalWAMessages: 0,
    deliveryStats: { Sent: 0, Delivered: 0, Read: 0, Failed: 0 },
    todaySunday: "",
  });

  const [members, setMembers] = useState<Member[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<
    AttendanceRecord[]
  >([]);
  const [sundaysList, setSundaysList] = useState<string[]>([]);
  const [whatsAppLogs, setWhatsAppLogs] = useState<WhatsAppLog[]>([]);
  const [adminsList, setAdminsList] = useState<Admin[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [whatsAppConfig, setWhatsAppConfig] = useState<AppSettings>({
    churchWhatsAppNumber: "+2349029957453",
    phoneNumberId: "",
    accessToken: "",
    businessAccountId: "",
  });
  const [emailConfig, setEmailConfig] = useState<EmailSettings>({
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpAuthUser: "",
    smtpAuthPass: "",
    senderEmail: "Church Portal <no-reply@church.org>",
    leaderEmails: "",
    enabled: false,
  });

  // Licensing & Subscription States
  const [subInfo, setSubInfo] = useState<{
    planType: string;
    activationDate: string;
    expiryDate: string;
    licenseKey: string;
    isExpired: boolean;
  } | null>(null);
  const [subUnlockEmail, setSubUnlockEmail] = useState("");
  const [subUnlockPassword, setSubUnlockPassword] = useState("");
  const [subUnlockError, setSubUnlockError] = useState<string | null>(null);
  const [subUnlockedSuperAdmin, setSubUnlockedSuperAdmin] = useState<{ id: string; email: string } | null>(null);
  const [subSelectedPlan, setSubSelectedPlan] = useState<"Monthly" | "Quarterly" | "Yearly">("Monthly");
  const [subApplying, setSubApplying] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [sundayFilter, setSundayFilter] = useState("all");
  const [historyProgramFilter, setHistoryProgramFilter] = useState("all");
  const [historyYearFilter, setHistoryYearFilter] = useState("all");
  const [campaignTypeFilter, setCampaignTypeFilter] = useState("all");
  const [campaignDateFilter, setCampaignDateFilter] = useState("all");

  // Detailed Modal states
  const [selectedDetailsPerson, setSelectedDetailsPerson] = useState<
    any | null
  >(null);
  const [selectedDetailsPersonType, setSelectedDetailsPersonType] = useState<
    "member" | "worker" | null
  >(null);

  // Creation Modals or Quick Forms
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [newPersonType, setNewPersonType] = useState<"member" | "worker">(
    "member",
  );
  const [newPerson, setNewPerson] = useState({
    firstName: "",
    lastName: "",
    whatsAppNumber: "",
    currentStatus: "Absent" as "Present" | "Absent",
    gender: "" as "Male" | "Female" | "",
    notes: "",
  });

  const [showImportModal, setShowImportModal] = useState(false);
  const [importRawText, setImportRawText] = useState("");
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const [importingStatus, setImportingStatus] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    id: "",
    email: "",
    role: "Secretary" as "Super Admin" | "Pastor" | "Secretary",
    password: "",
  });

  // System Scheduler States
  const [runningScheduler, setRunningScheduler] = useState(false);
  const [schedulerLogs, setSchedulerLogs] = useState<any[]>([]);
  const [showSchedulerResult, setShowSchedulerResult] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState<
    Array<{ id: string; msg: string; type: "success" | "error" | "info" }>
  >([]);

  // Load APP URL for redirection
  const [appUrl, setAppUrl] = useState("");

  // Synchronize App View Mode based on Pathname
  useEffect(() => {
    const syncViewMode = () => {
      if (window.location.pathname === "/admin") {
        setViewMode("admin");
      } else {
        setViewMode("guest");
      }
    };

    syncViewMode();
    window.addEventListener("popstate", syncViewMode);
    return () => window.removeEventListener("popstate", syncViewMode);
  }, []);

  // Restore persistent login session from sessionStorage on reload
  useEffect(() => {
    const stored = sessionStorage.getItem("church_admin_session");
    if (stored) {
      try {
        const storedUser = JSON.parse(stored);
        setUser(storedUser);
        setAdminRole(storedUser.role);
      } catch (e) {
        sessionStorage.removeItem("church_admin_session");
      }
    }
    setAuthLoading(false);
  }, []);

  // Initialize Dark Mode & fetch APP_URL
  useEffect(() => {
    const isDark = localStorage.getItem("theme") === "dark";
    setDarkMode(isDark);
    if (isDark) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
    setAppUrl(window.location.origin);
  }, []);

  // Fetch all administration tables once Admin logs in and is authorized
  useEffect(() => {
    if (user && adminRole) {
      fetchSubscriptionInfo();
      loadAllAdminData();
    }
  }, [user, adminRole]);

  const toggleDarkMode = () => {
    const updated = !darkMode;
    setDarkMode(updated);
    if (updated) {
      document.body.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const addNotification = (
    msg: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    const id = Math.random().toString(36).substring(7);
    setNotifications((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  const handleAdminSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (!loginEmail.trim() || !loginPassword.trim()) {
        throw new Error("Both email and password are required.");
      }
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      const loggedUser = {
        uid: data.id,
        email: data.email,
        displayName: data.email.split("@")[0],
        role: data.role,
      };

      sessionStorage.setItem(
        "church_admin_session",
        JSON.stringify(loggedUser),
      );
      setUser(loggedUser as any);
      setAdminRole(data.role);
      setViewMode("admin");
      addNotification(`Welcome back! Role: ${data.role}`, "success");
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminSignOut = async () => {
    try {
      sessionStorage.removeItem("church_admin_session");
      setUser(null);
      setAdminRole(null);
      window.history.pushState(null, "", "/");
      setViewMode("guest");
      setLoginEmail("");
      setLoginPassword("");
      addNotification("Logged out safely.", "info");
    } catch (err: any) {
      addNotification("Logout failed: " + err.message, "error");
    }
  };

  const fetchSubscriptionInfo = async () => {
    try {
      const adminId = user?.uid || "";
      const res = await fetch(`/api/subscription/info?adminId=${adminId}`);
      if (res.ok) {
        const data = await res.json();
        setSubInfo(data);
      }
    } catch (err) {
      console.error("Failed to load subscription info:", err);
    }
  };

  const handleSubUnlockAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubUnlockError(null);
    try {
      if (!subUnlockEmail.trim() || !subUnlockPassword.trim()) {
        throw new Error("Both email and password are required.");
      }
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: subUnlockEmail.trim().toLowerCase(),
          password: subUnlockPassword.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 402 && data.error === "SUBSCRIPTION_EXPIRED") {
          throw new Error("Standard Admin credentials cannot bypass the license lock. Only Super Admin logins are authorized here.");
        }
        throw new Error(data.error || "Authentication failed.");
      }
      if (data.role !== "Super Admin") {
        throw new Error("Access Denied: Only Super Administrators can bypass this screen and renew licenses.");
      }
      setSubUnlockedSuperAdmin({ id: data.id, email: data.email });
      addNotification("Super Admin credentials confirmed! You can now apply a renewal plan.", "success");
    } catch (err: any) {
      setSubUnlockError(err.message || "Failed to authenticate Super Admin.");
    }
  };

  const handleApplyNewSubscriptionPlan = async () => {
    setSubApplying(true);
    try {
      const response = await fetch("/api/subscription/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planType: subSelectedPlan,
          adminId: subUnlockedSuperAdmin?.id || user?.uid,
          adminEmail: subUnlockedSuperAdmin?.email || user?.email,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to apply license.");
      }
      addNotification(`Successfully activated ${subSelectedPlan} subscription plan!`, "success");
      setSubInfo(data.subscription);
      setSubUnlockedSuperAdmin(null);
      setSubUnlockEmail("");
      setSubUnlockPassword("");
      await loadAllAdminData();
    } catch (err: any) {
      alert(err.message || "Error applying subscription.");
    } finally {
      setSubApplying(false);
    }
  };

  const loadAllAdminData = async () => {
    try {
      const endpoints = [
        "/api/dashboard/stats",
        "/api/members",
        "/api/workers",
        "/api/attendance",
        "/api/whatsapp/logs",
        "/api/whatsapp/config",
        "/api/admins",
        "/api/audit-logs",
        "/api/sundays",
        "/api/email/config",
      ];

      const responses = await Promise.all(
        endpoints.map((ep) =>
          fetch(ep).then(async (res) => {
            const data = await res.json();
            if (!res.ok) {
              throw new Error(
                `${ep} failed with status ${res.status}: ${data?.error || res.statusText}`,
              );
            }
            return data;
          }),
        ),
      );

      const [
        statsData,
        membersData,
        workersData,
        attendanceData,
        whatsappLogsData,
        whatsappConfigData,
        adminsListData,
        auditLogsData,
        sundaysData,
        emailConfigData,
      ] = responses;

      const statsVal = statsData && !statsData.error ? statsData : {};
      const membersList = Array.isArray(membersData) ? membersData : [];
      const workersList = Array.isArray(workersData) ? workersData : [];
      const attendanceList = Array.isArray(attendanceData)
        ? attendanceData
        : [];
      const waLogsList = Array.isArray(whatsappLogsData)
        ? whatsappLogsData
        : [];
      const adminsListRes = Array.isArray(adminsListData) ? adminsListData : [];
      const auditLogsList = Array.isArray(auditLogsData) ? auditLogsData : [];
      const sundaysListRes = Array.isArray(sundaysData) ? sundaysData : [];

      // Ensure stable sorting
      const sortedWaLogs = [...waLogsList].sort((a: any, b: any) =>
        (b.sentAt || "").localeCompare(a.sentAt || ""),
      );
      const sortedAuditLogs = [...auditLogsList].sort((a: any, b: any) =>
        (b.timestamp || "").localeCompare(a.timestamp || ""),
      );

      setStats(statsVal);
      setMembers(membersList);
      setWorkers(workersList);
      setAttendanceHistory(attendanceList);
      setSundaysList(sundaysListRes);
      setWhatsAppLogs(sortedWaLogs);
      if (whatsappConfigData && !whatsappConfigData.error) {
        setWhatsAppConfig(whatsappConfigData);
      }
      if (emailConfigData && !emailConfigData.error) {
        setEmailConfig(emailConfigData);
      }
      setAdminsList(adminsListRes);
      setAuditLogs(sortedAuditLogs);
    } catch (err: any) {
      addNotification("Error syncing client tables: " + err.message, "error");
    }
  };

  // Add individual Person API call
  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !newPerson.firstName ||
      !newPerson.lastName ||
      !newPerson.whatsAppNumber
    ) {
      addNotification("All fields are required.", "error");
      return;
    }

    const type = newPersonType;
    const endpoint = type === "worker" ? "/api/workers" : "/api/members";

    try {
      // Format number to have + prefix if missing and numeric
      let phoneNum = newPerson.whatsAppNumber.trim();
      if (!phoneNum.startsWith("+") && /^\d+$/.test(phoneNum)) {
        phoneNum = "+" + phoneNum;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: newPerson.firstName.trim(),
          lastName: newPerson.lastName.trim(),
          whatsAppNumber: phoneNum,
          currentStatus: newPerson.currentStatus || "Absent",
          gender: newPerson.gender,
          notes: newPerson.notes.trim(),
          lastAttendanceDate: "",
          adminEmail: user?.email,
          adminId: user?.uid,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Could not add new ${type}.`);
      }

      addNotification(`Added new ${type} successfully!`, "success");
      setShowAddPersonModal(false);
      setNewPerson({
        firstName: "",
        lastName: "",
        whatsAppNumber: "",
        currentStatus: "Absent",
        gender: "",
        notes: "",
      });
      await loadAllAdminData();
    } catch (err: any) {
      addNotification(err.message, "error");
    }
  };

  // Upload/import spreadsheet file as raw text
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        setImportRawText(text);
        setImportFileError(null);
        setImportResult(null);
      }
    };
    reader.onerror = () => {
      setImportFileError("Failed to read the selected file.");
    };
    reader.readAsText(file);
  };

  // Process and POST raw CSV/TSV parsed attendees
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importRawText.trim()) {
      setImportFileError("Please copy-paste or upload CSV data first.");
      return;
    }

    setImportingStatus(true);
    setImportFileError(null);
    setImportResult(null);

    try {
      const parsedAttendees: any[] = [];
      const lines = importRawText.split(/\r?\n/);

      for (const line of lines) {
        const row = line.trim();
        if (!row) continue;

        // Split by comma or tab
        const cells = row.includes("\t") ? row.split("\t") : row.split(",");
        const cleanedCells = cells.map(c => c.replace(/^["']|["']$/g, "").trim());

        // Skip header lines
        const first = String(cleanedCells[0] || "").toLowerCase();
        if (first.includes("first") || first.includes("name") || first.includes("phone")) {
          continue;
        }

        if (cleanedCells.length >= 3) {
          const attendee = {
            firstName: cleanedCells[0],
            lastName: cleanedCells[1],
            whatsAppNumber: cleanedCells[2],
            gender: cleanedCells[3] || "", // Male / Female
            role: String(cleanedCells[4] || "member").toLowerCase().replace(/s$/, ""), // member / worker
            date: cleanedCells[5] || "", // optional YYYY-MM-DD
            currentStatus: cleanedCells[6] || "Present", // optional Present / Absent
          };
          parsedAttendees.push(attendee);
        }
      }

      if (parsedAttendees.length === 0) {
        throw new Error("Could not parse any valid rows. Each row must be formatted as: First Name, Last Name, WhatsApp number.");
      }

      const response = await fetch("/api/attendance/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendees: parsedAttendees,
          adminEmail: user?.email,
          adminId: user?.uid,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Failed to complete CSV import.");
      }

      setImportResult(resData.message);
      addNotification("Roster database and attendance imported successfully!", "success");
      await loadAllAdminData();
    } catch (err: any) {
      setImportFileError(err.message);
    } finally {
      setImportingStatus(false);
    }
  };

  // Delete Individual Person
  const handleDeletePerson = async (id: string, type: "member" | "worker") => {
    if (
      !window.confirm(
        `Are you absolutely sure you want to remove this ${type}?`,
      )
    )
      return;

    if (adminRole === "Pastor") {
      addNotification("Access Denied: Pastors can only view reports.", "error");
      return;
    }

    const endpoint =
      type === "worker" ? `/api/workers/${id}` : `/api/members/${id}`;
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: user?.email,
          adminId: user?.uid,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to remove database entry.");
      }

      addNotification("Record removed successfully", "success");
      await loadAllAdminData();
    } catch (err: any) {
      addNotification(err.message, "error");
    }
  };

  // Real-time admin quick status toggle
  const handleToggleAttendance = async (personId: string, personType: "member" | "worker") => {
    if (adminRole === "Pastor") {
      addNotification("Access Denied: Pastors can only view reports.", "error");
      return;
    }

    try {
      const response = await fetch("/api/attendance/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId,
          personType,
          date: sundayFilter,
          adminEmail: user?.email,
          adminId: user?.uid,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to toggle attendance status.");
      }

      addNotification("Attendance checked / status toggled successfully!", "success");
      await loadAllAdminData();
    } catch (err: any) {
      addNotification(err.message, "error");
    }
  };

  // Save Meta WhatsApp Settings API parameters
  const handleSaveWhatsAppConfig = async (e: React.FormEvent) => {
    e.preventDefault();

    if (adminRole !== "Super Admin") {
      addNotification(
        "Permissions Denied. Only Super Admins can configure API settings.",
        "error",
      );
      return;
    }

    try {
      const response = await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          churchWhatsAppNumber: whatsAppConfig.churchWhatsAppNumber || "",
          phoneNumberId: whatsAppConfig.phoneNumberId || "",
          accessToken: whatsAppConfig.accessToken || "",
          businessAccountId: whatsAppConfig.businessAccountId || "",
          memberTemplate: whatsAppConfig.memberTemplate || "",
          workerTemplate: whatsAppConfig.workerTemplate || "",
          adminEmail: user?.email,
          adminId: user?.id, // Note: user.id based on our bootstrap login endpoint
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to save configuration.");
      }

      addNotification(
        "WhatsApp Business configuration saved securely",
        "success",
      );
      await loadAllAdminData();
    } catch (err: any) {
      addNotification(err.message, "error");
    }
  };

  const [isSavingEmailConfig, setIsSavingEmailConfig] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [isTriggeringEmailReport, setIsTriggeringEmailReport] = useState(false);

  // Save Email SMTP configurations
  const handleSaveEmailConfig = async (e: React.FormEvent) => {
    e.preventDefault();

    if (adminRole !== "Super Admin") {
      addNotification(
        "Permissions Denied. Only Super Admins can configure SMTP email settings.",
        "error",
      );
      return;
    }

    setIsSavingEmailConfig(true);
    try {
      const response = await fetch("/api/email/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost: emailConfig.smtpHost || "",
          smtpPort: Number(emailConfig.smtpPort) || 587,
          smtpSecure: !!emailConfig.smtpSecure,
          smtpAuthUser: emailConfig.smtpAuthUser || "",
          smtpAuthPass: emailConfig.smtpAuthPass || "",
          senderEmail: emailConfig.senderEmail || "Church Portal <no-reply@church.org>",
          leaderEmails: emailConfig.leaderEmails || "",
          enabled: !!emailConfig.enabled,
          adminEmail: user?.email,
          adminId: user?.id,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to save Email configuration.");
      }

      addNotification(
        "Email notification settings saved securely",
        "success",
      );
      await loadAllAdminData();
    } catch (err: any) {
      addNotification(err.message, "error");
    } finally {
      setIsSavingEmailConfig(false);
    }
  };

  // Send a test email
  const handleSendTestEmail = async () => {
    if (!emailConfig.smtpHost || !emailConfig.smtpAuthUser || !emailConfig.smtpAuthPass || !emailConfig.leaderEmails) {
      addNotification(
        "Please fill in all SMTP credentials and at least one leader email first.",
        "error",
      );
      return;
    }

    setIsSendingTestEmail(true);
    addNotification("Dispatching SMTP connection test mail...", "info");

    try {
      const response = await fetch("/api/email/send-test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost: emailConfig.smtpHost || "",
          smtpPort: Number(emailConfig.smtpPort) || 587,
          smtpSecure: !!emailConfig.smtpSecure,
          smtpAuthUser: emailConfig.smtpAuthUser || "",
          smtpAuthPass: emailConfig.smtpAuthPass || "",
          senderEmail: emailConfig.senderEmail || "Church Portal <no-reply@church.org>",
          leaderEmails: emailConfig.leaderEmails || "",
          adminEmail: user?.email,
          adminId: user?.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to transmit test email.");
      }

      addNotification(
        `SMTP Test successful! Check: ${emailConfig.leaderEmails}`,
        "success",
      );
    } catch (err: any) {
      addNotification(`SMTP Connection failed: ${err.message}`, "error");
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // Manually trigger attendance summary email
  const handleTriggerEmailReport = async (targetDateString?: string) => {
    if (!emailConfig.enabled) {
      addNotification(
        "Email notifications are currently disabled. Please enable and save settings first.",
        "error",
      );
      return;
    }

    setIsTriggeringEmailReport(true);
    addNotification("Generating full attendance list & dispatching summary report...", "info");

    try {
      const response = await fetch("/api/email/trigger-weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: targetDateString,
          adminEmail: user?.email,
          adminId: user?.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to dispatch email summary.");
      }

      addNotification(
        `Executive weekly report sent: ${data.message}`,
        "success",
      );
    } catch (err: any) {
      addNotification(`Failed to send report: ${err.message}`, "error");
    } finally {
      setIsTriggeringEmailReport(false);
    }
  };

  // Resend WhatsApp campaigns either via server Meta API or WhatsApp web fallback
  const handleWhatsAppResend = async (logItem: any) => {
    if (adminRole === "Pastor") {
      addNotification("Access Denied. Pastors cannot send messages.", "error");
      return;
    }

    addNotification("Retransmitting WhatsApp Business follow-up...", "info");

    try {
      const response = await fetch("/api/whatsapp/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: logItem.personId,
          personType: logItem.personType,
          whatsAppNumber: logItem.whatsAppNumber,
          messageContent: logItem.messageContent,
          adminEmail: user?.email,
          adminId: user?.uid,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Resend failed.");

      if (data.success === false) {
        addNotification(
          `Meta transmission failed. Fallback to WhatsApp Web resend!`,
          "info",
        );
        const escapedTxt = encodeURIComponent(logItem.messageContent);
        const webHref = `https://wa.me/${logItem.whatsAppNumber.replace(/\+/g, "")}?text=${escapedTxt}`;
        window.open(webHref, "_blank");
      } else {
        addNotification(
          "WhatsApp follow-up retried successfully using Meta API Cloud!",
          "success",
        );
      }
      await loadAllAdminData();
    } catch (err: any) {
      addNotification(err.message, "error");
    }
  };

  // Explicitly trigger Sunday comparisons scheduler check for test verification
  const handleTriggerSundayComparison = async () => {
    if (
      !window.confirm(
        "Do you want to instantly run the Sunday attendance comparison and transmit WhatsApp follow-ups now?",
      )
    )
      return;

    setRunningScheduler(true);
    setSchedulerLogs([]);
    setShowSchedulerResult(true);

    try {
      const response = await fetch("/api/whatsapp/trigger-sunday-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: user?.email,
          adminId: user?.uid,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Trigggering failed.");

      setSchedulerLogs(data.logs || []);
      addNotification(
        `Follow ups run successfully. Sent: ${data.processedCount}, Failed: ${data.failedCount}`,
        "success",
      );
      await loadAllAdminData();
    } catch (err: any) {
      addNotification(err.message, "error");
    } finally {
      setRunningScheduler(false);
    }
  };

  // Explicitly trigger Saturday Encouragement campaign
  const handleTriggerSaturdayCampaign = async () => {
    if (
      !window.confirm(
        "Do you want to instantly trigger the Saturday Encouragement campaign and send messages to all members and workers?",
      )
    )
      return;

    setRunningScheduler(true);
    setSchedulerLogs([]);
    setShowSchedulerResult(true);

    try {
      const response = await fetch("/api/whatsapp/trigger-saturday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: user?.email,
          adminId: user?.uid,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Triggering Saturday campaign failed.");

      setSchedulerLogs(data.logs || []);
      addNotification(
        `Saturday Encouragement run successfully. Sent: ${data.processedCount}, Failed: ${data.failedCount}`,
        "success",
      );
      await loadAllAdminData();
    } catch (err: any) {
      addNotification(err.message, "error");
    } finally {
      setRunningScheduler(false);
    }
  };

  // Explicitly trigger Wednesday Bible Study reminders
  const handleTriggerWednesdayCampaign = async () => {
    if (
      !window.confirm(
        "Do you want to instantly trigger the Wednesday Word Cafe Reminder campaign?",
      )
    )
      return;

    setRunningScheduler(true);
    setSchedulerLogs([]);
    setShowSchedulerResult(true);

    try {
      const response = await fetch("/api/whatsapp/trigger-wednesday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: user?.email,
          adminId: user?.uid,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Triggering Wednesday campaign failed.");

      setSchedulerLogs(data.logs || []);
      addNotification(
        `Wednesday Reminders run successfully. Sent: ${data.processedCount}, Failed: ${data.failedCount}`,
        "success",
      );
      await loadAllAdminData();
    } catch (err: any) {
      addNotification(err.message, "error");
    } finally {
      setRunningScheduler(false);
    }
  };

  // Add system administrator role
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminRole !== "Super Admin") {
      addNotification(
        "Only Super Admins can configure administrative users.",
        "error",
      );
      return;
    }
    if (!newAdmin.email) {
      addNotification("Please fill in Admin Email", "error");
      return;
    }

    try {
      const response = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newAdmin.id || "",
          email: newAdmin.email.trim().toLowerCase(),
          role: newAdmin.role,
          password: newAdmin.password || "",
          adminEmail: user?.email,
          adminId: user?.uid,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to register credentials.");
      }

      addNotification("Admin role mapped successfully!", "success");
      setShowAddAdminModal(false);
      setNewAdmin({ id: "", email: "", role: "Secretary", password: "" });
      await loadAllAdminData();
    } catch (err: any) {
      addNotification(err.message, "error");
    }
  };

  // Remove Admin role
  const handleDeleteAdmin = async (id: string, email: string) => {
    if (email.toLowerCase() === "fidelisemus@gmail.com") {
      addNotification("Cannot remove bootstrapped Super Admin.", "error");
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to revoke administrative control for ${email}?`,
      )
    )
      return;

    try {
      const response = await fetch(`/api/admins/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: user?.email,
          adminId: user?.uid,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to remove credentials.");
      }

      addNotification("Administrative privileges revoked.", "success");
      await loadAllAdminData();
    } catch (err: any) {
      addNotification(err.message, "error");
    }
  };

  // Export any array to high-quality CSV
  const handleExportCSV = (
    srcList: any[],
    headers: string[],
    filename: string,
  ) => {
    const cleanCell = (val: any) => {
      if (val === undefined || val === null) return '""';
      const parsed = String(val).replace(/"/g, '""');
      return `"${parsed}"`;
    };

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" + // Add UTF-8 BOM
      [
        headers.join(","),
        ...srcList.map((row) => row.map(cleanCell).join(",")),
      ].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addNotification("Report downloaded to Excel CSV spread.", "success");
  };

  const handleExportExcel = () => {
    const list = getFilteredHistory();
    const headers = [
      "No",
      "Attendance Date",
      "First Name",
      "Last Name",
      "Roster Role",
      "Program / Event",
      "WhatsApp Phone",
      "Gender",
      "Attendance Time",
      "Day of Week",
      "Month",
      "Year",
      "Status"
    ];
    const data = list.map((item, index) => [
      index + 1,
      item.date || item.attendanceDate || "",
      item.firstName || "",
      item.lastName || "",
      item.personType || item.role || "Member",
      item.eventType || "Sunday Experience",
      item.whatsAppNumber || "",
      item.gender || "",
      item.time || item.attendanceTime || "",
      item.dayOfWeek || item.day || "",
      item.month || "",
      item.year || "",
      item.status || "Present"
    ]);
    
    handleExportCSV(data, headers, `Church_Attendance_Report_${new Date().toISOString().split("T")[0]}.csv`);
  };

  const handleExportPDF = () => {
    const list = getFilteredHistory();
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      addNotification("Please allow popups/tabs to export PDFs.", "error");
      return;
    }

    const criteria = [
      historyProgramFilter !== "all" ? `Program: ${historyProgramFilter}` : null,
      monthFilter !== "all" ? `Month: ${monthFilter}` : null,
      sundayFilter !== "all" ? `Date: ${sundayFilter}` : null,
      historyYearFilter !== "all" ? `Year: ${historyYearFilter}` : null,
    ].filter(Boolean).join(" | ") || "All Records";

    const rowsHtml = list.map((item, index) => {
      const name = `${item.firstName} ${item.lastName}`;
      const role = item.personType || item.role || "Member";
      const program = item.eventType || "Sunday Experience";
      const phone = item.whatsAppNumber || "N/A";
      const gender = item.gender || "Unspecified";
      const date = item.date || item.attendanceDate;
      const time = item.time || item.attendanceTime || "N/A";

      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-weight: bold; color: #1e293b;">${index + 1}</td>
          <td style="padding: 10px; font-weight: bold; color: #2563eb;">${date}</td>
          <td style="padding: 10px; font-weight: bold; color: #0f172a;">${name}</td>
          <td style="padding: 10px;"><span style="font-size: 11px; font-weight: bold; padding: 3px 8px; border-radius: 9999px; background: ${role.toLowerCase() === 'worker' ? '#f5f3ff; color: #7c3aed;' : '#f0f9ff; color: #0369a1;'}">${role}</span></td>
          <td style="padding: 10px; color: #475569;">${program}</td>
          <td style="padding: 10px; font-family: monospace; color: #334155;">${phone}</td>
          <td style="padding: 10px; color: #475569;">${gender}</td>
          <td style="padding: 10px; font-family: monospace; color: #64748b;">${time}</td>
        </tr>
      `;
    }).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Church Attendance Report - Export</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
            body {
              font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
              color: #0f172a;
              margin: 40px;
              line-height: 1.5;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 3px double #e2e8f0;
              padding-bottom: 20px;
              margin-bottom: 25px;
            }
            .logo-placeholder {
              width: 50px;
              height: 50px;
              background: linear-gradient(135deg, #1e3a8a, #2563eb);
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 24px;
            }
            .title-area h1 {
              font-size: 24px;
              font-weight: 800;
              margin: 0;
              letter-spacing: -0.5px;
              background: linear-gradient(to right, #1e3a8a, #2563eb);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            .title-area p {
              font-size: 11px;
              color: #64748b;
              margin: 5px 0 0 0;
              font-weight: 700;
              letter-spacing: 1px;
            }
            .meta-box {
              background: #f8fafc;
              border: 1px solid #f1f5f9;
              border-radius: 12px;
              padding: 15px;
              margin-bottom: 25px;
              display: flex;
              justify-content: space-between;
              font-size: 13px;
            }
            .meta-item {
              margin-bottom: 4px;
            }
            .meta-item span {
              font-weight: 700;
              color: #334155;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
              margin-top: 10px;
            }
            th {
              background: #f1f5f9;
              color: #475569;
              text-transform: uppercase;
              font-size: 10px;
              font-weight: 800;
              letter-spacing: 0.5px;
              padding: 12px 10px;
              text-align: left;
              border-bottom: 2px solid #cbd5e1;
            }
            .footer {
              margin-top: 40px;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              color: #94a3b8;
              font-weight: 600;
            }
            @media print {
              body { margin: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div style="max-width: 1000px; margin: 0 auto;">
            <div class="header">
              <div style="display: flex; align-items: center; gap: 15px;">
                <div class="logo-placeholder">⛪</div>
                <div class="title-area">
                  <h1>Church Attendance Executive Report</h1>
                  <p>SMART CHUCH ATTENDANCE MANAGEMENT SYSTEM</p>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 800; color: #1e293b; font-size: 13px;">DOCUMENT ID</div>
                <div style="font-family: monospace; font-size: 12px; color: #64748b; font-weight: bold;">CMS-${Date.now().toString().substring(5)}</div>
              </div>
            </div>

            <div class="meta-box">
              <div>
                <div class="meta-item"><span>Reporting Criteria:</span> ${criteria}</div>
                <div class="meta-item"><span>Export Timestamp:</span> ${new Date().toLocaleString()}</div>
                <div class="meta-item"><span>Security Token:</span> System Generated PDF</div>
              </div>
              <div style="text-align: right; display: flex; flex-direction: column; justify-content: center; border-left: 2px solid #e2e8f0; padding-left: 20px;">
                <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Filtered Attendances</div>
                <div style="font-size: 28px; font-weight: 800; color: #2563eb; line-height: 1;">${list.length}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 40px;">#</th>
                  <th style="width: 100px;">Date</th>
                  <th>Full Name</th>
                  <th style="width: 100px;">Role</th>
                  <th style="width: 150px;">Program Type</th>
                  <th style="width: 120px;">WhatsApp Phone</th>
                  <th style="width: 80px;">Gender</th>
                  <th style="width: 80px;">Time</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || `<tr><td colspan="8" style="text-align: center; padding: 30px; font-weight: bold; color: #94a3b8;">No records match your selected filtering properties.</td></tr>`}
              </tbody>
            </table>

            <div class="footer">
              <div>© 2026 Smart Attendance System • Real-Time Database Ledger Reports</div>
              <div>Authority: Certified Congregation Audit</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
    addNotification("Professional PDF Report layout dispatched successfully!", "success");
  };

  const handleExportBackup = async (e: React.MouseEvent) => {
    e.preventDefault();
    addNotification("Downloading database backup file...", "info");
    try {
      window.location.href = "/api/backup/export";
      addNotification("JSON backup output received successfully!", "success");
    } catch (err: any) {
      addNotification("Backup failed: " + err.message, "error");
    }
  };

  const triggerBrowserPrint = () => {
    window.print();
  };

  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return "";
    try {
      const parts = dStr.split("-");
      const d = new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2]),
      );
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dStr;
    }
  };

  // Filter Helper
  const getFilteredPersons = (list: any[]) => {
    return list.filter((item) => {
      const fullName = `${item.firstName} ${item.lastName}`.toLowerCase();
      const phoneMatched = item.whatsAppNumber.includes(searchQuery);
      const nameMatched = fullName.includes(searchQuery.toLowerCase());

      // Filter by Month or Sunday
      let matchesSunday = true;
      if (sundayFilter !== "all") {
        matchesSunday = attendanceHistory.some(
          (rec) => rec.personId === item.id && rec.date === sundayFilter
        );
      }

      let matchesMonth = true;
      if (monthFilter !== "all") {
        matchesMonth = attendanceHistory.some((rec) => {
          if (rec.personId !== item.id) return false;
          const monthNum = rec.date.substring(5, 7); // YYYY-MM-DD -> MM
          return monthNum === monthFilter;
        });
      }

      return (nameMatched || phoneMatched) && matchesSunday && matchesMonth;
    });
  };

  // Filter Attendance transactions history
  const getFilteredHistory = () => {
    return attendanceHistory.filter((record) => {
      const nameMatched = `${record.firstName} ${record.lastName}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const phoneMatched = record.whatsAppNumber.includes(searchQuery);

      let matchesSunday = true;
      if (sundayFilter !== "all") {
        matchesSunday = record.date === sundayFilter;
      }

      let matchesMonth = true;
      if (monthFilter !== "all") {
        const m = record.date.substring(5, 7);
        matchesMonth = m === monthFilter;
      }

      let matchesProgram = true;
      if (historyProgramFilter !== "all") {
        matchesProgram = record.eventType === historyProgramFilter;
      }

      let matchesYear = true;
      if (historyYearFilter !== "all") {
        const yr = record.date.substring(0, 4);
        matchesYear = yr === historyYearFilter;
      }

      return (nameMatched || phoneMatched) && matchesSunday && matchesMonth && matchesProgram && matchesYear;
    });
  };

  // Filter message campaigns logs
  const getFilteredCampaignLogs = () => {
    return whatsAppLogs.filter((log) => {
      const nameMatched = log.personName
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const phoneMatched = log.whatsAppNumber.includes(searchQuery);
      
      let matchesType = true;
      if (campaignTypeFilter !== "all") {
        matchesType = log.messageType === campaignTypeFilter;
      }
      
      let matchesDate = true;
      if (campaignDateFilter !== "all") {
        const logDateStr = log.dateSent || (log.sentAt ? log.sentAt.split("T")[0] : "");
        matchesDate = logDateStr === campaignDateFilter;
      }

      return (nameMatched || phoneMatched) && matchesType && matchesDate;
    });
  };

  return (
    <div
      id="church-root-container"
      className="min-h-screen flex flex-col font-sans transition-colors duration-200"
    >
      {/* Dynamic Slide notifications */}
      <div className="fixed top-5 right-5 z-50 space-y-3 max-w-sm w-full no-print">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, scale: 0.9, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: 30 }}
              className={`p-4 rounded-2xl shadow-lg flex items-start gap-2.5 border text-sm font-medium ${
                n.type === "success"
                  ? "bg-emerald-550 border-emerald-500 text-white dark:bg-emerald-950/90 dark:text-emerald-450 dark:border-emerald-900"
                  : n.type === "error"
                    ? "bg-rose-550 border-rose-500 text-white dark:bg-rose-950/90 dark:text-rose-400 dark:border-rose-900"
                    : "bg-blue-600 border-blue-500 text-white dark:bg-blue-950/90 dark:text-blue-400 dark:border-blue-900"
              }`}
            >
              <span>
                {n.type === "success" ? "✅" : n.type === "error" ? "⚠️" : "ℹ️"}
              </span>
              <p className="flex-1">{n.msg}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Primary Header Segment */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-250/55 dark:border-slate-800 py-3 px-4 sm:px-8 flex items-center justify-between no-print shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl shadow-md">
            <QrCode size={20} className="animate-pulse" />
          </div>
          <div>
            <span className="text-sm font-bold font-display tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-1">
              Church Manager <Sparkles size={11} className="text-amber-500" />
            </span>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Attendance & Campaigns Hub
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {viewMode === "admin" && (
            <button
              type="button"
              onClick={() => {
                window.history.pushState(null, "", "/");
                setViewMode("guest");
              }}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-450 hover:bg-slate-50 dark:hover:bg-slate-950 cursor-pointer transition-all"
            >
              📱 Public Register view
            </button>
          )}

          <button
            type="button"
            onClick={toggleDarkMode}
            className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-950 rounded-xl cursor-pointer"
            title="Toggle theme mode"
          >
            {darkMode ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {user && (
            <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-3">
              <div className="hidden sm:block text-right">
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-350">
                  {user.displayName || "Admin User"}
                </span>
                <span className="block text-[10px] text-indigo-500 dark:text-indigo-400 font-bold">
                  {adminRole}
                </span>
              </div>
              <button
                type="button"
                onClick={handleAdminSignOut}
                className="p-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950/40 cursor-pointer"
                title="Disconnect administrative account"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Sections */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-center">
        {/* 1. GUEST FORM ATTENDANCE MODE */}
        {viewMode === "guest" && (
          <div className="py-8 sm:py-16">
            <AttendanceForm />

            <div className="mt-8 text-center max-w-sm mx-auto no-print">
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                Are you an administrator? Click the top-right button, select
                your authorized church email, and access the charts panel.
              </p>
            </div>
          </div>
        )}

        {/* 2. ADMIN DIRECTIVES WITHOUT ACTIVE SESSION */}
        {viewMode === "admin" && !user && (
          <div
            className="max-w-md w-full mx-auto py-16 sm:py-24"
            id="admin-login-prompt"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-xl text-center relative"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
              <div className="mx-auto w-16 h-16 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-5">
                <Lock size={28} />
              </div>
              <h1 className="text-2xl font-display font-bold text-slate-800 dark:text-slate-100 mb-2">
                Pastor & Admin Portal
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-6">
                Please authenticate using your registered administrator
                credentials. Only authorized personnel can manage the church
                attendance database.
              </p>

              {authError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-450 rounded-xl text-xs font-semibold mb-5 text-left">
                  ⚠️ Verify Error: {authError}
                </div>
              )}

              <form
                onSubmit={handleAdminSignIn}
                className="space-y-4 text-left"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
                    Administrator Email
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="e.g. pastor@church.com"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-850 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
                    System Secret Password
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter access password"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-850 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-450 text-white rounded-xl font-bold tracking-tight text-sm cursor-pointer shadow transition-all mt-6"
                >
                  {authLoading ? (
                    <RefreshCw className="animate-spin" size={18} />
                  ) : (
                    <Lock size={18} />
                  )}
                  <span>Authenticate Dashboard</span>
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between text-[11px] font-mono text-slate-400 dark:text-slate-500">
                  <span>Authorizations: Managed</span>
                  <span>Zero-Trust Security</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* 3. SIGNED-IN WORKSPACE DASHBOARD */}
        {viewMode === "admin" && user && adminRole && subInfo?.isExpired && adminRole !== "Super Admin" ? (
          <div className="flex-grow flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-md"
            >
              <div className="flex flex-col items-center text-center">
                <span className="p-1 px-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold rounded-full text-[10px] uppercase tracking-wider mb-4 flex items-center gap-1.5 animate-pulse">
                  ⚠️ LICENSE DEACTIVATED
                </span>
                <h3 className="text-xl font-display font-bold text-slate-800 dark:text-slate-100">
                  Church Portal Blocked
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed">
                  The church administration licensing subscription has reached its expiration date. While public attendance registration continues in the background, system views are locked. To resume, please contact your Super Admin to log in and renew the license key.
                </p>
              </div>

              {!subUnlockedSuperAdmin ? (
                <form onSubmit={handleSubUnlockAuth} className="mt-6 space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest text-center mb-2">
                    Super Admin Unlock Credentials
                  </h4>

                  {subUnlockError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 text-xs font-bold rounded-xl text-center">
                      {subUnlockError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                      Super Admin Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. fidelisemus@gmail.com"
                      value={subUnlockEmail}
                      onChange={(e) => setSubUnlockEmail(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-800 dark:text-slate-100 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                      System Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter system access password"
                      value={subUnlockPassword}
                      onChange={(e) => setSubUnlockPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-800 dark:text-slate-100 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-sm"
                  >
                    Authenticate Super Admin
                  </button>
                </form>
              ) : (
                <div className="mt-6 space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 text-xs font-bold rounded-xl text-center">
                    Super Admin Verified: {subUnlockedSuperAdmin.email}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-605 dark:text-slate-400 mb-2 font-semibold">
                      Select Extension Plan Type
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["Monthly", "Quarterly", "Yearly"] as const).map((plan) => (
                        <button
                          key={plan}
                          type="button"
                          onClick={() => setSubSelectedPlan(plan)}
                          className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            subSelectedPlan === plan
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-850 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {plan}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyNewSubscriptionPlan}
                    disabled={subApplying}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-sm"
                  >
                    {subApplying ? "Enforcing New License..." : `Activate ${subSelectedPlan} Subscription`}
                  </button>
                </div>
              )}

              <div className="mt-6 flex justify-between items-center text-[10px] font-mono text-slate-400">
                <span>Safe Mode Active</span>
                <button
                  onClick={handleAdminSignOut}
                  className="text-red-500 hover:underline font-bold"
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        ) : viewMode === "admin" && user && adminRole && (
          <div className="space-y-6 flex-1 flex flex-col">
            {/* Horizontal Command Sidebar */}
            <nav className="flex overflow-auto gap-1 border-b border-slate-200 dark:border-slate-850 pb-2 scrollbar-none no-print">
              <button
                type="button"
                onClick={() => setAdminTab("dashboard")}
                className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold tracking-tight shrink-0 transition-all cursor-pointer ${
                  adminTab === "dashboard"
                    ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                📊 Dashboard Summary
              </button>
              <button
                type="button"
                onClick={() => setAdminTab("tickets")}
                className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold tracking-tight shrink-0 transition-all cursor-pointer ${
                  adminTab === "tickets"
                    ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                }`}
              >
                📱 QR Code Tickets
              </button>
              <button
                type="button"
                onClick={() => setAdminTab("registers")}
                className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold tracking-tight shrink-0 transition-all cursor-pointer ${
                  adminTab === "registers"
                    ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                }`}
              >
                👥 Attendance Rosters
              </button>
              <button
                type="button"
                onClick={() => setAdminTab("absentees")}
                className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold tracking-tight shrink-0 transition-all cursor-pointer ${
                  adminTab === "absentees"
                    ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                }`}
              >
                📉 Absentees Followups
              </button>
              <button
                type="button"
                onClick={() => setAdminTab("campaigns")}
                className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold tracking-tight shrink-0 transition-all cursor-pointer ${
                  adminTab === "campaigns"
                    ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                }`}
              >
                💬 WhatsApp Logs
              </button>
              {adminRole === "Super Admin" && (
                <>
                  <button
                    type="button"
                    onClick={() => setAdminTab("settings")}
                    className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold tracking-tight shrink-0 transition-all cursor-pointer ${
                      adminTab === "settings"
                        ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    ⚙️ Meta Configuration
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminTab("roles")}
                    className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold tracking-tight shrink-0 transition-all cursor-pointer ${
                      adminTab === "roles"
                        ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    👨‍💼 Administrative Roles
                  </button>
                </>
              )}
            </nav>

            {/* TAB CONTENT PANEL */}
            <div className="flex-1 flex flex-col">
              {/* 1. MAIN SUMMARY & ANALYTICS CHARTS TAB */}
              {adminTab === "dashboard" && (
                <div className="space-y-6" id="dashboard-tab-panel">
                  {/* KPI Panels Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm flex items-center gap-4">
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl">
                        <Users size={22} />
                      </div>
                      <div>
                        <span className="block text-2xl font-bold font-display text-slate-800 dark:text-slate-100">
                          {stats.totalMembers || 0}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Total Members
                        </span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm flex items-center gap-4">
                      <div className="p-3 bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 rounded-xl">
                        <Shield size={22} />
                      </div>
                      <div>
                        <span className="block text-2xl font-bold font-display text-slate-800 dark:text-slate-100">
                          {stats.totalWorkers || 0}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Total Workers
                        </span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm flex items-center gap-4">
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                        <CheckCircle size={22} />
                      </div>
                      <div>
                        <span className="block text-2xl font-bold font-display text-slate-800 dark:text-slate-100">
                          {stats.membersPresent + stats.workersPresent || 0}
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Present Active Today
                        </span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm flex items-center gap-4">
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-450 rounded-xl">
                        <AlertTriangle size={22} />
                      </div>
                      <div>
                        <span className="block text-2xl font-bold font-display text-slate-800 dark:text-slate-100">
                          {stats.absentMembers + stats.absentWorkers || 0}
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Absent Today
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* INTERACTIVE FILTERS FOR DASHBOARD STATISTICS */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-6 rounded-2xl shadow-sm no-print space-y-4" id="dashboard-filters-card">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-1.5">
                          <span>🔍 Live Statistics filters</span>
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Filter the program-specific attendances in real-time below.</p>
                      </div>
                      
                      <button 
                        type="button"
                        onClick={() => {
                          setDashboardProgramFilter("all");
                          setDashboardDateFilter("all");
                          setDashboardMonthFilter("all");
                          setDashboardYearFilter("all");
                          setDashboardRoleFilter("all");
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer flex items-center gap-1"
                      >
                        🔄 Reset Filter Variables
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-1">
                      {/* 1. Program Category */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Program Type</label>
                        <select
                          value={dashboardProgramFilter}
                          onChange={(e) => setDashboardProgramFilter(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="all">All Programs</option>
                          <option value="Sunday Experience">Sunday Experience</option>
                          <option value="Word Cafe">Word Cafe</option>
                          <option value="Special Program">Special Program</option>
                        </select>
                      </div>

                      {/* 2. Specific Date */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Specific Date</label>
                        <select
                          value={dashboardDateFilter}
                          onChange={(e) => setDashboardDateFilter(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="all">All Sundays / Dates</option>
                          {sundaysList.map((dt) => (
                            <option key={dt} value={dt}>
                              {dt}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 3. Month Filter */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Month</label>
                        <select
                          value={dashboardMonthFilter}
                          onChange={(e) => setDashboardMonthFilter(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="all">All Months</option>
                          <option value="January">January</option>
                          <option value="February">February</option>
                          <option value="March">March</option>
                          <option value="April">April</option>
                          <option value="May">May</option>
                          <option value="June">June</option>
                          <option value="July">July</option>
                          <option value="August">August</option>
                          <option value="September">September</option>
                          <option value="October">October</option>
                          <option value="November">November</option>
                          <option value="December">December</option>
                        </select>
                      </div>

                      {/* 4. Year Filter */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Year</label>
                        <select
                          value={dashboardYearFilter}
                          onChange={(e) => setDashboardYearFilter(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="all">All Years</option>
                          <option value="2026">2026</option>
                          <option value="2025">2025</option>
                          <option value="2024">2024</option>
                        </select>
                      </div>

                      {/* 5. Member / Worker Role */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Roster Role</label>
                        <select
                          value={dashboardRoleFilter}
                          onChange={(e) => setDashboardRoleFilter(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="all">All Ranks (Members & Workers)</option>
                          <option value="member">Members Only</option>
                          <option value="worker">Workers Only</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* LIVE PROGRAM-SPECIFIC STATISTICS PANEL */}
                  {(() => {
                    // Pre-compute filtered stats in real-time
                    const filteredRecordsForStats = attendanceHistory.filter((rec: any) => {
                      if (dashboardProgramFilter !== "all" && rec.eventType !== dashboardProgramFilter) return false;
                      if (dashboardDateFilter !== "all" && rec.date !== dashboardDateFilter) return false;
                      if (dashboardMonthFilter !== "all") {
                        const recMonth = String(rec.month || "");
                        const matchesName = recMonth.toLowerCase().includes(dashboardMonthFilter.toLowerCase()) || 
                                           String(new Date(rec.date).getMonth() + 1).padStart(2, '0') === dashboardMonthFilter;
                        if (!matchesName) return false;
                      }
                      if (dashboardYearFilter !== "all" && String(rec.year || new Date(rec.date).getFullYear()) !== dashboardYearFilter) return false;
                      if (dashboardRoleFilter !== "all") {
                        const recRole = String(rec.personType || rec.role || "").toLowerCase();
                        if (recRole !== dashboardRoleFilter.toLowerCase()) return false;
                      }
                      return true;
                    });

                    const compileMetrics = (prog: string) => {
                      const records = filteredRecordsForStats.filter((r: any) => r.eventType === prog);
                      const mCount = records.filter((r: any) => String(r.personType || r.role || "").toLowerCase() === "member").length;
                      const wCount = records.filter((r: any) => String(r.personType || r.role || "").toLowerCase() === "worker").length;
                      return { total: records.length, members: mCount, workers: wCount };
                    };

                    const sExp = compileMetrics("Sunday Experience");
                    const wCafe = compileMetrics("Word Cafe");
                    const sProg = compileMetrics("Special Program");

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5" id="program-metrics-dashboard">
                        {/* 1. Sunday Experience Card */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-850 pb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">📅</span>
                              <div>
                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Sunday Experience</h4>
                                <span className="text-[10px] text-slate-400 font-sans">Worship Service Metrics</span>
                              </div>
                            </div>
                            <span className="text-2xl font-black text-slate-800 dark:text-slate-100 font-display">{sExp.total}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-center">
                            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                              <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider">Members</span>
                              <span className="text-lg font-black text-blue-600 dark:text-blue-400 font-display">{sExp.members}</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                              <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider">Workers</span>
                              <span className="text-lg font-black text-violet-600 dark:text-violet-400 font-display">{sExp.workers}</span>
                            </div>
                          </div>

                          {/* Visual progress share bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-slate-400">
                              <span>Members ({sExp.total > 0 ? Math.round((sExp.members / sExp.total) * 100) : 0}%)</span>
                              <span>Workers ({sExp.total > 0 ? Math.round((sExp.workers / sExp.total) * 100) : 0}%)</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden flex">
                              <div 
                                style={{ width: `${sExp.total > 0 ? (sExp.members / sExp.total) * 100 : 50}%` }} 
                                className="h-full bg-blue-500" 
                              />
                              <div 
                                style={{ width: `${sExp.total > 0 ? (sExp.workers / sExp.total) * 100 : 50}%` }} 
                                className="h-full bg-violet-500" 
                              />
                            </div>
                          </div>
                        </div>

                        {/* 2. Word Cafe Card */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-850 pb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="p-2.5 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 rounded-xl">📚</span>
                              <div>
                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Word Cafe</h4>
                                <span className="text-[10px] text-slate-400 font-sans">Midweek Study Metrics</span>
                              </div>
                            </div>
                            <span className="text-2xl font-black text-slate-800 dark:text-slate-100 font-display">{wCafe.total}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-center">
                            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                              <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider">Members</span>
                              <span className="text-lg font-black text-blue-600 dark:text-blue-400 font-display">{wCafe.members}</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                              <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider">Workers</span>
                              <span className="text-lg font-black text-violet-600 dark:text-violet-400 font-display">{wCafe.workers}</span>
                            </div>
                          </div>

                          {/* Visual progress share bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-slate-400">
                              <span>Members ({wCafe.total > 0 ? Math.round((wCafe.members / wCafe.total) * 100) : 0}%)</span>
                              <span>Workers ({wCafe.total > 0 ? Math.round((wCafe.workers / wCafe.total) * 100) : 0}%)</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden flex">
                              <div 
                                style={{ width: `${wCafe.total > 0 ? (wCafe.members / wCafe.total) * 100 : 50}%` }} 
                                className="h-full bg-blue-500" 
                              />
                              <div 
                                style={{ width: `${wCafe.total > 0 ? (wCafe.workers / wCafe.total) * 100 : 50}%` }} 
                                className="h-full bg-violet-500" 
                              />
                            </div>
                          </div>
                        </div>

                        {/* 3. Special Program Card */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-850 pb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">⭐</span>
                              <div>
                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Special Program</h4>
                                <span className="text-[10px] text-slate-400 font-sans">Unique Event Metrics</span>
                              </div>
                            </div>
                            <span className="text-2xl font-black text-slate-800 dark:text-slate-100 font-display">{sProg.total}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-center">
                            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                              <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider">Members</span>
                              <span className="text-lg font-black text-blue-600 dark:text-blue-400 font-display">{sProg.members}</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                              <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider">Workers</span>
                              <span className="text-lg font-black text-violet-600 dark:text-violet-400 font-display">{sProg.workers}</span>
                            </div>
                          </div>

                          {/* Visual progress share bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-slate-400">
                              <span>Members ({sProg.total > 0 ? Math.round((sProg.members / sProg.total) * 100) : 0}%)</span>
                              <span>Workers ({sProg.total > 0 ? Math.round((sProg.workers / sProg.total) * 105 ? 100 : 0) : 0}%)</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden flex">
                              <div 
                                style={{ width: `${sProg.total > 0 ? (sProg.members / sProg.total) * 100 : 50}%` }} 
                                className="h-full bg-blue-500" 
                              />
                              <div 
                                style={{ width: `${sProg.total > 0 ? (sProg.workers / sProg.total) * 100 : 50}%` }} 
                                className="h-full bg-violet-500" 
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Dynamic triggers for Dev check/automated comparison */}
                  <div className="bg-blue-50/50 dark:bg-slate-900 border border-blue-150 dark:border-slate-880 p-5 rounded-2xl flex flex-col gap-4 no-print shadow-sm">
                    <div className="flex gap-3">
                      <div className="p-2.5 bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl inline-block flex-shrink-0 self-start">
                        <Activity size={20} className="animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Automated WhatsApp Message & Follow-up Scheduler Engine
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                          Automatically broadcasts weekly messages and handles Sunday comparisons. You can also trigger campaigns manually for testing or live broadasts below:
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                      <button
                        type="button"
                        onClick={handleTriggerWednesdayCampaign}
                        disabled={runningScheduler}
                        className="py-2.5 px-3.5 bg-slate-850 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-750 text-white rounded-xl text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 cursor-pointer shadow transition-all duration-150"
                      >
                        <RefreshCw
                          size={13}
                          className={runningScheduler ? "animate-spin" : ""}
                        />
                        <span>Run Wednesday Reminder</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleTriggerSaturdayCampaign}
                        disabled={runningScheduler}
                        className="py-2.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 cursor-pointer shadow transition-all duration-150"
                      >
                        <RefreshCw
                          size={13}
                          className={runningScheduler ? "animate-spin" : ""}
                        />
                        <span>Run Saturday Broadcaster</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleTriggerSundayComparison}
                        disabled={runningScheduler}
                        className="py-2.5 px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white rounded-xl text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 cursor-pointer shadow transition-all duration-150"
                      >
                        <RefreshCw
                          size={13}
                          className={runningScheduler ? "animate-spin" : ""}
                        />
                        <span>Run Sunday Absent Check</span>
                      </button>
                    </div>
                  </div>

                  {/* Absentee Registrants Dashboard Highlight */}
                  {(() => {
                    const absentMembersList = members.filter(m => m.currentStatus === "Absent");
                    const absentWorkersList = workers.filter(w => w.currentStatus === "Absent");
                    const totalAbsentees = absentMembersList.length + absentWorkersList.length;

                    return (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-5 sm:p-6 rounded-2xl shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse" />
                              <span>🚨 Roster Log Absentees (Follow-up List)</span>
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Registered members and workers who missed Sunday Experience and are currently marked as Absent.
                            </p>
                          </div>
                          <span className="text-xs font-bold font-mono px-2.5 py-1 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-full shrink-0 self-start sm:self-auto">
                            {totalAbsentees} Logged Absentees
                          </span>
                        </div>

                        {totalAbsentees === 0 ? (
                          <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-xl text-center text-xs font-medium text-slate-400 italic">
                            No registrants are currently marked as Absent. Excellent attendance streak! 🎉
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[250px] overflow-y-auto pr-1">
                            {/* Members */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
                                Absent Members ({absentMembersList.length})
                              </h4>
                              {absentMembersList.length === 0 ? (
                                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-center text-xs text-slate-400 italic">
                                  No absent members
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {absentMembersList.map(m => (
                                    <div key={m.id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850 flex items-center justify-between text-xs">
                                      <div>
                                        <span className="font-bold text-slate-700 dark:text-slate-200">{m.firstName} {m.lastName}</span>
                                        <span className="block font-mono text-[10px] text-slate-400 mt-0.5">{m.whatsAppNumber}</span>
                                      </div>
                                      <span className="px-2 py-0.5 rounded-md font-bold text-[9px] bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 uppercase">Member</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Workers */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
                                Absent Workers ({absentWorkersList.length})
                              </h4>
                              {absentWorkersList.length === 0 ? (
                                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-center text-xs text-slate-400 italic">
                                  No absent workers
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {absentWorkersList.map(w => (
                                    <div key={w.id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850 flex items-center justify-between text-xs">
                                      <div>
                                        <span className="font-bold text-slate-700 dark:text-slate-200">{w.firstName} {w.lastName}</span>
                                        <span className="block font-mono text-[10px] text-slate-400 mt-0.5">{w.whatsAppNumber}</span>
                                      </div>
                                      <span className="px-2 py-0.5 rounded-md font-bold text-[9px] bg-violet-50 text-violet-600 dark:bg-violet-950/20 dark:text-violet-400 uppercase">Worker</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                    )}
                      </div>
                    );
                  })()}

                  {/* Interactive Recharts Analytics Panels */}
                  <AnalyticsCharts
                    stats={stats}
                    attendanceHistory={attendanceHistory}
                    sundaysList={sundaysList}
                  />
                </div>
              )}

              {/* 2. QR CODE SERVICE TICKETS TAB */}
              {adminTab === "tickets" && (
                <div
                  className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-6 sm:p-8 rounded-2xl shadow-sm"
                  id="qr-tickets-tab-panel"
                >
                  <div className="max-w-xl mb-6">
                    <h2 className="text-xl font-display font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1.5">
                      <QrCode size={20} className="text-blue-500" />
                      Dynamic Sunday Ticket Builder
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Configure a service Sunday date, generate a unique canvas
                      barcode, download or print. Scanning this points members
                      straight to their mobile register!
                    </p>
                  </div>
                  <QrCodeGenerator
                    appUrl={appUrl}
                    sundaysList={sundaysList}
                    onSundayAdded={loadAllAdminData}
                  />
                </div>
              )}

              {/* 3. ROSTERS RECOGNITION REGISTERS TAB */}
              {adminTab === "registers" && (
                <div className="space-y-6" id="registers-tab-panel">
                  {/* Inline sub tab options */}
                  <div className="flex justify-between items-center no-print">
                    <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/40 dark:border-slate-850">
                      <button
                        type="button"
                        onClick={() => {
                          setRegisterSubTab("members");
                          setSearchQuery("");
                        }}
                        className={`text-xs font-bold py-2 px-4 rounded-lg transform transition-all cursor-pointer ${
                          registerSubTab === "members"
                            ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Members Database ({members.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRegisterSubTab("workers");
                          setSearchQuery("");
                        }}
                        className={`text-xs font-bold py-2 px-4 rounded-lg transform transition-all cursor-pointer ${
                          registerSubTab === "workers"
                            ? "bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Workers Database ({workers.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRegisterSubTab("history");
                          setSearchQuery("");
                        }}
                        className={`text-xs font-bold py-2 px-4 rounded-lg transform transition-all cursor-pointer ${
                          registerSubTab === "history"
                            ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Transaction History ({attendanceHistory.length})
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewPersonType(
                            registerSubTab === "workers" ? "worker" : "member",
                          );
                          setShowAddPersonModal(true);
                        }}
                        className="py-2 px-3.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus size={14} /> Add Person
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setImportRawText("");
                          setImportFileError(null);
                          setImportResult(null);
                          setShowImportModal(true);
                        }}
                        className="py-2 px-3.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-955/40 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                      >
                        <Upload size={14} /> Import Attendance
                      </button>

                      {registerSubTab === "history" ? (
                        <>
                          <button
                            type="button"
                            id="export-history-excel-btn"
                            onClick={handleExportExcel}
                            className="py-2 px-3.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                          >
                            <FileSpreadsheet size={14} /> Export Excel
                          </button>

                          <button
                            type="button"
                            id="export-history-pdf-btn"
                            onClick={handleExportPDF}
                            className="py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                          >
                            <Download size={14} /> Export PDF
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            id="export-roster-excel-btn"
                            onClick={() => {
                              const list =
                                registerSubTab === "workers" ? workers : members;
                              const filtered = getFilteredPersons(list);
                              const rows = filtered.map((item) => [
                                `${item.firstName} ${item.lastName}`,
                                item.whatsAppNumber,
                                item.currentStatus,
                                item.lastAttendanceDate,
                                item.messageDeliveryStatus || "None",
                              ]);
                              handleExportCSV(
                                rows,
                                [
                                  "Full Name",
                                  "Phone",
                                  "Status",
                                  "Last Attendance Sunday",
                                  "Latest WhatsApp status",
                                ],
                                `church_${registerSubTab}_database_${Date.now()}.csv`,
                              );
                            }}
                            className="py-2 px-3.5 bg-slate-800 dark:bg-slate-820 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                          >
                            <FileSpreadsheet size={14} /> Export Excel
                          </button>

                          <button
                            type="button"
                            id="roster-print-btn"
                            onClick={triggerBrowserPrint}
                            className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-750 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                          >
                            <Printer size={14} /> Print
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Main Search & Filters Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 rounded-2xl p-4 space-y-3.5 shadow-sm no-print">
                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        placeholder="Search roster by spelling first/last name or typing phone number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none"
                      />
                    </div>

                    {registerSubTab === "history" ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* 1. Program Category Filter */}
                        <div>
                          <select
                            id="filter-program-type"
                            value={historyProgramFilter}
                            onChange={(e) => setHistoryProgramFilter(e.target.value)}
                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 focus:outline-none cursor-pointer"
                          >
                            <option value="all">⛪ All Programs</option>
                            <option value="Sunday Experience">Sunday Experience</option>
                            <option value="Word Cafe">Word Cafe</option>
                            <option value="Special Program">Special Program</option>
                          </select>
                        </div>

                        {/* 2. Month Filter */}
                        <div>
                          <select
                            id="filter-month"
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 focus:outline-none cursor-pointer"
                          >
                            <option value="all">📅 All Months</option>
                            <option value="01">January</option>
                            <option value="02">February</option>
                            <option value="03">March</option>
                            <option value="04">April</option>
                            <option value="05">May</option>
                            <option value="06">June</option>
                            <option value="07">July</option>
                            <option value="08">August</option>
                            <option value="09">September</option>
                            <option value="10">October</option>
                            <option value="11">November</option>
                            <option value="12">December</option>
                          </select>
                        </div>

                        {/* 3. Date / Sunday Filter */}
                        <div>
                          <select
                            id="filter-date"
                            value={sundayFilter}
                            onChange={(e) => setSundayFilter(e.target.value)}
                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 focus:outline-none cursor-pointer"
                          >
                            <option value="all">📅 All Dates</option>
                            {Array.from(new Set(attendanceHistory.map(r => r.date).filter(Boolean))).sort().reverse().map((dt) => (
                              <option key={dt} value={dt}>
                                📅 {dt}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* 4. Year Filter */}
                        <div>
                          <select
                            id="filter-year"
                            value={historyYearFilter}
                            onChange={(e) => setHistoryYearFilter(e.target.value)}
                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 focus:outline-none cursor-pointer"
                          >
                            <option value="all">📆 All Years</option>
                            <option value="2026">2026</option>
                            <option value="2025">2025</option>
                            <option value="2024">2024</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 md:w-80 ms-auto">
                        <div>
                          <select
                            id="filter-roster-month"
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-600 dark:text-slate-400 font-bold focus:outline-none cursor-pointer"
                          >
                            <option value="all">📅 All Months</option>
                            <option value="01">January</option>
                            <option value="02">February</option>
                            <option value="03">March</option>
                            <option value="04">April</option>
                            <option value="05">May</option>
                            <option value="06">June</option>
                            <option value="07">July</option>
                            <option value="08">August</option>
                            <option value="09">September</option>
                            <option value="10">October</option>
                            <option value="11">November</option>
                            <option value="12">December</option>
                          </select>
                        </div>

                        <div>
                          <select
                            id="filter-roster-sunday"
                            value={sundayFilter}
                            onChange={(e) => setSundayFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-600 dark:text-slate-400 font-bold focus:outline-none cursor-pointer"
                          >
                            <option value="all">⛪ All Sundays</option>
                            {sundaysList.map((sun) => (
                              <option key={sun} value={sun}>
                                ⛪ {formatDisplayDate(sun)} ({sun})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Standard Registers Tables */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    {/* Header text on Print */}
                    <div className="hidden print:block text-center p-6 border-b">
                      <h2 className="text-xl font-bold font-display text-black">
                        Church Attendance Register Report
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Roster Type:{" "}
                        <span className="font-bold">
                          {registerSubTab.toUpperCase()}
                        </span>{" "}
                        | Exported: {new Date().toLocaleString()}
                      </p>
                    </div>

                    {registerSubTab === "history" ? (
                      <div className="overflow-x-auto min-h-[350px]">
                        <table className="w-full text-left border-collapse text-sm text-slate-700 dark:text-slate-350">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200/50 dark:border-slate-850 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                              <th className="py-3 px-4">Date</th>
                              <th className="py-3 px-4">Attendee Name</th>
                              <th className="py-3 px-4">Category</th>
                              <th className="py-3 px-4">Event / Service</th>
                              <th className="py-3 px-4">WhatsApp Phone</th>
                              <th className="py-3 px-4">Gender</th>
                              <th className="py-3 px-4">Registered At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getFilteredHistory().length === 0 ? (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="py-8 text-center text-xs font-semibold text-slate-400 uppercase tracking-widest leading-relaxed"
                                >
                                  No transaction records found matching filters.
                                </td>
                              </tr>
                            ) : (
                              getFilteredHistory().map((record) => (
                                <tr
                                  key={record.id}
                                  className="border-b last:border-0 border-slate-200/30 dark:border-slate-850 hover:bg-slate-50/50"
                                >
                                  <td className="py-3 px-4 font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                                    {record.date}
                                  </td>
                                  <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-100">
                                    {record.firstName} {record.lastName}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span
                                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                        record.personType === "worker"
                                          ? "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400"
                                          : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                                      }`}
                                    >
                                      {record.personType}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span
                                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                        record.eventType === "Word Cafe"
                                          ? "bg-violet-100/50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400"
                                          : record.eventType === "Special Program"
                                            ? "bg-amber-100/50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                                            : "bg-blue-105-emerald/10 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                      }`}
                                    >
                                      {record.eventType || "Sunday Experience"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 font-mono text-xs text-slate-505">
                                    {record.whatsAppNumber}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        record.gender === "Male"
                                          ? "bg-blue-55 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                                          : record.gender === "Female"
                                            ? "bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-400"
                                            : "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                      }`}
                                    >
                                      {record.gender || "Unspecified"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-xs font-mono">
                                    {new Date(
                                      record.timestamp,
                                    ).toLocaleTimeString()}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="overflow-x-auto min-h-[350px]">
                        <table className="w-full text-left border-collapse text-sm text-slate-700 dark:text-slate-350">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200/50 dark:border-slate-850 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                              <th className="py-3 px-4">Roster Full Name</th>
                              <th className="py-3 px-4">WhatsApp Phone</th>
                              <th className="py-3 px-4">Gender</th>
                              <th className="py-3 px-4">
                                Latest Attendance Sunday
                              </th>
                              <th className="py-3 px-4">Attending state</th>
                              <th className="py-3 px-4">Check-in Time</th>
                              <th className="py-3 px-4">
                                Latest Campaign status
                              </th>
                              <th className="py-3 px-4 no-print">
                                Database Management
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {getFilteredPersons(
                              registerSubTab === "workers" ? workers : members,
                            ).length === 0 ? (
                              <tr>
                                <td
                                  colSpan={8}
                                  className="py-8 text-center text-xs font-semibold text-slate-400 uppercase tracking-widest leading-relaxed"
                                >
                                  Roster is currently empty. Define records
                                  using the Add Person wizard.
                                </td>
                              </tr>
                            ) : (
                              getFilteredPersons(
                                registerSubTab === "workers"
                                  ? workers
                                  : members,
                              ).map((person) => (
                                <tr
                                  key={person.id}
                                  className="border-b last:border-0 border-slate-200/30 dark:border-slate-850 hover:bg-slate-50/50"
                                >
                                  <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedDetailsPerson(person);
                                        setSelectedDetailsPersonType(registerSubTab === "workers" ? "worker" : "member");
                                      }}
                                      className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-left cursor-pointer transition-all flex items-center gap-1.5 focus:outline-none"
                                      title="View detailed attendance history & timeline"
                                    >
                                      <span>{person.firstName} {person.lastName}</span>
                                      <span className="text-[10px] text-blue-500 font-normal no-underline px-1 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40">
                                        profile 👤
                                      </span>
                                    </button>
                                  </td>
                                  <td className="py-3 px-4 font-mono text-xs">
                                    {person.whatsAppNumber}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        person.gender === "Male"
                                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                                          : person.gender === "Female"
                                            ? "bg-pink-50 text-pink-700 dark:bg-pink-950/20 dark:text-pink-400"
                                            : "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                      }`}
                                    >
                                      {person.gender || "Unspecified"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                                      {person.lastAttendanceDate ||
                                        "Never attended"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    {(() => {
                                      const isPresent = sundayFilter === "all"
                                        ? person.currentStatus === "Present"
                                        : attendanceHistory.some(rec => rec.personId === person.id && rec.date === sundayFilter);

                                      return (
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                              isPresent
                                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                                                : "bg-rose-50 text-rose-700 dark:bg-rose-955/20 dark:text-rose-455"
                                            }`}
                                          >
                                            <span
                                              className={`w-1.5 h-1.5 rounded-full ${
                                                isPresent ? "bg-emerald-500" : "bg-rose-500 animate-pulse"
                                              }`}
                                            />
                                            {isPresent ? "Present" : "Absent"}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleToggleAttendance(person.id, registerSubTab === "workers" ? "worker" : "member")}
                                            className="p-1 px-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer select-none text-[10px] font-bold border border-slate-200 dark:border-slate-800 shadow-xs"
                                            title={`Toggle attendance state for ${sundayFilter === "all" ? "current Sunday" : sundayFilter}`}
                                            disabled={adminRole === "Pastor"}
                                          >
                                            Toggle 🔄
                                          </button>
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
                                    {(() => {
                                      let recordTime = null;
                                      if (sundayFilter === "all") {
                                        recordTime = person.attendedAtTime;
                                      } else {
                                        const match = attendanceHistory.find(
                                          (rec) => rec.personId === person.id && rec.date === sundayFilter
                                        );
                                        recordTime = match ? match.timestamp : null;
                                      }

                                      if (recordTime) {
                                        return new Date(recordTime).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          second: "2-digit",
                                        });
                                      } else {
                                        return (
                                          <span className="text-slate-350 dark:text-slate-700 font-normal">
                                            -
                                          </span>
                                        );
                                      }
                                    })()}
                                  </td>
                                  <td className="py-3 px-4">
                                    {person.messageSent ? (
                                      <span
                                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                          person.messageDeliveryStatus ===
                                          "Read"
                                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/10 dark:text-emerald-400"
                                            : person.messageDeliveryStatus ===
                                                "Delivered"
                                              ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/10 dark:text-cyan-400"
                                              : person.messageDeliveryStatus ===
                                                  "Failed"
                                                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/10 dark:text-rose-400"
                                                : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/10 dark:text-indigo-400"
                                        }`}
                                      >
                                        Campaign:{" "}
                                        {person.messageDeliveryStatus || "Sent"}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold text-slate-400">
                                        No campaigns sent
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 no-print">
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeletePerson(
                                            person.id,
                                            registerSubTab === "workers"
                                              ? "worker"
                                              : "member",
                                          )
                                        }
                                        className="p-1 px-2 text-rose-600 dark:text-rose-455 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer"
                                        title="Delete check records"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 4. RED-HIGHLIGHTED ABSENTEES & FOLLOWUPS TAB */}
              {adminTab === "absentees" && (
                <div className="space-y-6" id="absentees-tab-panel">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-6 rounded-2xl shadow-sm no-print">
                    <h2 className="text-xl font-display font-bold text-slate-800 dark:text-slate-100 mb-1">
                      Absent Members and Workers List (Sunday Highlight)
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Roster logs displaying anyone currently tagged as{" "}
                      <span className="text-rose-500 font-bold font-mono">
                        Absent
                      </span>
                      . Failed automated messages are flagged for manual retries
                      or WhatsApp Web direct redirections.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Absent Members Section */}
                    <div className="bg-white dark:bg-slate-900 border-2 border-rose-300 dark:border-rose-950/50 rounded-2xl overflow-hidden shadow-md">
                      <div className="bg-rose-500 text-white py-3.5 px-5 font-display font-bold tracking-tight text-sm sm:text-base flex items-center justify-between shadow-sm">
                        <span>
                          📢 Absent Members (
                          {
                            getFilteredPersons(members).filter(
                              (m) => m.currentStatus === "Absent",
                            ).length
                          }
                          )
                        </span>
                        <span className="text-xs font-mono uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
                          Red Alert
                        </span>
                      </div>

                      <div className="overflow-x-auto min-h-[300px]">
                        <table className="w-full text-left border-collapse text-sm text-slate-700 dark:text-slate-350">
                          <thead>
                            <tr className="bg-rose-50 dark:bg-slate-950/80 border-b border-rose-100 dark:border-rose-950 font-bold text-rose-700 dark:text-rose-450 uppercase tracking-wider text-[10px]">
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold">
                                Roster Name
                              </th>
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold">
                                WhatsApp Phone
                              </th>
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold">
                                Last Attended Sunday
                              </th>
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold">
                                Campaign Delivery
                              </th>
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold no-print">
                                Trigger Retry
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {getFilteredPersons(members).filter(
                              (m) => m.currentStatus === "Absent",
                            ).length === 0 ? (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="py-8 text-center text-xs font-bold text-slate-400 tracking-widest uppercase italic"
                                >
                                  All members are fully registered! Excellent
                                  streak.
                                </td>
                              </tr>
                            ) : (
                              getFilteredPersons(members)
                                .filter((m) => m.currentStatus === "Absent")
                                .map((person) => (
                                  <tr
                                    key={person.id}
                                    className="border-b last:border-0 border-rose-100/50 dark:border-rose-950/20 hover:bg-rose-50/20"
                                  >
                                    <td className="py-3 px-4 font-bold text-rose-700 dark:text-rose-455">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedDetailsPerson(person);
                                          setSelectedDetailsPersonType("member");
                                        }}
                                        className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-left cursor-pointer transition-all flex items-center gap-1.5 focus:outline-none"
                                        title="View detailed attendance history & timeline"
                                      >
                                        <span>{person.firstName} {person.lastName}</span>
                                        <span className="text-[10px] text-blue-500 font-normal no-underline px-1 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40">
                                          profile 👤
                                        </span>
                                      </button>
                                    </td>
                                    <td className="py-3 px-4 font-mono text-xs">
                                      {person.whatsAppNumber}
                                    </td>
                                    <td className="py-3 px-4 font-mono text-xs">
                                      {person.lastAttendanceDate || "Never"}
                                    </td>
                                    <td className="py-3 px-4 text-xs font-bold">
                                      <span
                                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] ${
                                          person.messageSent
                                            ? person.messageDeliveryStatus ===
                                              "Failed"
                                              ? "bg-rose-100 text-rose-700"
                                              : "bg-indigo-100 text-indigo-700"
                                            : "bg-slate-100 text-slate-500"
                                        }`}
                                      >
                                        {person.messageSent
                                          ? person.messageDeliveryStatus ||
                                            "Sent"
                                          : "Pending"}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 no-print">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleWhatsAppResend({
                                            personId: person.id,
                                            personType: "member",
                                            whatsAppNumber:
                                              person.whatsAppNumber,
                                            messageContent:
                                              "Happy Sunday and hope all is well. We didn't see you in church today. Hope to see you next Sunday, and please feel free to reach out to the church pastor if you need any assistance. God bless you.",
                                          })
                                        }
                                        className="py-1 px-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-600 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                        title="Resend WhatsApp automated campaign"
                                      >
                                        <Send size={10} /> Send Retry
                                      </button>
                                    </td>
                                  </tr>
                                ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Absent Workers Section */}
                    <div className="bg-white dark:bg-slate-900 border-2 border-rose-300 dark:border-rose-950/50 rounded-2xl overflow-hidden shadow-md">
                      <div className="bg-rose-550 text-white py-3.5 px-5 font-display font-bold tracking-tight text-sm sm:text-base flex items-center justify-between shadow-sm">
                        <span>
                          📢 Absent Workers (
                          {
                            getFilteredPersons(workers).filter(
                              (w) => w.currentStatus === "Absent",
                            ).length
                          }
                          )
                        </span>
                        <span className="text-xs font-mono uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
                          Red Alert
                        </span>
                      </div>

                      <div className="overflow-x-auto min-h-[300px]">
                        <table className="w-full text-left border-collapse text-sm text-slate-700 dark:text-slate-350">
                          <thead>
                            <tr className="bg-rose-50 dark:bg-slate-950/80 border-b border-rose-100 dark:border-rose-950 font-bold text-rose-700 dark:text-rose-450 uppercase tracking-wider text-[10px]">
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold">
                                Roster Name
                              </th>
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold">
                                WhatsApp Phone
                              </th>
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold">
                                Last Attended Sunday
                              </th>
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold">
                                Campaign Delivery
                              </th>
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold no-print">
                                Trigger Retry
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {getFilteredPersons(workers).filter(
                              (w) => w.currentStatus === "Absent",
                            ).length === 0 ? (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="py-8 text-center text-xs font-bold text-slate-400 tracking-widest uppercase italic"
                                >
                                  All workers are present in today's rosters!
                                  Great attendance.
                                </td>
                              </tr>
                            ) : (
                              getFilteredPersons(workers)
                                .filter((w) => w.currentStatus === "Absent")
                                .map((person) => (
                                  <tr
                                    key={person.id}
                                    className="border-b last:border-0 border-rose-100/50 dark:border-rose-950/20 hover:bg-rose-50/20"
                                  >
                                    <td className="py-3 px-4 font-bold text-rose-700 dark:text-rose-455">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedDetailsPerson(person);
                                          setSelectedDetailsPersonType("worker");
                                        }}
                                        className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-left cursor-pointer transition-all flex items-center gap-1.5 focus:outline-none"
                                        title="View detailed attendance history & timeline"
                                      >
                                        <span>{person.firstName} {person.lastName}</span>
                                        <span className="text-[10px] text-blue-500 font-normal no-underline px-1 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40">
                                          profile 👤
                                        </span>
                                      </button>
                                    </td>
                                    <td className="py-3 px-4 font-mono text-xs">
                                      {person.whatsAppNumber}
                                    </td>
                                    <td className="py-3 px-4 font-mono text-xs">
                                      {person.lastAttendanceDate || "Never"}
                                    </td>
                                    <td className="py-3 px-4 text-xs font-bold">
                                      <span
                                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] ${
                                          person.messageSent
                                            ? person.messageDeliveryStatus ===
                                              "Failed"
                                              ? "bg-rose-100 text-rose-700"
                                              : "bg-indigo-100 text-indigo-700"
                                            : "bg-slate-100 text-slate-500"
                                        }`}
                                      >
                                        {person.messageSent
                                          ? person.messageDeliveryStatus ||
                                            "Sent"
                                          : "Pending"}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 no-print">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleWhatsAppResend({
                                            personId: person.id,
                                            personType: "worker",
                                            whatsAppNumber:
                                              person.whatsAppNumber,
                                            messageContent:
                                              "Happy Sunday and hope all is well. We didn't see you in church today. Hope to see you next Sunday, and please feel free to reach out to the church pastor if you need any assistance. God bless you.",
                                          })
                                        }
                                        className="py-1 px-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-600 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                      >
                                        <Send size={10} /> Send Retry
                                      </button>
                                    </td>
                                  </tr>
                                ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. WHATSAPP LOGS & CAMPAIGNS TAB */}
              {adminTab === "campaigns" && (
                <div className="space-y-6" id="campaigns-tab-panel">
                  {/* Title & Stats Overview row */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-display font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        Message Logs & Campaign Manager
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Track, search, filter, and resend failed automated or manual WhatsApp dispatches.
                      </p>
                    </div>
                    
                    {/* Tiny stats cards */}
                    <div className="flex gap-4">
                      <div className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl text-center">
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">Total Dispatched</span>
                        <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{whatsAppLogs.length}</span>
                      </div>
                      <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl text-center">
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">Delivered/Read</span>
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                          {whatsAppLogs.filter(l => l.deliveryStatus === "Delivered" || l.deliveryStatus === "Read").length}
                        </span>
                      </div>
                      <div className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/20 rounded-xl text-center">
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">Failed Logs</span>
                        <span className="text-sm font-black text-rose-500 dark:text-rose-400 font-mono">
                          {whatsAppLogs.filter(l => l.deliveryStatus === "Failed").length}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-4 rounded-xl flex flex-col lg:flex-row gap-3 items-center shadow-sm no-print">
                    {/* Search */}
                    <div className="relative flex-1 w-full">
                      <Search
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        placeholder="Search campaign logs by spelling attendee name or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Filter by campaign type */}
                    <div className="w-full lg:w-48">
                      <select
                        value={campaignTypeFilter}
                        onChange={(e) => setCampaignTypeFilter(e.target.value)}
                        className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-400 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="all">All Campaign Types</option>
                        <option value="Sunday Absentee Follow-Up">Sunday Absentee Follow-Up</option>
                        <option value="Saturday Encouragement">Saturday Encouragement</option>
                        <option value="Wednesday Word Cafe Reminder">Wednesday Word Cafe Reminder</option>
                      </select>
                    </div>

                    {/* Filter by date sent */}
                    <div className="w-full lg:w-44">
                      <select
                        value={campaignDateFilter}
                        onChange={(e) => setCampaignDateFilter(e.target.value)}
                        className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-400 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="all">All Dates</option>
                        {Array.from(new Set(whatsAppLogs.map(log => log.dateSent || (log.sentAt ? log.sentAt.split("T")[0] : "")).filter(Boolean))).sort().reverse().map(dt => (
                          <option key={dt} value={dt}>{dt}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const rows = getFilteredCampaignLogs().map((log) => [
                          log.id,
                          log.personName,
                          log.personType,
                          log.whatsAppNumber,
                          log.messageType || "Adhoc",
                          log.messageContent,
                          log.dateSent || (log.sentAt ? log.sentAt.split("T")[0] : ""),
                          log.timeSent || (log.sentAt ? new Date(log.sentAt).toLocaleTimeString() : ""),
                          log.deliveryStatus,
                          log.readStatus || "Unread",
                          log.failedStatus || ""
                        ]);
                        handleExportCSV(
                          rows,
                          [
                            "Message ID",
                            "Person Name",
                            "Category",
                            "Roster Phone",
                            "Campaign Type",
                            "Message Body",
                            "Date Sent",
                            "Time Sent",
                            "Delivery status",
                            "Read Status",
                            "Failed Reason"
                          ],
                          `whatsapp_dispatched_logs_${Date.now()}.csv`,
                        );
                      }}
                      className="py-2 px-4 bg-slate-850 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shrink-0 cursor-pointer w-full lg:w-auto"
                    >
                      <FileSpreadsheet size={14} /> Export CSV
                    </button>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto min-h-[350px]">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm text-slate-700 dark:text-slate-350">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200/50 dark:border-slate-850 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                            <th className="py-3 px-4">Message ID</th>
                            <th className="py-3 px-4">Attendee Name</th>
                            <th className="py-3 px-4">WhatsApp Phone</th>
                            <th className="py-3 px-4">Campaign/Msg Type</th>
                            <th className="py-3 px-4">Dispatched Message</th>
                            <th className="py-3 px-4">Date & Time Sent</th>
                            <th className="py-3 px-4">Delivery Status</th>
                            <th className="py-3 px-4">Read Status</th>
                            <th className="py-3 px-4">Failed Status</th>
                            <th className="py-3 px-4 no-print text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getFilteredCampaignLogs().length === 0 ? (
                            <tr>
                              <td
                                colSpan={10}
                                className="py-12 text-center text-xs font-semibold text-slate-400 tracking-widest uppercase italic"
                              >
                                No dispatched message logs matched those filters.
                              </td>
                            </tr>
                          ) : (
                            getFilteredCampaignLogs().map((log) => {
                              const dsStr = log.dateSent || (log.sentAt ? log.sentAt.split("T")[0] : "N/A");
                              const tsStr = log.timeSent || (log.sentAt ? new Date(log.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A");
                              
                              return (
                                <tr
                                  key={log.id}
                                  className="border-b last:border-0 border-slate-200/30 dark:border-slate-850 hover:bg-slate-50/50"
                                >
                                  <td className="py-3 px-4 font-mono text-[10px] text-slate-400">
                                    #{log.id ? log.id.slice(0, 8) : "Adhoc"}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="font-bold text-slate-850 dark:text-slate-100">
                                      {log.personName}
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                      {log.personType}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 font-mono text-xs">
                                    {log.whatsAppNumber}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      log.messageType === "Saturday Encouragement" 
                                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400"
                                        : log.messageType === "Wednesday Word Cafe Reminder"
                                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                                          : log.messageType === "Sunday Absentee Follow-Up"
                                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                                            : "bg-slate-100 text-slate-700 dark:bg-slate-950/20 dark:text-slate-400"
                                    }`}>
                                      {log.messageType || "Adhoc Direct"}
                                    </span>
                                  </td>
                                  <td
                                    className="py-3 px-4 max-w-xs truncate text-[11px] leading-relaxed"
                                    title={log.messageContent}
                                  >
                                    {log.messageContent}
                                  </td>
                                  <td className="py-3 px-4 text-xs">
                                    <div className="font-bold text-slate-700 dark:text-slate-300">{dsStr}</div>
                                    <div className="text-[10px] font-mono text-slate-400">{tsStr}</div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold leading-none ${
                                        log.deliveryStatus === "Read"
                                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                                          : log.deliveryStatus === "Delivered"
                                            ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/20 dark:text-cyan-400"
                                            : log.deliveryStatus === "Failed"
                                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 animate-pulse"
                                              : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400"
                                      }`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          log.deliveryStatus === "Read"
                                            ? "bg-emerald-500"
                                            : log.deliveryStatus === "Delivered"
                                              ? "bg-cyan-400"
                                              : log.deliveryStatus === "Failed"
                                                ? "bg-rose-500"
                                                : "bg-indigo-500"
                                        }`}
                                      />
                                      {log.deliveryStatus}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={`text-xs font-bold uppercase tracking-wider ${
                                      log.readStatus === "Read" || log.deliveryStatus === "Read"
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-slate-400"
                                    }`}>
                                      {log.readStatus === "Read" || log.deliveryStatus === "Read" ? "Read ✓✓" : "Unread"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 max-w-[120px] truncate text-[10px] text-slate-400 italic" title={log.failedStatus || ""}>
                                    {log.failedStatus || <span className="text-slate-350 dark:text-slate-600">—</span>}
                                  </td>
                                  <td className="py-3 px-4 no-print text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleWhatsAppResend(log)}
                                      className="p-1 px-2.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-all duration-150 border border-slate-100 dark:border-slate-800"
                                    >
                                      <Send size={11} /> Resend
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 6. WHATSAPP META BUSINESS PARAMS TAB */}
              {adminTab === "settings" && adminRole === "Super Admin" && (
                <div
                  className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                  id="settings-tab-panel"
                >
                  {/* Meta edit settings form */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-6 sm:p-8 rounded-2xl shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />

                    <div className="mb-6">
                      <h3 className="text-lg font-display font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">
                        <Settings size={18} className="text-indigo-500" />
                        Meta WhatsApp Cloud API settings
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        System configuration credentials used by the server's
                        background scheduler to run automatic text
                        communications coming from the official organization
                        account.
                      </p>
                    </div>

                    <form
                      onSubmit={handleSaveWhatsAppConfig}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">
                          Official Church WhatsApp Phone Number
                        </label>
                        <input
                          type="text"
                          placeholder="+234 803 123 4567"
                          value={whatsAppConfig.churchWhatsAppNumber}
                          onChange={(e) =>
                            setWhatsAppConfig({
                              ...whatsAppConfig,
                              churchWhatsAppNumber: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-800 dark:text-slate-100 text-sm font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">
                            Meta Phone Number ID
                          </label>
                          <input
                            type="text"
                            placeholder="123456789012345"
                            value={whatsAppConfig.phoneNumberId}
                            onChange={(e) =>
                              setWhatsAppConfig({
                                ...whatsAppConfig,
                                phoneNumberId: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-800 dark:text-slate-100 font-mono text-xs font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">
                            Meta Business Account ID
                          </label>
                          <input
                            type="text"
                            placeholder="678901234567890"
                            value={whatsAppConfig.businessAccountId}
                            onChange={(e) =>
                              setWhatsAppConfig({
                                ...whatsAppConfig,
                                businessAccountId: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-800 dark:text-slate-100 font-mono text-xs font-medium"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">
                          Permanent Access Token (GraphQL Bearer)
                        </label>
                        <textarea
                          placeholder="EAACwj88..."
                          rows={4}
                          value={whatsAppConfig.accessToken}
                          onChange={(e) =>
                            setWhatsAppConfig({
                              ...whatsAppConfig,
                              accessToken: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-800 dark:text-slate-100 font-mono text-xs font-medium leading-relaxed mb-4"
                        />
                      </div>

                      <div className="border-t border-slate-100 dark:border-slate-800 pt-5 mt-5">
                        <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-bold text-sm mb-1.5 uppercase tracking-wide">
                          📱 Follow-up Message Templates
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                          Admins can customize separate automated follow-up
                          messages sent to absent members and workers. Use{" "}
                          <code className="font-mono text-indigo-500 text-xs px-1 bg-slate-105 border border-slate-200/50 dark:bg-slate-950 dark:border-slate-800 py-0.5 rounded">{`{Name}`}</code>{" "}
                          to replace with active profile first name, or{" "}
                          <code className="font-mono text-indigo-500 text-xs px-1 bg-slate-105 border border-slate-200/50 dark:bg-slate-950 dark:border-slate-800 py-0.5 rounded">{`{FullName}`}</code>{" "}
                          to replace with their full registered name.
                        </p>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 pl-0.5">
                              🔴 Members Template Configuration
                            </label>
                            <textarea
                              placeholder="Happy Sunday {Name}... We didn't see you in church today."
                              rows={3}
                              value={whatsAppConfig.memberTemplate || ""}
                              onChange={(e) =>
                                setWhatsAppConfig({
                                  ...whatsAppConfig,
                                  memberTemplate: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-850 dark:text-slate-100 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 pl-0.5">
                              🔵 Workers Template Configuration
                            </label>
                            <textarea
                              placeholder="Dearest worker {Name}... we missed your valuable service in church today."
                              rows={3}
                              value={whatsAppConfig.workerTemplate || ""}
                              onChange={(e) =>
                                setWhatsAppConfig({
                                  ...whatsAppConfig,
                                  workerTemplate: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-850 dark:text-slate-100 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold tracking-wide flex items-center justify-center gap-1 cursor-pointer shadow shadow-indigo-500/10"
                      >
                        <Settings size={16} /> Save credentials
                      </button>
                    </form>
                  </div>

                  {/* Email configuration form card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-6 sm:p-8 rounded-2xl shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />

                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-display font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">
                          <Mail size={18} className="text-emerald-500" />
                          Leader Email Summaries (SMTP)
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Configure Nodemailer credentials to send weekly Sunday attendance summary reports to church leaders automatically.
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={emailConfig.enabled}
                            onChange={(e) =>
                              setEmailConfig({
                                ...emailConfig,
                                enabled: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                          <span className="ml-2 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                            {emailConfig.enabled ? "Active" : "Disabled"}
                          </span>
                        </label>
                      </div>
                    </div>

                    <form onSubmit={handleSaveEmailConfig} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">
                            SMTP Outgoing Host Server
                          </label>
                          <input
                            type="text"
                            required={emailConfig.enabled}
                            placeholder="smtp.gmail.com"
                            value={emailConfig.smtpHost}
                            onChange={(e) =>
                              setEmailConfig({
                                ...emailConfig,
                                smtpHost: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-800 dark:text-slate-100 text-sm font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">
                            Port
                          </label>
                          <input
                            type="number"
                            required={emailConfig.enabled}
                            placeholder="587"
                            value={emailConfig.smtpPort || ""}
                            onChange={(e) =>
                              setEmailConfig({
                                ...emailConfig,
                                smtpPort: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-800 dark:text-slate-100 text-sm font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pl-0.5 pb-2">
                        <input
                          type="checkbox"
                          id="smtpSecure"
                          checked={emailConfig.smtpSecure}
                          onChange={(e) =>
                            setEmailConfig({
                              ...emailConfig,
                              smtpSecure: e.target.checked,
                            })
                          }
                          className="rounded border-slate-300 dark:border-slate-800 text-emerald-500 focus:ring-emerald-500"
                        />
                        <label htmlFor="smtpSecure" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Use Secure socket layer (SSL/TLS for Port 465)
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">
                            SMTP Auth Authorized Username
                          </label>
                          <input
                            type="email"
                            required={emailConfig.enabled}
                            placeholder="church.alerts@gmail.com"
                            value={emailConfig.smtpAuthUser}
                            onChange={(e) =>
                              setEmailConfig({
                                ...emailConfig,
                                smtpAuthUser: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-800 dark:text-slate-100 text-sm font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">
                            SMTP Auth Access Password / Key
                          </label>
                          <input
                            type="password"
                            required={emailConfig.enabled}
                            placeholder="••••••••••••••••"
                            value={emailConfig.smtpAuthPass}
                            onChange={(e) =>
                              setEmailConfig({
                                ...emailConfig,
                                smtpAuthPass: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-800 dark:text-slate-100 text-sm font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">
                            Sender Address String
                          </label>
                          <input
                            type="text"
                            placeholder="Church Portal <no-reply@church.org>"
                            value={emailConfig.senderEmail}
                            onChange={(e) =>
                              setEmailConfig({
                                ...emailConfig,
                                senderEmail: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-800 dark:text-slate-100 text-sm font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">
                            Leader Destination Emails (comma separated)
                          </label>
                          <input
                            type="text"
                            required={emailConfig.enabled}
                            placeholder="pastor@church.org, secretary@church.org"
                            value={emailConfig.leaderEmails}
                            onChange={(e) =>
                              setEmailConfig({
                                ...emailConfig,
                                leaderEmails: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-800 dark:text-slate-100 text-sm font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="border-t border-slate-100 dark:border-slate-800 pt-5 mt-5 flex flex-wrap items-center justify-between gap-4">
                        <button
                          type="submit"
                          disabled={isSavingEmailConfig}
                          className="py-2.5 px-5 bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold tracking-wide flex items-center gap-1 cursor-pointer shadow disabled:opacity-50"
                        >
                          <Settings size={14} />
                          {isSavingEmailConfig ? "Saving credentials..." : "Save SMTP credentials"}
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSendTestEmail}
                            disabled={isSendingTestEmail}
                            className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Send size={14} className="text-slate-500" />
                            {isSendingTestEmail ? "Transmitting..." : "Send Verification Email"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const latestSun = sundaysList[0] || new Date().toISOString().split("T")[0];
                              handleTriggerEmailReport(latestSun);
                            }}
                            disabled={isTriggeringEmailReport}
                            className="py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 dark:text-indigo-400 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Mail size={14} />
                            {isTriggeringEmailReport ? "Dispatching..." : "Send Latest Weekly Summary Now"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Sidebar Database Exports */}
                  <div className="space-y-6">
                    <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 rounded-2xl p-6 relative">
                      <h4 className="font-display font-bold text-slate-850 dark:text-slate-100 mb-2">
                        Automatic Database Backups
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                        Firestore database automatically guarantees persistent
                        storage that is preserved during node restarts or code
                        updates. You can trigger manual backup export packages
                        as structured JSON at any time.
                      </p>

                      <button
                        onClick={handleExportBackup}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow cursor-pointer transition-all"
                      >
                        <Download size={15} /> Export JSON Backup file
                      </button>
                    </div>

                    {/* Workspace Subscription Management Card */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-sm">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                      
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">🎫</span>
                          <h4 className="font-display font-bold text-slate-850 dark:text-slate-100 text-xs">
                            Workspace Licensing & Plans
                          </h4>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          subInfo?.isExpired
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                        }`}>
                          {subInfo?.isExpired ? "Expired" : "Active"}
                        </span>
                      </div>
                      
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                        Control church portal access. Standard administrators are locked out once the subscription expires. Super Administrators can renew or change licensing plans at any time.
                      </p>

                      <div className="space-y-2 mb-6 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850 text-xs text-slate-600 dark:text-slate-400 font-medium">
                        <div className="flex justify-between items-center py-0.5">
                          <span>Current Active Tier:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded text-[10px] text-indigo-600 dark:text-indigo-400">
                            {subInfo?.planType || "Monthly"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-0.5">
                          <span>Expiry Date:</span>
                          <span className={`font-bold ${subInfo?.isExpired ? "text-rose-600 shadow-sm shadow-rose-500/10" : "text-slate-800 dark:text-slate-200"}`}>
                            {subInfo?.expiryDate ? new Date(subInfo.expiryDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A"}
                          </span>
                        </div>
                        {adminRole === "Super Admin" && (
                          <div className="flex flex-col pt-2 border-t border-slate-150 dark:border-slate-850/50">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Cryptographic License Key:</span>
                            <span className="font-mono text-[10px] bg-white dark:bg-slate-900 p-2 rounded mt-1 text-indigo-600 dark:text-indigo-400 break-all select-all border border-slate-100 dark:border-slate-850">
                              {subInfo?.licenseKey || "CHM-ACTIVE-MONTHLY-882"}
                            </span>
                          </div>
                        )}
                      </div>

                      {adminRole === "Super Admin" && (
                        <div className="space-y-4">
                          <div className="border-t border-slate-100 dark:border-slate-850 pt-4">
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 pl-0.5">
                              1. Select Licensing Plan Tier
                            </label>
                            
                            <div className="space-y-2">
                              {[
                                {
                                  id: "Monthly" as const,
                                  price: "$39",
                                  period: "month",
                                  desc: "30 consecutive days billing coverage.",
                                  tag: "Basic Coverage"
                                },
                                {
                                  id: "Quarterly" as const,
                                  price: "$99",
                                  period: "qr",
                                  desc: "90 consecutive days billing coverage (Save 15%).",
                                  tag: "Popular Tier"
                                },
                                {
                                  id: "Yearly" as const,
                                  price: "$299",
                                  period: "yr",
                                  desc: "365 consecutive days billing coverage (Save 35%).",
                                  tag: "Best Value Plan"
                                }
                              ].map((item) => (
                                <div
                                  key={item.id}
                                  onClick={() => setSubSelectedPlan(item.id)}
                                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                                    subSelectedPlan === item.id
                                      ? "border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/10 shadow-sm"
                                      : "border-slate-150 dark:border-slate-850 bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-950/30 dark:hover:bg-slate-950/50"
                                  }`}
                                >
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <span className="text-xs font-bold text-slate-850 dark:text-slate-100">{item.id}</span>
                                      <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-100/60 dark:bg-indigo-950/60 text-[8px] font-bold uppercase rounded text-indigo-600 dark:text-indigo-400 tracking-wider">
                                        {item.tag}
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">{item.price}</span>
                                      <span className="text-[10px] text-slate-400">/{item.period}</span>
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 pl-0.5 leading-relaxed">
                                    {item.desc}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="pt-2">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 pl-0.5">
                              2. Confirm Authorization Access
                            </label>
                            <button
                              type="button"
                              onClick={handleApplyNewSubscriptionPlan}
                              disabled={subApplying}
                              className="w-full inline-flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer transition-all disabled:opacity-50 hover:shadow-md"
                            >
                              {subApplying ? (
                                <>
                                  <RefreshCw className="animate-spin" size={14} />
                                  <span>Enforcing {subSelectedPlan} Plan...</span>
                                </>
                              ) : (
                                <>
                                  <span>🚀</span>
                                  <span>Activate {subSelectedPlan} Subscription License</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-850 rounded-2xl p-6 font-medium text-xs text-slate-500 dark:text-slate-400">
                      <h5 className="font-semibold text-slate-700 dark:text-slate-350 text-xs mb-2.5 uppercase tracking-wider">
                        Webhook Integrations Info
                      </h5>
                      <p className="mb-2 leading-relaxed">
                        Live message deliverability and read alerts can is fully
                        processed by setting up our secure webhook endpoint:
                      </p>
                      <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-150 dark:border-slate-850 font-mono text-[10px] break-all select-all text-blue-600 py-1.5 mb-2.5">
                        {appUrl}/api/whatsapp/webhook
                      </div>
                      <p className="leading-relaxed">
                        Verify Token:{" "}
                        <span className="font-bold text-slate-700 dark:text-slate-350 font-mono">
                          CHURCH_ATTENDANCE_VERIFY_TOKEN
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 7. ADMINS ROLES & AUDIT LOGS TAB */}
              {adminTab === "roles" && adminRole === "Super Admin" && (
                <div
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6"
                  id="roles-tab-panel"
                >
                  {/* Authorized administrators list */}
                  <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-display font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <Shield size={16} className="text-blue-500" />
                        Authorized Administrators
                      </h4>
                      <button
                        type="button"
                        onClick={() => setShowAddAdminModal(true)}
                        className="py-1 px-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 text-xs font-bold rounded-xl cursor-pointer"
                      >
                        Add Admin
                      </button>
                    </div>

                    <div className="space-y-3">
                      {adminsList.map((adm) => (
                        <div
                          key={adm.id}
                          className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-900"
                        >
                          <div>
                            <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">
                              {adm.email}
                            </span>
                            <span className="block text-[9px] font-mono text-slate-400 break-all select-all">
                              UID: {adm.id}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 text-[10px] font-bold rounded">
                              {adm.role}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteAdmin(adm.id, adm.email)
                              }
                              className="p-1 px-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer text-xs font-bold"
                            >
                              Revoke
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* System Audit logs */}
                  <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <h4 className="font-display font-bold text-slate-850 dark:text-slate-105 mb-4 flex items-center gap-1.5">
                      <Activity size={16} className="text-emerald-500" />
                      Administrative Audit Logs
                    </h4>

                    <div className="overflow-y-auto max-h-[350px] space-y-2 pr-1 font-sans">
                      {auditLogs.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 font-medium py-8">
                          No audit action logs found.
                        </p>
                      ) : (
                        auditLogs.map((log) => (
                          <div
                            key={log.id}
                            className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-150/40 dark:border-slate-850 rounded-xl flex justify-between items-start text-xs leading-relaxed"
                          >
                            <div className="flex-1 pr-4">
                              <span className="font-bold text-slate-800 dark:text-slate-200 mr-2">
                                {log.userEmail}:
                              </span>
                              <span className="text-slate-600 dark:text-slate-400">
                                {log.action}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SUNDAY SCHEDULER TESTING DIALOG RESULT */}
            {showSchedulerResult && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs no-print">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative">
                  <div className="bg-slate-850 text-white py-4 px-6 font-display font-bold flex items-center justify-between">
                    <span>Sunday comparison calculation result</span>
                    <button
                      onClick={() => setShowSchedulerResult(false)}
                      className="text-slate-400 hover:text-white cursor-pointer text-sm"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    {runningScheduler ? (
                      <div className="text-center py-8 space-y-3">
                        <svg
                          className="animate-spin h-10 w-10 text-blue-600 mx-auto"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8H4z"
                          />
                        </svg>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-350">
                          Scanning Sunday files and sending Meta WhatsApp
                          campaigns...
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-slate-800 rounded-2xl flex items-center gap-3">
                          <CheckCircle size={22} className="text-blue-500" />
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                            Check complete! Automated Sunday Comparison scanned
                            successfully.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
                            Follow up campaign dispatch logs
                          </h5>
                          <div className="max-h-48 overflow-y-auto space-y-1.5">
                            {schedulerLogs.length === 0 ? (
                              <p className="text-center text-xs font-bold text-slate-400 uppercase py-6 select-none">
                                All attending records are matched. No absentees
                                detected!
                              </p>
                            ) : (
                              schedulerLogs.map((logItem, index) => (
                                <div
                                  key={index}
                                  className="p-2.5 bg-slate-50 dark:bg-slate-950 border rounded-xl flex items-center justify-between text-xs"
                                >
                                  <div>
                                    <span className="font-bold text-slate-800 dark:text-slate-100">
                                      {logItem.name}
                                    </span>
                                    <span className="block text-[10px] font-mono text-slate-400">
                                      {logItem.phone}
                                    </span>
                                  </div>
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                      logItem.status === "Sent"
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-rose-50 text-rose-700"
                                    }`}
                                  >
                                    {logItem.status}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* DETAILED ATTENDANCE & COMMUNICATION MODAL */}
            {selectedDetailsPerson && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
                <div 
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200"
                >
                  {/* Modal Header */}
                  <div className="p-6 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/10">
                        {selectedDetailsPerson.firstName[0]}
                        {selectedDetailsPerson.lastName[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-display font-bold text-lg text-slate-850 dark:text-slate-50">
                            {selectedDetailsPerson.firstName} {selectedDetailsPerson.lastName}
                          </h3>
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            selectedDetailsPersonType === "worker"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50"
                              : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-200/50"
                          }`}>
                            {selectedDetailsPersonType === "worker" ? "Worker" : "Member"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          📞 {selectedDetailsPerson.whatsAppNumber}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedDetailsPerson(null);
                        setSelectedDetailsPersonType(null);
                      }}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl cursor-pointer transition-all"
                    >
                      ✕ Close
                    </button>
                  </div>

                  {/* Modal Content - Scrollable Grid */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Stats Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200/40 dark:border-slate-850 p-4 rounded-2xl">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Current status
                        </span>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            selectedDetailsPerson.currentStatus === "Present" ? "bg-emerald-500" : "bg-rose-500 animate-pulse"
                          }`} />
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {selectedDetailsPerson.currentStatus}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200/40 dark:border-slate-850 p-4 rounded-2xl">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Last Attended Date
                        </span>
                        <span className="block mt-1 text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">
                          {selectedDetailsPerson.lastAttendanceDate || "Never attended"}
                        </span>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200/40 dark:border-slate-850 p-4 rounded-2xl">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Attendance Rate
                        </span>
                        <span className="block mt-1 text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">
                          {(() => {
                            const attendedCount = attendanceHistory.filter(
                              rec => rec.personId === selectedDetailsPerson.id
                            ).length;
                            const totalSundays = sundaysList.length || 1;
                            const rate = Math.round((attendedCount / totalSundays) * 100);
                            return `${rate}% (${attendedCount}/${totalSundays} Sundays)`;
                          })()}
                        </span>
                      </div>
                    </div>

                    {/* Notes Administration Card */}
                    <div className="bg-slate-50 dark:bg-slate-950/45 border border-slate-200/40 dark:border-slate-850 p-5 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-display font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          📝 Qualitative Attendance & Profile Notes
                        </h4>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          Optional details, medical records, check remarks, or comments
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <textarea
                          id="person-notes-textarea"
                          key={selectedDetailsPerson.id}
                          rows={2}
                          defaultValue={selectedDetailsPerson.notes || ""}
                          placeholder="Type informative notes here..."
                          className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/30 dark:border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const notesVal = (document.getElementById("person-notes-textarea") as HTMLTextAreaElement)?.value || "";
                            try {
                              const endpoint = selectedDetailsPersonType === "worker"
                                ? `/api/workers/${selectedDetailsPerson.id}`
                                : `/api/members/${selectedDetailsPerson.id}`;
                              
                              const res = await fetch(endpoint, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ notes: notesVal }),
                              });
                              if (!res.ok) throw new Error("Could not save notes");
                              
                              addNotification("Person's biography notes updated successfully!", "success");
                              await loadAllAdminData();
                              
                              setSelectedDetailsPerson({
                                ...selectedDetailsPerson,
                                notes: notesVal
                              });
                            } catch (e: any) {
                              addNotification("Failed to update notes: " + e.message, "error");
                            }
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-xs sm:self-end cursor-pointer uppercase tracking-wider transition-colors shrink-0"
                        >
                          Save Notes
                        </button>
                      </div>
                    </div>

                    {/* Split View Content Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      {/* Left: Attendance History Timeline */}
                      <div className="border border-slate-200/40 dark:border-slate-850 rounded-2xl overflow-hidden flex flex-col bg-white dark:bg-slate-900/40">
                        <div className="bg-slate-50 dark:bg-slate-950 p-4 border-b border-slate-100 dark:border-slate-850">
                          <h4 className="font-display font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            ⛪ Sunday-by-Sunday Attendance Log
                          </h4>
                        </div>
                        <div className="p-4 overflow-y-auto max-h-[300px] space-y-3">
                          {sundaysList.length === 0 ? (
                            <p className="text-center text-xs text-slate-400 py-6 italic font-medium">
                              No Sundway service dates configured.
                            </p>
                          ) : (
                            sundaysList.map(date => {
                              const matchRecord = attendanceHistory.find(
                                rec => rec.personId === selectedDetailsPerson.id && rec.date === date
                              );
                              return (
                                <div 
                                  key={date} 
                                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-150/45 dark:border-slate-850"
                                >
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-250 font-mono">
                                      {date}
                                    </span>
                                    <span className="text-[10px] text-slate-400 mt-0.5">
                                      {matchRecord?.timestamp
                                        ? `Checked-in: ${new Date(matchRecord.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                                        : "No check-in recorded"}
                                    </span>
                                  </div>
                                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${
                                    matchRecord
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                                      : "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-455"
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${matchRecord ? "bg-emerald-500" : "bg-rose-500"}`} />
                                    {matchRecord ? "Present" : "Absent"}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Right: Message Timeline */}
                      <div className="border border-slate-200/40 dark:border-slate-850 rounded-2xl overflow-hidden flex flex-col bg-white dark:bg-slate-900/40">
                        <div className="bg-slate-50 dark:bg-slate-950 p-4 border-b border-slate-100 dark:border-slate-850">
                          <h4 className="font-display font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            💬 WhatsApp Message Communication Timeline
                          </h4>
                        </div>
                        <div className="p-4 overflow-y-auto max-h-[300px] space-y-4">
                          {(() => {
                            const personLogs = whatsAppLogs.filter(
                              log => log.personId === selectedDetailsPerson.id
                            );
                            if (personLogs.length === 0) {
                              return (
                                <div className="text-center py-12 text-slate-400 dark:text-slate-500 italic text-xs font-medium space-y-2">
                                  <span>No WhatsApp messages dispatched yet.</span>
                                  <p className="not-italic text-[10px] font-normal text-slate-400">
                                    Absentees are dynamically followed up on Sunday follow-up events or template notifications.
                                  </p>
                                </div>
                              );
                            }
                            return personLogs.map((log) => (
                              <div 
                                key={log.id} 
                                className="p-3 border border-slate-150/50 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-2.5 relative"
                              >
                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold font-mono">
                                  <span>
                                    {new Date(log.sentAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] ${
                                    log.deliveryStatus === "Failed"
                                      ? "bg-rose-50 text-rose-600 dark:bg-rose-950/20"
                                      : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20"
                                  }`}>
                                    {log.deliveryStatus || "Sent"}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium whitespace-pre-wrap leading-relaxed italic bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/30 dark:border-slate-850">
                                  "{log.messageContent}"
                                </p>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-850 flex justify-end">
                    <button
                      onClick={() => {
                        setSelectedDetailsPerson(null);
                        setSelectedDetailsPersonType(null);
                      }}
                      className="py-2.5 px-6 bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-sm font-bold tracking-tight cursor-pointer"
                    >
                      Close Profile
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CREATE PERSON ROSTER MODAL */}
            {showAddPersonModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs no-print">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative">
                  <div className="py-4 px-6 bg-slate-850 text-white font-display font-bold flex items-center justify-between">
                    <span>Create New Attendance Record</span>
                    <button
                      onClick={() => setShowAddPersonModal(false)}
                      className="text-slate-400 hover:text-white cursor-pointer select-none text-sm"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <form onSubmit={handleAddPerson} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                          First Name
                        </label>
                        <input
                          type="text"
                          required
                          value={newPerson.firstName}
                          onChange={(e) =>
                            setNewPerson({
                              ...newPerson,
                              firstName: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-100 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          required
                          value={newPerson.lastName}
                          onChange={(e) =>
                            setNewPerson({
                              ...newPerson,
                              lastName: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-100 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        WhatsApp phone number
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="+2348031234567"
                        value={newPerson.whatsAppNumber}
                        onChange={(e) =>
                          setNewPerson({
                            ...newPerson,
                            whatsAppNumber: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-100 font-mono text-sm"
                      />
                    </div>

                    <div>
                      <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Role Category
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setNewPersonType("member")}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border ${
                            newPersonType === "member"
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "bg-slate-50 dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-850"
                          }`}
                        >
                          Member
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewPersonType("worker")}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border ${
                            newPersonType === "worker"
                              ? "bg-violet-600 border-violet-600 text-white"
                              : "bg-slate-50 dark:bg-slate-950 text-slate-505 border-slate-200 dark:border-slate-850"
                          }`}
                        >
                          Worker
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Gender
                        </span>
                        <select
                          value={newPerson.gender}
                          onChange={(e: any) =>
                            setNewPerson({
                              ...newPerson,
                              gender: e.target.value as "Male" | "Female" | "",
                            })
                          }
                          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-700 dark:text-slate-100 font-bold text-xs focus:outline-none"
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>

                      <div>
                        <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Service Status
                        </span>
                        <select
                          value={newPerson.currentStatus}
                          onChange={(e: any) =>
                            setNewPerson({
                              ...newPerson,
                              currentStatus: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-700 dark:text-slate-100 font-bold text-xs focus:outline-none"
                        >
                          <option value="Absent">Absent</option>
                          <option value="Present">Present</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Optional Biography / Attendance Notes
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Save details, specific roles, or notes here..."
                        value={newPerson.notes}
                        onChange={(e) =>
                          setNewPerson({
                            ...newPerson,
                            notes: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow cursor-pointer uppercase"
                    >
                      Save person record
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* BULK IMPORT ATTENDANCE MODAL */}
            {showImportModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs no-print">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative">
                  <div className="py-4 px-6 bg-emerald-800 text-white font-display font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Upload size={18} />
                      Import Existing Attendance
                    </span>
                    <button
                      onClick={() => setShowImportModal(false)}
                      className="text-emerald-200 hover:text-white cursor-pointer select-none text-sm"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <form onSubmit={handleImportSubmit} className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Option 1: Choose a CSV / Excel Text File
                      </label>
                      <input
                        type="file"
                        accept=".csv,.tsv,.txt"
                        onChange={handleFileChange}
                        className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 dark:file:bg-emerald-950/30 file:text-emerald-700 dark:file:text-emerald-400 hover:file:bg-emerald-100 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Option 2: Paste Rows (CSV or Tab Delimited)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setImportRawText(
                              "First Name,Last Name,WhatsApp Phone,Gender,Role,Date,Status\nJohn,Doe,+2348030001111,Male,member,2026-06-14,Present\nSarah,Smith,+2348030002222,Female,worker,2026-06-14,Present"
                            );
                          }}
                          className="text-[10px] text-blue-500 hover:underline"
                        >
                          Insert Sample Demo
                        </button>
                      </div>
                      <textarea
                        rows={6}
                        placeholder={`Format on each line: First Name, Last Name, WhatsApp, Gender, Role, Date, Status\n\nExample:\nJohn,Doe,+2348011223344,Male,member,2026-06-14,Present`}
                        value={importRawText}
                        onChange={(e) => setImportRawText(e.target.value)}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-2xl text-slate-800 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-150 dark:border-slate-850 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                      <p className="font-bold text-slate-700 dark:text-slate-350 mb-0.5">ℹ️ Data Matching Rules:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>Duplicates are automatically merged based on <strong>WhatsApp Phone Number</strong>.</li>
                        <li>Roles supported: <strong>member</strong> or <strong>worker</strong>.</li>
                        <li>Genders supported: <strong>Male</strong> or <strong>Female</strong>.</li>
                        <li>Format: <strong>FirstName, LastName, Phone, Gender, Role, [Optional Sunday Date], [Optional Status]</strong></li>
                      </ul>
                    </div>

                    {importFileError && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold">
                        ⚠️ {importFileError}
                      </div>
                    )}

                    {importResult && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold">
                        ✅ {importResult}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={importingStatus}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all shadow cursor-pointer uppercase flex items-center justify-center gap-2"
                    >
                      {importingStatus ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          Processing importing...
                        </>
                      ) : (
                        "Run Bulk Import"
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* CREATE SYSTEM ADMINISTRATOR ROLE MODAL */}
            {showAddAdminModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs no-print">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative">
                  <div className="py-4 px-6 bg-slate-850 text-white font-display font-bold flex items-center justify-between">
                    <span>Authorized System logins</span>
                    <button
                      onClick={() => setShowAddAdminModal(false)}
                      className="text-slate-400 hover:text-white cursor-pointer select-none text-sm"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <form onSubmit={handleAddAdmin} className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Administrative Google Email
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="secretary@church.org"
                        value={newAdmin.email}
                        onChange={(e) =>
                          setNewAdmin({ ...newAdmin, email: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-100 text-sm focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Administrative Role Access
                      </label>
                      <select
                        value={newAdmin.role}
                        onChange={(e: any) =>
                          setNewAdmin({ ...newAdmin, role: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-100 font-bold text-xs focus:outline-none"
                      >
                        <option value="Super Admin">
                          Super Admin (full control)
                        </option>
                        <option value="Pastor">
                          Pastor (view summaries only)
                        </option>
                        <option value="Secretary">
                          Secretary (manage registers & campaign dispatch)
                        </option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow cursor-pointer uppercase"
                    >
                      Authorize Administrator
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-6 border-t border-slate-200/50 dark:border-slate-850 text-center text-xs text-slate-400 font-medium no-print">
        <p>
          © 2026 Church Attendance Management System. Secured Cloud Rollout.
        </p>
      </footer>
    </div>
  );
}
