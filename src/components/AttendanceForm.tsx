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
  const [role, setRole] = useState<"member" | "worker">("member");
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
        // Find closest/most recent Sunday of today
        const today = new Date();
        const day = today.getDay();
        today.setDate(today.getDate() - day);
        resolvedDate = today.toISOString().split("T")[0];
      }
    }

    setServiceDate(resolvedDate);

    // Smart Recognition of Returning Attendees via saved profile
    const savedId = localStorage.getItem("attendance_profile_id");
    if (savedId && resolvedDate) {
      triggerAutoCheckin(savedId, resolvedDate);
    }
  }, [defaultDate]);

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

      setResolvedStatus(data.status);
      setResolvedMsg(data.message);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong while logging attendance. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Submit returning member check-in on clicking quick category button
  const handleReturningCheckin = async (eventTypeArg: "Sunday Experience" | "Word Cafe" | "Special Program") => {
    if (!recognizedProfile) return;

    // Direct local warning for checked events to skip waiting for the server response
    if (checkedEvents[eventTypeArg]) {
      setError(`You have already taken attendance for this program today. God Bless you.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/attendance/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: recognizedProfile.id,
          eventType: eventTypeArg,
          submissionDate: serviceDate
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to record attendance.");
      }

      if (data.status === "already_checked_in") {
        setError("You have already taken attendance for this program today. God Bless you.");
        setCheckedEvents(prev => ({ ...prev, [eventTypeArg]: true }));
      } else {
        // Successful check-in!
        setCheckedEvents(prev => ({ ...prev, [eventTypeArg]: true }));
        setResolvedStatus(data.status);
        setResolvedMsg(data.message);
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong recording your attendance. Please try again.");
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

            {/* MUTUALLY EXCLUSIVE SELECTION: WORKER OR MEMBER CHECKBOX CARDS */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-2.5">
                Role Category <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  id="role-member-btn"
                  onClick={() => setRole("member")}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-250 cursor-pointer ${
                    role === "member"
                      ? "bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500 scale-[0.98] ring-2 ring-blue-500/15"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <Users size={22} className="mb-1.5" />
                  <span className="text-xs font-bold tracking-tight">Member</span>
                  <div className="mt-1.5 flex items-center gap-15">
                    <input
                      type="checkbox"
                      id="role-member-checkbox"
                      checked={role === "member"}
                      readOnly
                      className="rounded border-slate-300 text-blue-500 focus:ring-blue-500 pointer-events-none"
                    />
                    <span className="text-[10px] font-semibold text-slate-400">Selected</span>
                  </div>
                </button>

                <button
                  type="button"
                  id="role-worker-btn"
                  onClick={() => setRole("worker")}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-250 cursor-pointer ${
                    role === "worker"
                      ? "bg-violet-500/5 text-violet-600 dark:text-violet-400 border-violet-500 scale-[0.98] ring-2 ring-violet-500/15"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <Shield size={22} className="mb-1.5" />
                  <span className="text-xs font-bold tracking-tight">Worker</span>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="role-worker-checkbox"
                      checked={role === "worker"}
                      readOnly
                      className="rounded border-slate-300 text-violet-500 focus:ring-violet-500 pointer-events-none"
                    />
                    <span className="text-[10px] font-semibold text-slate-400">Selected</span>
                  </div>
                </button>
              </div>
            </div>

            {/* MUTUALLY EXCLUSIVE GENDER SELECTION: MALE OR FEMALE CHECKBOX CARDS */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-2.5">
                Gender / Sex <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  id="gender-male-btn"
                  onClick={() => setGender("Male")}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-250 cursor-pointer ${
                    gender === "Male"
                      ? "bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500 scale-[0.98] ring-2 ring-blue-500/15"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <span className="text-2xl mb-1">🧔</span>
                  <span className="text-xs font-bold tracking-tight">Male</span>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="gender-male-checkbox"
                      checked={gender === "Male"}
                      onChange={(e) => {
                        e.stopPropagation();
                        setGender("Male");
                      }}
                      className="rounded border-slate-300 text-blue-500 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-[10px] font-semibold text-slate-400">Click to Select</span>
                  </div>
                </button>

                <button
                  type="button"
                  id="gender-female-btn"
                  onClick={() => setGender("Female")}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-250 cursor-pointer ${
                    gender === "Female"
                      ? "bg-pink-500/5 text-pink-600 dark:text-pink-400 border-pink-500 scale-[0.98] ring-2 ring-pink-500/15"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <span className="text-2xl mb-1">👩</span>
                  <span className="text-xs font-bold tracking-tight">Female</span>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="gender-female-checkbox"
                      checked={gender === "Female"}
                      onChange={(e) => {
                        e.stopPropagation();
                        setGender("Female");
                      }}
                      className="rounded border-slate-300 text-pink-500 focus:ring-pink-500 cursor-pointer"
                    />
                    <span className="text-[10px] font-semibold text-slate-400">Click to Select</span>
                  </div>
                </button>
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
