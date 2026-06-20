import React, { useState, useEffect } from "react";
import { 
  Check, 
  Heart, 
  Shield, 
  Sparkles, 
  User, 
  Users, 
  RefreshCw, 
  BookOpen, 
  Calendar, 
  Star, 
  CheckCircle,
  Phone,
  ArrowRight,
  Sparkle
} from "lucide-react";
import { motion } from "motion/react";

interface AttendanceFormProps {
  defaultDate?: string;
}

export default function AttendanceForm({ defaultDate }: AttendanceFormProps) {
  // Database fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [whatsAppNumber, setWhatsAppNumber] = useState("");
  const [role, setRole] = useState<"member" | "worker" | "children">("member");
  const [gender, setGender] = useState<"Male" | "Female" | "">("");
  const [selectedEvent, setSelectedEvent] = useState<"Sunday Experience" | "Word Cafe" | "Special Program" | "">("");

  // Returning member smart state
  const [recognizedProfile, setRecognizedProfile] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    gender: string;
    whatsAppNumber?: string;
  } | null>(null);

  const [checkedEvents, setCheckedEvents] = useState<{
    "Sunday Experience": boolean;
    "Word Cafe": boolean;
    "Special Program": boolean;
  }>({
    "Sunday Experience": false,
    "Word Cafe": false,
    "Special Program": false
  });

  // App orchestration states
  const [serviceDate, setServiceDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoChecking, setAutoChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resolvedStatus, setResolvedStatus] = useState<string>("");
  const [resolvedMsg, setResolvedMsg] = useState("");

  // Secure QR Attendance States
  const [token, setToken] = useState<string | null>(null);
  const [tokenValid, setTokenValid] = useState<"checking" | "valid" | "invalid">("checking");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [successSubmittedToken, setSuccessSubmittedToken] = useState<boolean>(false);
  const [duplicateCheckedIn, setDuplicateCheckedIn] = useState<boolean>(false);

  useEffect(() => {
    let resolvedDate = "";
    if (defaultDate) {
      resolvedDate = defaultDate;
    } else {
      const params = new URLSearchParams(window.location.search);
      const dateParam = params.get("date");
      if (dateParam) {
        resolvedDate = dateParam;
      } else {
        // Use actual current date in YYYY-MM-DD format
        const today = new Date();
        const year = today.getFullYear();
        const monthStr = String(today.getMonth() + 1).padStart(2, "0");
        const dateStr = String(today.getDate()).padStart(2, "0");
        resolvedDate = `${year}-${monthStr}-${dateStr}`;
      }
    }

    setServiceDate(resolvedDate);

    // Parse security token from query parameters
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    setToken(urlToken);

    if (!urlToken) {
      setTokenValid("invalid");
      setTokenError("For security reasons, please scan the official Church QR Code to take attendance.");
      return;
    }

    // Check if we already submitted in this session
    const isSubmitted = localStorage.getItem(`attendance_success_${urlToken}`);
    if (isSubmitted === "true") {
      setSuccessSubmittedToken(true);
      setTokenValid("valid");
      return;
    }

    // Verify token status on background server
    const checkToken = async () => {
      try {
        const response = await fetch(`/api/qr-tokens/validate?token=${urlToken}`);
        const data = await response.json();
        
        if (response.ok && data.valid) {
          setTokenValid("valid");
          
          // Smart Recognition of Returning Attendees via saved profile ONLY if scan token is active
          const savedId = localStorage.getItem("attendance_profile_id");
          if (savedId && resolvedDate) {
            triggerAutoCheckin(savedId, resolvedDate);
          }
        } else {
          setTokenValid("invalid");
          setTokenError(data.error || "For security reasons, please scan the official Church QR Code to take attendance.");
        }
      } catch (err) {
        setTokenValid("invalid");
        setTokenError("For security reasons, please scan the official Church QR Code to take attendance.");
      }
    };

    checkToken();
  }, [defaultDate, window.location.search]);

  const triggerAutoCheckin = async (personId: string, date: string) => {
    setAutoChecking(true);
    setError(null);
    try {
      const response = await fetch("/api/attendance/auto-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId,
          submissionDate: date
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.profile) {
          setRecognizedProfile(data.profile);
          setCheckedEvents(data.checkedEvents || {
            "Sunday Experience": false,
            "Word Cafe": false,
            "Special Program": false
          });
        }
      } else {
        // Stored profile might be obsolete or deleted online; wipe to let them register again
        localStorage.removeItem("attendance_profile_id");
        localStorage.removeItem("attendance_profile_type");
        localStorage.removeItem("attendance_first_name");
        setRecognizedProfile(null);
      }
    } catch (e) {
      console.error("Smart checkin verification error:", e);
    } finally {
      setAutoChecking(false);
    }
  };

  // Submit first-time form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError("First Name is required.");
      return;
    }
    if (!lastName.trim()) {
      setError("Last Name is required.");
      return;
    }
    if (!whatsAppNumber.trim()) {
      setError("WhatsApp Number with country code is required.");
      return;
    }
    if (!gender) {
      setError("Please select a gender (Male or Female) to continue.");
      return;
    }
    if (!selectedEvent) {
      setError("Please select an Attendance Category (Sunday Experience, Word Cafe, or Special Program) below.");
      return;
    }

    // Basic WhatsApp validation
    const phoneDigits = whatsAppNumber.replace(/\D/g, "");
    if (phoneDigits.length < 8) {
      setError("Please enter a valid WhatsApp number including country code (e.g. +2348031234567 or +14155552671).");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/attendance/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          whatsAppNumber: whatsAppNumber,
          attendeeType: role,
          submissionDate: serviceDate,
          gender: gender,
          eventType: selectedEvent,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to log attendance.");
      }

      // Store credentials locally to avoid re-pasting next time!
      if (data.personId) {
        localStorage.setItem("attendance_profile_id", data.personId);
        localStorage.setItem("attendance_profile_type", data.personType || role);
        localStorage.setItem("attendance_first_name", data.firstName || firstName.trim());

        // Update recognizedProfile state immediately to lock in smart status
        setRecognizedProfile({
          id: data.personId,
          firstName: data.firstName || firstName.trim(),
          lastName: data.lastName || lastName.trim(),
          role: data.personType || role,
          gender: gender,
        });

        // Toggle local checkedEvent to present as checked
        setCheckedEvents(prev => ({
          ...prev,
          [selectedEvent]: true
        }));
      }

      if (token) {
        localStorage.setItem(`attendance_success_${token}`, "true");
      }
      setSuccessSubmittedToken(true);
    } catch (err: any) {
      const errMsg = err?.message || "";
      if (errMsg.includes("already taken") || errMsg.includes("already_checked_in")) {
        setDuplicateCheckedIn(true);
      } else {
        setError(errMsg || "Something went wrong while logging attendance. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Submit returning member check-in on clicking quick category button
  const handleReturningCheckin = async (eventTypeArg: "Sunday Experience" | "Word Cafe" | "Special Program") => {
    if (!recognizedProfile) return;

    // Direct local warning for checked events to skip waiting for the server response
    if (checkedEvents[eventTypeArg]) {
      setDuplicateCheckedIn(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/attendance/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token,
          personId: recognizedProfile.id,
          eventType: eventTypeArg,
          submissionDate: serviceDate
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to record attendance.");
      }

      // Successful check-in!
      setCheckedEvents(prev => ({ ...prev, [eventTypeArg]: true }));
      if (token) {
        localStorage.setItem(`attendance_success_${token}`, "true");
      }
      setSuccessSubmittedToken(true);
    } catch (err: any) {
      const errMsg = err?.message || "";
      if (errMsg.includes("already taken") || errMsg.includes("already_checked_in")) {
        setDuplicateCheckedIn(true);
      } else {
        setError(errMsg || "Something went wrong recording your attendance. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Re-enable form fields for standard browser reset
  const handleRegisterAnother = () => {
    localStorage.removeItem("attendance_profile_id");
    localStorage.removeItem("attendance_profile_type");
    localStorage.removeItem("attendance_first_name");
    setRecognizedProfile(null);
    setCheckedEvents({
      "Sunday Experience": false,
      "Word Cafe": false,
      "Special Program": false
    });
    setSuccess(false);
    setFirstName("");
    setLastName("");
    setWhatsAppNumber("");
    setGender("");
    setSelectedEvent("");
    setResolvedStatus("");
    setResolvedMsg("");
    setError(null);
  };

  // Switch from success view back to checklist view so returning members can log multiple services
  const handleBackToChecklist = () => {
    setSuccess(false);
    setError(null);
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const parts = dateStr.split("-");
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // RENDER: Token Session Verification in Progress
  if (tokenValid === "checking") {
    return (
      <div className="w-full max-w-md mx-auto p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col items-center justify-center animate-pulse" id="verify-session-panel">
        <RefreshCw className="animate-spin text-blue-600 dark:text-blue-400 mb-4" size={36} />
        <h3 className="text-xl font-display font-bold text-slate-800 dark:text-slate-100">Verifying Session</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Checking secure church roster entry guidelines...</p>
      </div>
    );
  }

  // RENDER: Security Violation Lock Screen (Expired/Invalid or Missing Token parameter)
  if (tokenValid === "invalid") {
    return (
      <div className="w-full max-w-md mx-auto p-10 bg-white dark:bg-slate-900 rounded-3xl border border-rose-500/20 shadow-xl text-center relative overflow-hidden" id="qr-invalid-panel">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-rose-400 to-red-500" />
        <div className="mx-auto w-16 h-16 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-455 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <Shield size={32} strokeWidth={2} className="animate-pulse" />
        </div>
        <h2 className="text-xl font-display font-bold text-slate-800 dark:text-slate-100 mb-4 tracking-tight">
          Secure Attendance Required
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-350 font-sans tracking-wide leading-relaxed font-semibold">
          {tokenError || "For security reasons, please scan the official Church QR Code to take attendance."}
        </p>
      </div>
    );
  }

  // RENDER: Absolute Success page with ONLY successful message, visible indefinitely, with NO back/recheck buttons
  if (successSubmittedToken) {
    return (
      <div className="w-full max-w-md mx-auto p-10 bg-white dark:bg-slate-900 rounded-3xl border border-emerald-500/20 shadow-xl text-center relative overflow-hidden animate-fade-in" id="qr-success-panel">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500" />
        <div className="mx-auto w-16 h-16 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <Check size={32} strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-display font-bold text-slate-800 dark:text-slate-100 mb-4 tracking-tight">
          Attendance Recorded
        </h2>
        <p className="text-base text-slate-700 dark:text-slate-200 font-sans tracking-wide leading-relaxed font-semibold px-2">
          God Bless you. Enjoy the rest of the service in God's presence.
        </p>
      </div>
    );
  }

  // RENDER: Duplicate Check-In Protection Screen
  if (duplicateCheckedIn) {
    return (
      <div className="w-full max-w-md mx-auto p-10 bg-white dark:bg-slate-900 rounded-3xl border border-amber-500/20 shadow-xl text-center relative overflow-hidden animate-fade-in" id="qr-duplicate-panel">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 to-orange-500" />
        <div className="mx-auto w-16 h-16 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-450 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <span className="text-2xl">👋</span>
        </div>
        <h2 className="text-xl font-display font-bold text-slate-800 dark:text-slate-100 mb-4 tracking-tight">
          Already Registered
        </h2>
        <p className="text-base text-slate-705 dark:text-slate-205 font-sans tracking-wide leading-relaxed font-semibold px-2">
          You have already taken attendance for this program today. God Bless you.
        </p>
      </div>
    );
  }

  // RENDER: Loading smart profile
  if (autoChecking) {
    return (
      <div className="w-full max-w-md mx-auto p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col items-center justify-center">
        <RefreshCw className="animate-spin text-blue-600 dark:text-blue-400 mb-4" size={36} />
        <h3 className="text-xl font-display font-bold text-slate-800 dark:text-slate-100">Smart Recognition</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Identifying your device's profile for seamless register...</p>
      </div>
    );
  }

  // RENDER: Success screen
  if (success) {
    const isAlreadyChecked = resolvedStatus === "already_checked_in";
    return (
      <div className="w-full max-w-md mx-auto" id="form-success-card">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className={`bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border ${
            isAlreadyChecked ? "border-amber-500/20" : "border-emerald-500/20"
          } text-center p-8 sm:p-10 relative`}
        >
          {/* Subtle background visual glows */}
          <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${
            isAlreadyChecked ? "from-amber-400 to-orange-500" : "from-emerald-400 to-teal-500"
          }`} />

          <div className={`mx-auto w-16 h-16 ${
            isAlreadyChecked 
              ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400" 
              : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"
          } rounded-full flex items-center justify-center mb-6 shadow-sm`}>
            {isAlreadyChecked ? (
              <span className="text-2xl">👋</span>
            ) : (
              <Check size={32} strokeWidth={2.5} />
            )}
          </div>

          <h2 className="text-2xl font-display font-bold text-slate-800 dark:text-slate-100 mb-2 tracking-tight">
            {isAlreadyChecked ? "All Checked!" : "Recorded Successfully!"}
          </h2>
          
          <p className="text-slate-400 dark:text-slate-500 font-semibold mb-6 flex items-center justify-center gap-1 text-xs">
            <Sparkles size={12} className="text-indigo-500" /> Date: {formatDateLabel(serviceDate)}
          </p>

          <p className="text-base text-slate-700 dark:text-slate-200 font-sans tracking-wide leading-relaxed px-2 font-medium">
            {resolvedMsg || "God Bless you. Enjoy the rest of the service in God's presence."}
          </p>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-850 flex flex-col gap-3">
            {recognizedProfile && (
              <button
                type="button"
                onClick={handleBackToChecklist}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all tracking-wide cursor-pointer flex items-center justify-center gap-1.5 shadow-sm uppercase"
              >
                📅 Log Another Program / Event Today
              </button>
            )}

            <button
              type="button"
              onClick={handleRegisterAnother}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              id="clear-device-btn"
            >
              🔄 Not you? Click to Switch Accounts
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // CASE 3: RETURNING MEMBERS PANEL (ONLY SELECTION BUTTONS DISPLAYED)
  if (recognizedProfile) {
    return (
      <div className="w-full max-w-lg mx-auto" id="attendance-form-container">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-200/50 dark:border-slate-800 relative"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
          
          <div className="p-6 sm:p-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">
                <Sparkle size={12} className="text-indigo-500" />
                Sanctuary Portal Recognized
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-800 dark:text-slate-100 mb-1 tracking-tight">
                Welcome back, {recognizedProfile.firstName}!
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                Service/Program Date: <span className="text-blue-600 dark:text-blue-400 font-semibold">{formatDateLabel(serviceDate)}</span>
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Click any of today's programs below to register your attendance instantly!
              </p>
            </div>

            {error && (
              <div className="p-4 mb-6 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-semibold flex gap-2">
                <span className="font-bold flex-shrink-0">⚠️ Notice:</span>
                <span>{error}</span>
              </div>
            )}

            {/* THREE LARGE ATTENDANCE BUTTONS FOR RETURNING MEMBERS */}
            <div className="space-y-4">
              
              {/* 1. Sunday Experience */}
              <button
                type="button"
                disabled={loading}
                onClick={() => handleReturningCheckin("Sunday Experience")}
                className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 text-left transition-all duration-200 relative overflow-hidden group cursor-pointer ${
                  checkedEvents["Sunday Experience"]
                    ? "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500 ring-2 ring-emerald-500/15"
                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 hover:border-blue-500 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    checkedEvents["Sunday Experience"] 
                      ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600" 
                      : "bg-blue-100 dark:bg-blue-950/30 text-blue-600"
                  }`}>
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base tracking-tight">Sunday Experience</h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-sans mt-0.5">
                      Sunday service worship, word and manifestation
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  {checkedEvents["Sunday Experience"] ? (
                    <span className="inline-flex items-center gap-1 font-sans text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 px-2.5 py-1 rounded-full">
                      <CheckCircle size={14} /> Checked-In
                    </span>
                  ) : (
                    <span className="opacity-0 group-hover:opacity-100 transition-all font-sans text-xs text-blue-500 flex items-center gap-1 font-bold">
                      Select <ArrowRight size={14} />
                    </span>
                  )}
                </div>
              </button>

              {/* 2. Word Cafe */}
              <button
                type="button"
                disabled={loading}
                onClick={() => handleReturningCheckin("Word Cafe")}
                className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 text-left transition-all duration-200 relative overflow-hidden group cursor-pointer ${
                  checkedEvents["Word Cafe"]
                    ? "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500 ring-2 ring-emerald-500/15"
                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 hover:border-violet-500 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    checkedEvents["Word Cafe"] 
                      ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600" 
                      : "bg-violet-100 dark:bg-violet-950/30 text-violet-600"
                  }`}>
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base tracking-tight">Word Cafe</h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-sans mt-0.5">
                      Midweek fellowship study and deep dive theology
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  {checkedEvents["Word Cafe"] ? (
                    <span className="inline-flex items-center gap-1 font-sans text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 px-2.5 py-1 rounded-full">
                      <CheckCircle size={14} /> Checked-In
                    </span>
                  ) : (
                    <span className="opacity-0 group-hover:opacity-100 transition-all font-sans text-xs text-violet-500 flex items-center gap-1 font-bold">
                      Select <ArrowRight size={14} />
                    </span>
                  )}
                </div>
              </button>

              {/* 3. Special Program */}
              <button
                type="button"
                disabled={loading}
                onClick={() => handleReturningCheckin("Special Program")}
                className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 text-left transition-all duration-200 relative overflow-hidden group cursor-pointer ${
                  checkedEvents["Special Program"]
                    ? "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500 ring-2 ring-emerald-500/15"
                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 hover:border-amber-500 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    checkedEvents["Special Program"] 
                      ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600" 
                      : "bg-amber-100 dark:bg-amber-950/30 text-amber-600"
                  }`}>
                    <Star size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base tracking-tight">Special Program</h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-sans mt-0.5">
                      Vigils, monthly revivals or unique church programs
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  {checkedEvents["Special Program"] ? (
                    <span className="inline-flex items-center gap-1 font-sans text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 px-2.5 py-1 rounded-full">
                      <CheckCircle size={14} /> Checked-In
                    </span>
                  ) : (
                    <span className="opacity-0 group-hover:opacity-100 transition-all font-sans text-xs text-amber-500 flex items-center gap-1 font-bold">
                      Select <ArrowRight size={14} />
                    </span>
                  )}
                </div>
              </button>
            </div>

            {loading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-slate-400">
                <RefreshCw size={14} className="animate-spin text-blue-500" />
                Updating attendance credentials on church server...
              </div>
            )}

            <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-850 text-center">
              <button
                type="button"
                onClick={handleRegisterAnother}
                className="text-xs text-slate-400 hover:text-blue-500 hover:underline"
              >
                Not {recognizedProfile.firstName}? Click here to register a different person
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // CASE 4: FIRST-TIME REGISTRATION FORM WITH COMPULSIVE ATTENDANCE SELECTION
  return (
    <div className="w-full max-w-lg mx-auto" id="attendance-form-container">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-200/50 dark:border-slate-800 relative"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
        
        {/* Decorative corner glows */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="p-6 sm:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles size={12} />
              Welcome to Church Service
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-800 dark:text-slate-100 mb-2 tracking-tight">
              Service Attendance Register
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Service Date: <span className="text-blue-600 dark:text-blue-400 font-semibold">{formatDateLabel(serviceDate)}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" id="attendance-main-form">
            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-semibold flex gap-2">
                <span className="font-bold flex-shrink-0">⚠️ Error:</span>
                <span>{error}</span>
              </div>
            )}

            {/* FIRST NAME AND LAST NAME IN ONE ROW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-1.5">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    id="first_name"
                    name="firstName"
                    required
                    placeholder="Enter first name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 dark:text-slate-100 text-sm sm:text-base font-medium transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="last_name" className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-1.5">
                  Last Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    id="last_name"
                    name="lastName"
                    required
                    placeholder="Enter last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 dark:text-slate-100 text-sm sm:text-base font-medium transition-all"
                  />
                </div>
              </div>
            </div>

            {/* WHATSAPP WITH ADVISING COUNTRY CODE */}
            <div>
              <label htmlFor="whatsapp_number" className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-1">
                WhatsApp Number <span className="text-rose-500">*</span>
              </label>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1.5 italic">
                Must include country code (e.g. +23480XXXXXXXX or +1415XXXXXXX)
              </p>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Phone size={14} />
                </span>
                <input
                  type="tel"
                  id="whatsapp_number"
                  name="whatsAppNumber"
                  required
                  placeholder="+234 803 123 4567"
                  value={whatsAppNumber}
                  onChange={(e) => setWhatsAppNumber(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 dark:text-slate-100 text-sm sm:text-base font-medium transition-all"
                />
              </div>
            </div>

            {/* MUTUALLY EXCLUSIVE SELECTION: WORKER OR MEMBER CHECKBOXES */}
            <div>
              <span className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-2.5">
                Role Category <span className="text-rose-500">*</span>
              </span>
              <div className="flex flex-col md:flex-row gap-4 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-850">
                <label 
                  htmlFor="role-member" 
                  className="flex-1 flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-850 cursor-pointer transition-all shadow-sm"
                >
                  <input
                    type="checkbox"
                    id="role-member"
                    checked={role === "member"}
                    onChange={() => setRole("member")}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Member</span>
                    <span className="text-[10px] text-slate-400">Regular congregation attendee</span>
                  </div>
                </label>

                <label 
                  htmlFor="role-children" 
                  className="flex-1 flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-850 cursor-pointer transition-all shadow-sm"
                >
                  <input
                    type="checkbox"
                    id="role-children"
                    checked={role === "children"}
                    onChange={() => setRole("children")}
                    className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Children Department</span>
                    <span className="text-[10px] text-slate-400">Kids and youth ministry</span>
                  </div>
                </label>

                <label 
                  htmlFor="role-worker" 
                  className="flex-1 flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-850 cursor-pointer transition-all shadow-sm"
                >
                  <input
                    type="checkbox"
                    id="role-worker"
                    checked={role === "worker"}
                    onChange={() => setRole("worker")}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Worker</span>
                    <span className="text-[10px] text-slate-400">Service facilitator or team leader</span>
                  </div>
                </label>
              </div>
            </div>

            {/* MUTUALLY EXCLUSIVE GENDER SELECTION: MALE OR FEMALE CHECKBOXES */}
            <div>
              <span className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-2.5">
                Gender / Sex <span className="text-rose-500">*</span>
              </span>
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-850">
                <label 
                  htmlFor="gender-male" 
                  className="flex-1 flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-850 cursor-pointer transition-all shadow-sm"
                >
                  <input
                    type="checkbox"
                    id="gender-male"
                    checked={gender === "Male"}
                    onChange={() => setGender("Male")}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Male</span>
                    <span className="text-[10px] text-slate-400">Brother / Man</span>
                  </div>
                </label>

                <label 
                  htmlFor="gender-female" 
                  className="flex-1 flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-850 cursor-pointer transition-all shadow-sm"
                >
                  <input
                    type="checkbox"
                    id="gender-female"
                    checked={gender === "Female"}
                    onChange={() => setGender("Female")}
                    className="w-5 h-5 rounded border-slate-300 text-pink-600 focus:ring-pink-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Female</span>
                    <span className="text-[10px] text-slate-400">Sister / Woman</span>
                  </div>
                </label>
              </div>
            </div>

            {/* ATTENDANCE EVENT CATEGORY SELECTOR FOR NEW REGISTRATIONS (comprising requirements below the form) */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-850">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-3 text-center sm:text-left">
                Select Attendance Program / Service <span className="text-rose-500">*</span>
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* 1. Sunday Experience */}
                <button
                  type="button"
                  onClick={() => setSelectedEvent("Sunday Experience")}
                  className={`flex flex-col items-center justify-center p-4.5 rounded-xl border-2 text-center transition-all cursor-pointer ${
                    selectedEvent === "Sunday Experience"
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500 scale-[0.98] ring-2 ring-blue-500/15"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <Calendar size={20} className="mb-1 text-blue-500" />
                  <span className="text-[11px] font-bold tracking-tight">Sunday Experience</span>
                </button>

                {/* 2. Word Cafe */}
                <button
                  type="button"
                  onClick={() => setSelectedEvent("Word Cafe")}
                  className={`flex flex-col items-center justify-center p-4.5 rounded-xl border-2 text-center transition-all cursor-pointer ${
                    selectedEvent === "Word Cafe"
                      ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500 scale-[0.98] ring-2 ring-violet-500/15"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <BookOpen size={20} className="mb-1 text-violet-500" />
                  <span className="text-[11px] font-bold tracking-tight">Word Cafe</span>
                </button>

                {/* 3. Special Program */}
                <button
                  type="button"
                  onClick={() => setSelectedEvent("Special Program")}
                  className={`flex flex-col items-center justify-center p-4.5 rounded-xl border-2 text-center transition-all cursor-pointer ${
                    selectedEvent === "Special Program"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500 scale-[0.98] ring-2 ring-amber-500/15"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <Star size={20} className="mb-1 text-amber-500" />
                  <span className="text-[11px] font-bold tracking-tight">Special Program</span>
                </button>
              </div>

              {selectedEvent && (
                <p className="text-[10px] text-slate-400 text-center font-bold uppercase tracking-wider mt-2.5">
                  ✓ Selected: <span className="text-emerald-500">{selectedEvent}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              id="submit-attendance-btn"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold tracking-wide hover:from-blue-700 hover:to-indigo-700 transition-all text-sm sm:text-base shadow-md cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white animate-pulse" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Registering & logging attendance...</span>
                </>
              ) : (
                <>
                  <span>Submit Register</span>
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
