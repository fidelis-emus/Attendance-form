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
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import AttendanceForm from "./components/AttendanceForm";
import QrCodeGenerator from "./components/QrCodeGenerator";
import AnalyticsCharts from "./components/AnalyticsCharts";
import { Member, Worker, AttendanceRecord, WhatsAppLog, AppSettings, Admin, AuditLog } from "./types";

export default function App() {
  // Authentication & Session States
  const [user, setUser] = useState<{ uid: string; email: string; displayName?: string; role?: string } | null>(null);
  const [adminRole, setAdminRole] = useState<"Super Admin" | "Pastor" | "Secretary" | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Core App Mode (Guest form register vs Admin dashboard)
  const [viewMode, setViewMode] = useState<"guest" | "admin">("guest");
  
  // Admin Core Selection Tabs
  const [adminTab, setAdminTab] = useState<"dashboard" | "tickets" | "registers" | "absentees" | "campaigns" | "settings" | "roles">("dashboard");

  // Registers Selection
  const [registerSubTab, setRegisterSubTab] = useState<"members" | "workers" | "history">("members");

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
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [sundaysList, setSundaysList] = useState<string[]>([]);
  const [whatsAppLogs, setWhatsAppLogs] = useState<WhatsAppLog[]>([]);
  const [adminsList, setAdminsList] = useState<Admin[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [whatsAppConfig, setWhatsAppConfig] = useState<AppSettings>({
    churchWhatsAppNumber: "",
    phoneNumberId: "",
    accessToken: "",
    businessAccountId: "",
  });

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [sundayFilter, setSundayFilter] = useState("all");

  // Creation Modals or Quick Forms
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [newPersonType, setNewPersonType] = useState<"member" | "worker">("member");
  const [newPerson, setNewPerson] = useState({ firstName: "", lastName: "", whatsAppNumber: "", currentStatus: "Absent" as "Present" | "Absent" });
  
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ id: "", email: "", role: "Secretary" as "Super Admin" | "Pastor" | "Secretary" });

  // System Scheduler States
  const [runningScheduler, setRunningScheduler] = useState(false);
  const [schedulerLogs, setSchedulerLogs] = useState<any[]>([]);
  const [showSchedulerResult, setShowSchedulerResult] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState<Array<{ id: string; msg: string; type: "success" | "error" | "info" }>>([]);

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

  const addNotification = (msg: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
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
        body: JSON.stringify({ email: loginEmail.trim().toLowerCase(), password: loginPassword.trim() }),
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

      sessionStorage.setItem("church_admin_session", JSON.stringify(loggedUser));
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
      ];

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
      ] = await Promise.all(endpoints.map(ep => fetch(ep).then(res => res.json())));

      // Ensure stable sorting
      const sortedWaLogs = [...whatsappLogsData].sort((a: any, b: any) => (b.sentAt || "").localeCompare(a.sentAt || ""));
      const sortedAuditLogs = [...auditLogsData].sort((a: any, b: any) => (b.timestamp || "").localeCompare(a.timestamp || ""));

      setStats(statsData);
      setMembers(membersData);
      setWorkers(workersData);
      setAttendanceHistory(attendanceData);
      setSundaysList(sundaysData || []);
      setWhatsAppLogs(sortedWaLogs);
      setWhatsAppConfig(whatsappConfigData);
      setAdminsList(adminsListData);
      setAuditLogs(sortedAuditLogs);
    } catch (err: any) {
      addNotification("Error syncing client tables: " + err.message, "error");
    }
  };

  // Add individual Person API call
  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPerson.firstName || !newPerson.lastName || !newPerson.whatsAppNumber) {
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
      setNewPerson({ firstName: "", lastName: "", whatsAppNumber: "", currentStatus: "Absent" });
      await loadAllAdminData();
    } catch (err: any) {
      addNotification(err.message, "error");
    }
  };

  // Delete Individual Person
  const handleDeletePerson = async (id: string, type: "member" | "worker") => {
    if (!window.confirm(`Are you absolutely sure you want to remove this ${type}?`)) return;

    if (adminRole === "Pastor") {
      addNotification("Access Denied: Pastors can only view reports.", "error");
      return;
    }

    const endpoint = type === "worker" ? `/api/workers/${id}` : `/api/members/${id}`;
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

  // Save Meta WhatsApp Settings API parameters
  const handleSaveWhatsAppConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (adminRole !== "Super Admin") {
      addNotification("Permissions Denied. Only Super Admins can configure API settings.", "error");
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
          adminEmail: user?.email,
          adminId: user?.uid,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to save configuration.");
      }

      addNotification("WhatsApp Business configuration saved securely", "success");
      await loadAllAdminData();
    } catch (err: any) {
      addNotification(err.message, "error");
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
        addNotification(`Meta transmission failed. Fallback to WhatsApp Web resend!`, "info");
        const escapedTxt = encodeURIComponent(logItem.messageContent);
        const webHref = `https://wa.me/${logItem.whatsAppNumber.replace(/\+/g, "")}?text=${escapedTxt}`;
        window.open(webHref, "_blank");
      } else {
        addNotification("WhatsApp follow-up retried successfully using Meta API Cloud!", "success");
      }
      await loadAllAdminData();
    } catch (err: any) {
      addNotification(err.message, "error");
    }
  };

  // Explicitly trigger Sunday comparisons scheduler check for test verification
  const handleTriggerSundayComparison = async () => {
    if (!window.confirm("Do you want to instantly run the Sunday attendance comparison and transmit WhatsApp follow-ups now?")) return;

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
      addNotification(`Follow ups run successfully. Sent: ${data.processedCount}, Failed: ${data.failedCount}`, "success");
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
      addNotification("Only Super Admins can configure administrative users.", "error");
      return;
    }
    if (!newAdmin.id || !newAdmin.email) {
      addNotification("Please fill in Admin UID and Email", "error");
      return;
    }

    try {
      const response = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newAdmin.id,
          email: newAdmin.email.trim().toLowerCase(),
          role: newAdmin.role,
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
      setNewAdmin({ id: "", email: "", role: "Secretary" });
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
    if (!window.confirm(`Are you sure you want to revoke administrative control for ${email}?`)) return;

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
  const handleExportCSV = (srcList: any[], headers: string[], filename: string) => {
    const cleanCell = (val: any) => {
      if (val === undefined || val === null) return '""';
      const parsed = String(val).replace(/"/g, '""');
      return `"${parsed}"`;
    };

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" // Add UTF-8 BOM
      + [headers.join(","), ...srcList.map(row => row.map(cleanCell).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addNotification("Report downloaded to Excel CSV spread.", "success");
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
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dStr;
    }
  };

  // Filter Helper
  const getFilteredPersons = (list: any[]) => {
    return list.filter(item => {
      const fullName = `${item.firstName} ${item.lastName}`.toLowerCase();
      const phoneMatched = item.whatsAppNumber.includes(searchQuery);
      const nameMatched = fullName.includes(searchQuery.toLowerCase());
      
      // Filter by Month or Sunday
      let matchesSunday = true;
      if (sundayFilter !== "all" && item.lastAttendanceDate) {
        matchesSunday = item.lastAttendanceDate === sundayFilter;
      }
      
      let matchesMonth = true;
      if (monthFilter !== "all" && item.lastAttendanceDate) {
        const monthNum = item.lastAttendanceDate.substring(5, 7); // YYYY-MM-DD -> MM
        matchesMonth = monthNum === monthFilter;
      }

      return (nameMatched || phoneMatched) && matchesSunday && matchesMonth;
    });
  };

  // Filter Attendance transactions history
  const getFilteredHistory = () => {
    return attendanceHistory.filter(record => {
      const nameMatched = `${record.firstName} ${record.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
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

      return (nameMatched || phoneMatched) && matchesSunday && matchesMonth;
    });
  };

  // Filter message campaigns logs
  const getFilteredCampaignLogs = () => {
    return whatsAppLogs.filter(log => {
      const nameMatched = log.personName.toLowerCase().includes(searchQuery.toLowerCase());
      const phoneMatched = log.whatsAppNumber.includes(searchQuery);
      return nameMatched || phoneMatched;
    });
  };

  return (
    <div id="church-root-container" className="min-h-screen flex flex-col font-sans transition-colors duration-200">
      
      {/* Dynamic Slide notifications */}
      <div className="fixed top-5 right-5 z-50 space-y-3 max-w-sm w-full no-print">
        <AnimatePresence>
          {notifications.map(n => (
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
              <span>{n.type === "success" ? "✅" : n.type === "error" ? "⚠️" : "ℹ️"}</span>
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
          <button
            type="button"
            onClick={() => {
              if (viewMode === "guest") {
                window.history.pushState(null, "", "/admin");
                setViewMode("admin");
              } else {
                window.history.pushState(null, "", "/");
                setViewMode("guest");
              }
            }}
            className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-450 hover:bg-slate-50 dark:hover:bg-slate-950 cursor-pointer transition-all"
          >
            {viewMode === "guest" ? "🔑 Admin Portal" : "📱 Public Register view"}
          </button>

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
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-350">{user.displayName || "Admin User"}</span>
                <span className="block text-[10px] text-indigo-500 dark:text-indigo-400 font-bold">{adminRole}</span>
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
                Are you an administrator? Click the top-right button, select your authorized church email, and access the charts panel.
              </p>
            </div>
          </div>
        )}

        {/* 2. ADMIN DIRECTIVES WITHOUT ACTIVE SESSION */}
        {viewMode === "admin" && !user && (
          <div className="max-w-md w-full mx-auto py-16 sm:py-24" id="admin-login-prompt">
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
                Please authenticate using your registered administrator credentials. Only authorized personnel can manage the church attendance database.
              </p>

              {/* Dynamic Credentials helper block */}
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl p-4 mb-6 text-left shadow-sm">
                <span className="block text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  🔑 System Login Credentials
                </span>
                <div className="space-y-1 text-xs text-slate-700 dark:text-slate-350">
                  <div className="flex justify-between py-0.5 border-b border-amber-200/30 dark:border-amber-900/10">
                    <span className="font-semibold text-slate-500 dark:text-slate-450">Email:</span>
                    <code className="bg-amber-100/50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded font-mono select-all">fidelisemus@gmail.com</code>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="font-semibold text-slate-500 dark:text-slate-450">Password:</span>
                    <code className="bg-amber-100/50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded font-mono select-all">admin123</code>
                  </div>
                </div>
              </div>

              {authError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-450 rounded-xl text-xs font-semibold mb-5 text-left">
                  ⚠️ Verify Error: {authError}
                </div>
              )}

              <form onSubmit={handleAdminSignIn} className="space-y-4 text-left">
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
        {viewMode === "admin" && user && adminRole && (
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
                        <span className="block text-2xl font-bold font-display text-slate-800 dark:text-slate-100">{stats.totalMembers || 0}</span>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Members</span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm flex items-center gap-4">
                      <div className="p-3 bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 rounded-xl">
                        <Shield size={22} />
                      </div>
                      <div>
                        <span className="block text-2xl font-bold font-display text-slate-800 dark:text-slate-100">{stats.totalWorkers || 0}</span>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Workers</span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm flex items-center gap-4">
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                        <CheckCircle size={22} />
                      </div>
                      <div>
                        <span className="block text-2xl font-bold font-display text-slate-800 dark:text-slate-100">
                          {(stats.membersPresent + stats.workersPresent) || 0}
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Present Active Today</span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm flex items-center gap-4">
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-450 rounded-xl">
                        <AlertTriangle size={22} />
                      </div>
                      <div>
                        <span className="block text-2xl font-bold font-display text-slate-800 dark:text-slate-100">
                          {(stats.absentMembers + stats.absentWorkers) || 0}
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Absent Today</span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic triggers for Dev check/automated comparison */}
                  <div className="bg-blue-50/50 dark:bg-slate-900 border border-blue-150 dark:border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 no-print shadow-sm">
                    <div className="flex gap-3">
                      <div className="p-2.5 bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl inline-block flex-shrink-0">
                        <Activity size={20} className="animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Automated Sunday 6:00 PM Scheduler Engine
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Runs comparison every Sunday at 6:00 PM: Identifies who was present previous Sunday but missed today, sets statuses to Absent, sends Meta follow ups automatically.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                      <button
                        type="button"
                        onClick={handleTriggerSundayComparison}
                        disabled={runningScheduler}
                        className="py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold tracking-wide flex items-center justify-center gap-1 cursor-pointer w-full md:w-auto shadow"
                      >
                        <RefreshCw size={14} className={runningScheduler ? "animate-spin" : ""} />
                        <span>Run Comparison Check Now</span>
                      </button>
                    </div>
                  </div>

                  {/* Interactive Recharts Analytics Panels */}
                  <AnalyticsCharts stats={stats} attendanceHistory={attendanceHistory} sundaysList={sundaysList} />
                </div>
              )}

              {/* 2. QR CODE SERVICE TICKETS TAB */}
              {adminTab === "tickets" && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-6 sm:p-8 rounded-2xl shadow-sm" id="qr-tickets-tab-panel">
                  <div className="max-w-xl mb-6">
                    <h2 className="text-xl font-display font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1.5">
                      <QrCode size={20} className="text-blue-500" />
                      Dynamic Sunday Ticket Builder
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Configure a service Sunday date, generate a unique canvas barcode, download or print. Scanning this points members straight to their mobile register!
                    </p>
                  </div>
                  <QrCodeGenerator appUrl={appUrl} sundaysList={sundaysList} onSundayAdded={loadAllAdminData} />
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
                        onClick={() => { setRegisterSubTab("members"); setSearchQuery(""); }}
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
                        onClick={() => { setRegisterSubTab("workers"); setSearchQuery(""); }}
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
                        onClick={() => { setRegisterSubTab("history"); setSearchQuery(""); }}
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
                          setNewPersonType(registerSubTab === "workers" ? "worker" : "member");
                          setShowAddPersonModal(true);
                        }}
                        className="py-2 px-3.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus size={14} /> Add Person
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (registerSubTab === "history") {
                            const filtered = getFilteredHistory();
                            const rows = filtered.map(item => [item.date, `${item.firstName} ${item.lastName}`, item.personType, item.whatsAppNumber, item.timestamp]);
                            handleExportCSV(rows, ["Date (Sunday)", "Full Name", "Category", "Phone Number", "Registered At"], `church_attendance_history_${Date.now()}.csv`);
                          } else {
                            const list = registerSubTab === "workers" ? workers : members;
                            const filtered = getFilteredPersons(list);
                            const rows = filtered.map(item => [`${item.firstName} ${item.lastName}`, item.whatsAppNumber, item.currentStatus, item.lastAttendanceDate, item.messageDeliveryStatus || "None"]);
                            handleExportCSV(rows, ["Full Name", "Phone", "Status", "Last Attendance Sunday", "Latest WhatsApp status"], `church_${registerSubTab}_database_${Date.now()}.csv`);
                          }
                        }}
                        className="py-2 px-3.5 bg-slate-800 dark:bg-slate-820 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                      >
                        <FileSpreadsheet size={14} /> Export Excel
                      </button>

                      <button
                        type="button"
                        onClick={triggerBrowserPrint}
                        className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-750 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                      >
                        <Printer size={14} /> Print
                      </button>
                    </div>
                  </div>

                  {/* Main Search & Filters Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 rounded-2xl p-4 flex flex-col md:flex-row gap-3 shadow-sm no-print">
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 animate-pulse" />
                      <input
                        type="text"
                        placeholder="Search roster by spelling first/last name or typing phone number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:w-80">
                      <div>
                        <select
                          value={monthFilter}
                          onChange={(e) => setMonthFilter(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-600 dark:text-slate-400 font-bold focus:outline-none"
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
                          value={sundayFilter}
                          onChange={(e) => setSundayFilter(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-600 dark:text-slate-400 font-bold focus:outline-none"
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
                  </div>

                  {/* Standard Registers Tables */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    {/* Header text on Print */}
                    <div className="hidden print:block text-center p-6 border-b">
                      <h2 className="text-xl font-bold font-display text-black">Church Attendance Register Report</h2>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Roster Type: <span className="font-bold">{registerSubTab.toUpperCase()}</span> | Exported: {new Date().toLocaleString()}
                      </p>
                    </div>

                    {registerSubTab === "history" ? (
                      <div className="overflow-x-auto min-h-[350px]">
                        <table className="w-full text-left border-collapse text-sm text-slate-700 dark:text-slate-350">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200/50 dark:border-slate-850 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                              <th className="py-3 px-4">Date (Sunday)</th>
                              <th className="py-3 px-4">Attendee Name</th>
                              <th className="py-3 px-4">Category</th>
                              <th className="py-3 px-4">WhatsApp Phone</th>
                              <th className="py-3 px-4">Registered At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getFilteredHistory().length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-xs font-semibold text-slate-400 uppercase tracking-widest leading-relaxed">
                                  No transaction records found matching filters.
                                </td>
                              </tr>
                            ) : (
                              getFilteredHistory().map((record) => (
                                <tr key={record.id} className="border-b last:border-0 border-slate-200/30 dark:border-slate-850 hover:bg-slate-50/50">
                                  <td className="py-3 px-4 font-mono font-bold text-xs text-blue-600 dark:text-blue-400">{record.date}</td>
                                  <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-100">{record.firstName} {record.lastName}</td>
                                  <td className="py-3 px-4">
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                      record.personType === "worker"
                                        ? "bg-violet-50 text-violet-700 dark:bg-violet-950/20 dark:text-violet-400"
                                        : "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                                    }`}>
                                      {record.personType}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 font-mono text-xs text-slate-505">{record.whatsAppNumber}</td>
                                  <td className="py-3 px-4 text-xs font-mono">{new Date(record.timestamp).toLocaleTimeString()}</td>
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
                              <th className="py-3 px-4">Latest Attendance Sunday</th>
                              <th className="py-3 px-4">Attending state</th>
                              <th className="py-3 px-4">Check-in Time</th>
                              <th className="py-3 px-4">Latest Campaign status</th>
                              <th className="py-3 px-4 no-print">Database Management</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getFilteredPersons(registerSubTab === "workers" ? workers : members).length === 0 ? (
                              <tr>
                                <td colSpan={7} className="py-8 text-center text-xs font-semibold text-slate-400 uppercase tracking-widest leading-relaxed">
                                  Roster is currently empty. Define records using the Add Person wizard.
                                </td>
                              </tr>
                            ) : (
                              getFilteredPersons(registerSubTab === "workers" ? workers : members).map((person) => (
                                <tr key={person.id} className="border-b last:border-0 border-slate-200/30 dark:border-slate-850 hover:bg-slate-50/50">
                                  <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-100">
                                    {person.firstName} {person.lastName}
                                  </td>
                                  <td className="py-3 px-4 font-mono text-xs">{person.whatsAppNumber}</td>
                                  <td className="py-3 px-4">
                                    <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                                      {person.lastAttendanceDate || "Never attended"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                      person.currentStatus === "Present"
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                                        : "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                                    }`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        person.currentStatus === "Present" ? "bg-emerald-500" : "bg-rose-500 animate-pulse"
                                      }`} />
                                      {person.currentStatus}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
                                    {person.currentStatus === "Present" && person.attendedAtTime ? (
                                      new Date(person.attendedAtTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-700">-</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    {person.messageSent ? (
                                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                        person.messageDeliveryStatus === "Read"
                                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/10 dark:text-emerald-400"
                                          : person.messageDeliveryStatus === "Delivered"
                                          ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/10 dark:text-cyan-400"
                                          : person.messageDeliveryStatus === "Failed"
                                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/10 dark:text-rose-400"
                                          : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/10 dark:text-indigo-400"
                                      }`}>
                                        Campaign: {person.messageDeliveryStatus || "Sent"}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold text-slate-400">No campaigns sent</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 no-print">
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePerson(person.id, registerSubTab === "workers" ? "worker" : "member")}
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
                      Roster logs displaying anyone currently tagged as <span className="text-rose-500 font-bold font-mono">Absent</span>. Failed automated messages are flagged for manual retries or WhatsApp Web direct redirections.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Absent Members Section */}
                    <div className="bg-white dark:bg-slate-900 border-2 border-rose-300 dark:border-rose-950/50 rounded-2xl overflow-hidden shadow-md">
                      <div className="bg-rose-500 text-white py-3.5 px-5 font-display font-bold tracking-tight text-sm sm:text-base flex items-center justify-between shadow-sm">
                        <span>📢 Absent Members ({getFilteredPersons(members).filter(m => m.currentStatus === "Absent").length})</span>
                        <span className="text-xs font-mono uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">Red Alert</span>
                      </div>

                      <div className="overflow-x-auto min-h-[300px]">
                        <table className="w-full text-left border-collapse text-sm text-slate-700 dark:text-slate-350">
                          <thead>
                            <tr className="bg-rose-50 dark:bg-slate-950/80 border-b border-rose-100 dark:border-rose-950 font-bold text-rose-700 dark:text-rose-450 uppercase tracking-wider text-[10px]">
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold">Roster Name</th>
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold">WhatsApp Phone</th>
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold">Last Attended Sunday</th>
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold">Campaign Delivery</th>
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold no-print">Trigger Retry</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getFilteredPersons(members).filter(m => m.currentStatus === "Absent").length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-xs font-bold text-slate-400 tracking-widest uppercase italic">
                                  All members are fully registered! Excellent streak.
                                </td>
                              </tr>
                            ) : (
                              getFilteredPersons(members).filter(m => m.currentStatus === "Absent").map((person) => (
                                <tr key={person.id} className="border-b last:border-0 border-rose-100/50 dark:border-rose-950/20 hover:bg-rose-50/20">
                                  <td className="py-3 px-4 font-bold text-rose-700 dark:text-rose-455">
                                    {person.firstName} {person.lastName}
                                  </td>
                                  <td className="py-3 px-4 font-mono text-xs">{person.whatsAppNumber}</td>
                                  <td className="py-3 px-4 font-mono text-xs">{person.lastAttendanceDate || "Never"}</td>
                                  <td className="py-3 px-4 text-xs font-bold">
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] ${
                                      person.messageSent
                                        ? person.messageDeliveryStatus === "Failed"
                                          ? "bg-rose-100 text-rose-700"
                                          : "bg-indigo-100 text-indigo-700"
                                        : "bg-slate-100 text-slate-500"
                                    }`}>
                                      {person.messageSent ? person.messageDeliveryStatus || "Sent" : "Pending"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 no-print">
                                    <button
                                      type="button"
                                      onClick={() => handleWhatsAppResend({
                                        personId: person.id,
                                        personType: "member",
                                        whatsAppNumber: person.whatsAppNumber,
                                        messageContent: "Happy Sunday and hope all is well. We didn't see you in church today. Hope to see you next Sunday, and please feel free to reach out to the church pastor if you need any assistance. God bless you."
                                      })}
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
                        <span>📢 Absent Workers ({getFilteredPersons(workers).filter(w => w.currentStatus === "Absent").length})</span>
                        <span className="text-xs font-mono uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">Red Alert</span>
                      </div>

                      <div className="overflow-x-auto min-h-[300px]">
                        <table className="w-full text-left border-collapse text-sm text-slate-700 dark:text-slate-350">
                          <thead>
                            <tr className="bg-rose-50 dark:bg-slate-950/80 border-b border-rose-100 dark:border-rose-950 font-bold text-rose-700 dark:text-rose-450 uppercase tracking-wider text-[10px]">
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold">Roster Name</th>
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold">WhatsApp Phone</th>
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold">Last Attended Sunday</th>
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold">Campaign Delivery</th>
                              <th className="py-2.5 px-4 text-slate-500 uppercase tracking-wider text-[9px] font-bold no-print">Trigger Retry</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getFilteredPersons(workers).filter(w => w.currentStatus === "Absent").length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-xs font-bold text-slate-400 tracking-widest uppercase italic">
                                  All workers are present in today's rosters! Great attendance.
                                </td>
                              </tr>
                            ) : (
                              getFilteredPersons(workers).filter(w => w.currentStatus === "Absent").map((person) => (
                                <tr key={person.id} className="border-b last:border-0 border-rose-100/50 dark:border-rose-950/20 hover:bg-rose-50/20">
                                  <td className="py-3 px-4 font-bold text-rose-700 dark:text-rose-455">
                                    {person.firstName} {person.lastName}
                                  </td>
                                  <td className="py-3 px-4 font-mono text-xs">{person.whatsAppNumber}</td>
                                  <td className="py-3 px-4 font-mono text-xs">{person.lastAttendanceDate || "Never"}</td>
                                  <td className="py-3 px-4 text-xs font-bold">
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] ${
                                      person.messageSent
                                        ? person.messageDeliveryStatus === "Failed"
                                          ? "bg-rose-100 text-rose-700"
                                          : "bg-indigo-100 text-indigo-700"
                                        : "bg-slate-100 text-slate-500"
                                    }`}>
                                      {person.messageSent ? person.messageDeliveryStatus || "Sent" : "Pending"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 no-print">
                                    <button
                                      type="button"
                                      onClick={() => handleWhatsAppResend({
                                        personId: person.id,
                                        personType: "worker",
                                        whatsAppNumber: person.whatsAppNumber,
                                        messageContent: "Happy Sunday and hope all is well. We didn't see you in church today. Hope to see you next Sunday, and please feel free to reach out to the church pastor if you need any assistance. God bless you."
                                      })}
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
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center shadow-sm no-print">
                    <div className="relative flex-1 w-full">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search campaign logs by spelling attendee name or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs sm:text-sm text-slate-100"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const rows = whatsAppLogs.map(log => [log.personName, log.personType, log.whatsAppNumber, log.messageContent, log.sentAt, log.deliveryStatus]);
                        handleExportCSV(rows, ["Person Name", "Category", "Roster Phone", "Message Body", "Dispatched At", "Delivery status"], `whatsapp_dispatched_logs_${Date.now()}.csv`);
                      }}
                      className="py-2 px-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <FileSpreadsheet size={14} /> Export Logs CSV
                    </button>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto min-h-[350px]">
                      <table className="w-full text-left border-collapse text-sm text-slate-700 dark:text-slate-350">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200/50 dark:border-slate-850 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                            <th className="py-3 px-4">Attendee Name</th>
                            <th className="py-3 px-4">WhatsApp Phone</th>
                            <th className="py-3 px-4">Dispatched Message</th>
                            <th className="py-3 px-4">Sent Timestamp</th>
                            <th className="py-3 px-4">Delivery Status (Live webhook)</th>
                            <th className="py-3 px-4 no-print">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getFilteredCampaignLogs().length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-xs font-semibold text-slate-400 tracking-widest uppercase italic">
                                No dispatched message logs registered yet.
                              </td>
                            </tr>
                          ) : (
                            getFilteredCampaignLogs().map((log) => (
                              <tr key={log.id} className="border-b last:border-0 border-slate-200/30 dark:border-slate-850 hover:bg-slate-50/50">
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-850 dark:text-slate-100">
                                    {log.personName}
                                  </div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    {log.personType}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-mono text-xs">{log.whatsAppNumber}</td>
                                <td className="py-3 px-4 max-w-xs sm:max-w-md truncate text-xs" title={log.messageContent}>
                                  {log.messageContent}
                                </td>
                                <td className="py-3 px-4 font-mono text-xs">{new Date(log.sentAt).toLocaleString()}</td>
                                <td className="py-3 px-4">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold leading-none ${
                                    log.deliveryStatus === "Read"
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                                      : log.deliveryStatus === "Delivered"
                                      ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/20 dark:text-cyan-400"
                                      : log.deliveryStatus === "Failed"
                                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 animate-pulse"
                                      : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400"
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      log.deliveryStatus === "Read" 
                                        ? "bg-emerald-500" 
                                        : log.deliveryStatus === "Delivered" 
                                        ? "bg-cyan-400" 
                                        : log.deliveryStatus === "Failed" 
                                        ? "bg-rose-500" 
                                        : "bg-indigo-505"
                                    }`} />
                                    {log.deliveryStatus}
                                  </span>
                                </td>
                                <td className="py-3 px-4 no-print">
                                  <button
                                    type="button"
                                    onClick={() => handleWhatsAppResend(log)}
                                    className="p-1 px-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 cursor-pointer"
                                  >
                                    <Send size={11} /> Resend
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
              )}

              {/* 6. WHATSAPP META BUSINESS PARAMS TAB */}
              {adminTab === "settings" && adminRole === "Super Admin" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="settings-tab-panel">
                  
                  {/* Meta edit settings form */}
                  <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-6 sm:p-8 rounded-2xl shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
                    
                    <div className="mb-6">
                      <h3 className="text-lg font-display font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">
                        <Settings size={18} className="text-indigo-500" />
                        Meta WhatsApp Cloud API settings
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        System configuration credentials used by the server's background scheduler to run automatic text communications coming from the official organization account.
                      </p>
                    </div>

                    <form onSubmit={handleSaveWhatsAppConfig} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest mb-1.5">
                          Official Church WhatsApp Phone Number
                        </label>
                        <input
                          type="text"
                          placeholder="+234 803 123 4567"
                          value={whatsAppConfig.churchWhatsAppNumber}
                          onChange={(e) => setWhatsAppConfig({ ...whatsAppConfig, churchWhatsAppNumber: e.target.value })}
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
                            onChange={(e) => setWhatsAppConfig({ ...whatsAppConfig, phoneNumberId: e.target.value })}
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
                            onChange={(e) => setWhatsAppConfig({ ...whatsAppConfig, businessAccountId: e.target.value })}
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
                          onChange={(e) => setWhatsAppConfig({ ...whatsAppConfig, accessToken: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-800 dark:text-slate-100 font-mono text-xs font-medium leading-relaxed"
                        />
                      </div>

                      <button
                        type="submit"
                        className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold tracking-wide flex items-center justify-center gap-1 cursor-pointer shadow shadow-indigo-500/10"
                      >
                        <Settings size={16} /> Save credentials
                      </button>
                    </form>
                  </div>

                  {/* Sidebar Database Exports */}
                  <div className="space-y-6">
                    <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 rounded-2xl p-6 relative">
                      <h4 className="font-display font-bold text-slate-850 dark:text-slate-100 mb-2">
                        Automatic Database Backups
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                        Firestore database automatically guarantees persistent storage that is preserved during node restarts or code updates. You can trigger manual backup export packages as structured JSON at any time.
                      </p>
                      
                      <button
                        onClick={handleExportBackup}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow cursor-pointer transition-all"
                      >
                        <Download size={15} /> Export JSON Backup file
                      </button>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-850 rounded-2xl p-6 font-medium text-xs text-slate-500 dark:text-slate-400">
                      <h5 className="font-semibold text-slate-700 dark:text-slate-350 text-xs mb-2.5 uppercase tracking-wider">
                        Webhook Integrations Info
                      </h5>
                      <p className="mb-2 leading-relaxed">
                        Live message deliverability and read alerts can is fully processed by setting up our secure webhook endpoint:
                      </p>
                      <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-150 dark:border-slate-850 font-mono text-[10px] break-all select-all text-blue-600 py-1.5 mb-2.5">
                        {appUrl}/api/whatsapp/webhook
                      </div>
                      <p className="leading-relaxed">
                        Verify Token: <span className="font-bold text-slate-700 dark:text-slate-350 font-mono">CHURCH_ATTENDANCE_VERIFY_TOKEN</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 7. ADMINS ROLES & AUDIT LOGS TAB */}
              {adminTab === "roles" && adminRole === "Super Admin" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="roles-tab-panel">
                  
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
                        <div key={adm.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-900">
                          <div>
                            <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{adm.email}</span>
                            <span className="block text-[9px] font-mono text-slate-400 break-all select-all">UID: {adm.id}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 text-[10px] font-bold rounded">
                              {adm.role}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteAdmin(adm.id, adm.email)}
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
                          <div key={log.id} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-150/40 dark:border-slate-850 rounded-xl flex justify-between items-start text-xs leading-relaxed">
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
                    <button onClick={() => setShowSchedulerResult(false)} className="text-slate-400 hover:text-white cursor-pointer text-sm">✕ Close</button>
                  </div>
                  <div className="p-6 space-y-4">
                    {runningScheduler ? (
                      <div className="text-center py-8 space-y-3">
                        <svg className="animate-spin h-10 w-10 text-blue-600 mx-auto" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-350">Scanning Sunday files and sending Meta WhatsApp campaigns...</p>
                      </div>
                    ) : (
                      <>
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-slate-800 rounded-2xl flex items-center gap-3">
                          <CheckCircle size={22} className="text-blue-500" />
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                            Check complete! Automated Sunday Comparison scanned successfully.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">Follow up campaign dispatch logs</h5>
                          <div className="max-h-48 overflow-y-auto space-y-1.5">
                            {schedulerLogs.length === 0 ? (
                              <p className="text-center text-xs font-bold text-slate-400 uppercase py-6 select-none">
                                All attending records are matched. No absentees detected!
                              </p>
                            ) : (
                              schedulerLogs.map((logItem, index) => (
                                <div key={index} className="p-2.5 bg-slate-50 dark:bg-slate-950 border rounded-xl flex items-center justify-between text-xs">
                                  <div>
                                    <span className="font-bold text-slate-800 dark:text-slate-100">{logItem.name}</span>
                                    <span className="block text-[10px] font-mono text-slate-400">{logItem.phone}</span>
                                  </div>
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                    logItem.status === "Sent" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                                  }`}>
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

            {/* CREATE PERSON ROSTER MODAL */}
            {showAddPersonModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs no-print">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative">
                  <div className="py-4 px-6 bg-slate-850 text-white font-display font-bold flex items-center justify-between">
                    <span>Create New Attendance Record</span>
                    <button onClick={() => setShowAddPersonModal(false)} className="text-slate-400 hover:text-white cursor-pointer select-none text-sm">✕ Close</button>
                  </div>
                  <form onSubmit={handleAddPerson} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">First Name</label>
                        <input
                          type="text"
                          required
                          value={newPerson.firstName}
                          onChange={(e) => setNewPerson({ ...newPerson, firstName: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-100 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Last Name</label>
                        <input
                          type="text"
                          required
                          value={newPerson.lastName}
                          onChange={(e) => setNewPerson({ ...newPerson, lastName: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-100 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">WhatsApp phone number</label>
                      <input
                        type="text"
                        required
                        placeholder="+2348031234567"
                        value={newPerson.whatsAppNumber}
                        onChange={(e) => setNewPerson({ ...newPerson, whatsAppNumber: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-100 font-mono text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Role Category</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setNewPersonType("member")}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold border ${
                              newPersonType === "member" ? "bg-blue-600 border-blue-600 text-white" : "bg-slate-50 dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-850"
                            }`}
                          >
                            Member
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewPersonType("worker")}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold border ${
                              newPersonType === "worker" ? "bg-violet-600 border-violet-600 text-white" : "bg-slate-50 dark:bg-slate-950 text-slate-505 border-slate-200 dark:border-slate-850"
                            }`}
                          >
                            Worker
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Service Status</span>
                        <select
                          value={newPerson.currentStatus}
                          onChange={(e: any) => setNewPerson({ ...newPerson, currentStatus: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-100 font-bold text-xs focus:outline-none"
                        >
                          <option value="Absent">Absent</option>
                          <option value="Present">Present</option>
                        </select>
                      </div>
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

            {/* CREATE SYSTEM ADMINISTRATOR ROLE MODAL */}
            {showAddAdminModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs no-print">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative">
                  <div className="py-4 px-6 bg-slate-850 text-white font-display font-bold flex items-center justify-between">
                    <span>Authorized System logins</span>
                    <button onClick={() => setShowAddAdminModal(false)} className="text-slate-400 hover:text-white cursor-pointer select-none text-sm">✕ Close</button>
                  </div>
                  <form onSubmit={handleAddAdmin} className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Administrative Google Email</label>
                      <input
                        type="email"
                        required
                        placeholder="secretary@church.org"
                        value={newAdmin.email}
                        onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-100 text-sm focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Google Firebase UID</label>
                      <input
                        type="text"
                        required
                        placeholder="U92MNSa92hN8ns..."
                        value={newAdmin.id}
                        onChange={(e) => setNewAdmin({ ...newAdmin, id: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-100 font-mono text-xs focus:outline-none"
                      />
                      <span className="block text-[10px] text-slate-450 mt-1 italic leading-tight">
                        Admins must provide their Firebase Authentication unique ID (visible after trying to log in).
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Administrative Role Access</label>
                      <select
                        value={newAdmin.role}
                        onChange={(e: any) => setNewAdmin({ ...newAdmin, role: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-100 font-bold text-xs focus:outline-none"
                      >
                        <option value="Super Admin">Super Admin (full control)</option>
                        <option value="Pastor">Pastor (view summaries only)</option>
                        <option value="Secretary">Secretary (manage registers & campaign dispatch)</option>
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
        <p>© 2026 Church Attendance Management System. Secured Cloud Rollout.</p>
      </footer>

    </div>
  );
}
