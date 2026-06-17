import React, { useState, useEffect } from "react";
import { Check, Heart, Shield, Sparkles, User, Users } from "lucide-react";
import { motion } from "motion/react";

interface AttendanceFormProps {
  defaultDate?: string;
}

export default function AttendanceForm({ defaultDate }: AttendanceFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [whatsAppNumber, setWhatsAppNumber] = useState("");
  const [role, setRole] = useState<"member" | "worker">("member");
  const [gender, setGender] = useState<"Male" | "Female" | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Parse URL queries for date pre-selection
  const [serviceDate, setServiceDate] = useState("");

  useEffect(() => {
    if (defaultDate) {
      setServiceDate(defaultDate);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get("date");
    if (dateParam) {
      if (dateParam.startsWith("month-")) {
        // Monthly QR code format: month-YYYY-MM
        try {
          const monthStr = dateParam.replace("month-", ""); // e.g. "2026-06"
          const parts = monthStr.split("-");
          const year = parseInt(parts[0], 10);
          const monthIdx = parseInt(parts[1], 10) - 1; // 0-indexed

          const today = new Date();
          if (today.getFullYear() === year && today.getMonth() === monthIdx) {
            // If scanning within the same month, calculate Sunday of this week
            const target = new Date(today);
            const day = target.getDay();
            target.setDate(target.getDate() - day); // Goes back to the most recent Sunday
            
            // Format to YYYY-MM-DD cleanly using timezone-safe format
            const y = target.getFullYear();
            const m = String(target.getMonth() + 1).padStart(2, "0");
            const d = String(target.getDate()).padStart(2, "0");
            setServiceDate(`${y}-${m}-${d}`);
          } else {
            // Fallback to first Sunday of that specific month
            const firstOfM = new Date(year, monthIdx, 1);
            const firstDayOfWeek = firstOfM.getDay();
            const diff = firstDayOfWeek === 0 ? 0 : 7 - firstDayOfWeek;
            const firstSunday = new Date(firstOfM);
            firstSunday.setDate(firstOfM.getDate() + diff);
            
            const y = firstSunday.getFullYear();
            const m = String(firstSunday.getMonth() + 1).padStart(2, "0");
            const d = String(firstSunday.getDate()).padStart(2, "0");
            setServiceDate(`${y}-${m}-${d}`);
          }
        } catch (err) {
          console.error("Error parsing monthly QR date:", err);
          // Standard backup
          const today = new Date();
          const day = today.getDay();
          today.setDate(today.getDate() - day);
          setServiceDate(today.toISOString().split("T")[0]);
        }
      } else {
        setServiceDate(dateParam);
      }
    } else {
      // Find closest/most recent Sunday of today
      const today = new Date();
      const day = today.getDay();
      today.setDate(today.getDate() - day);
      setServiceDate(today.toISOString().split("T")[0]);
    }
  }, [defaultDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!firstName.trim()) {
      setError("First Name is required.");
      setLoading(false);
      return;
    }
    if (!lastName.trim()) {
      setError("Last Name is required.");
      setLoading(false);
      return;
    }
    if (!whatsAppNumber.trim()) {
      setError("WhatsApp Number is required.");
      setLoading(false);
      return;
    }

    if (!gender) {
      setError("Please select a gender (Male or Female) to submit your attendance.");
      setLoading(false);
      return;
    }

    // Basic WhatsApp validation
    const phoneDigits = whatsAppNumber.replace(/\D/g, "");
    if (phoneDigits.length < 8) {
      setError("Please enter a valid WhatsApp number including country code (e.g. +14155551234 or +2348012345678).");
      setLoading(false);
      return;
    }

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
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData?.error || "Failed to log attendance.");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong while logging attendance. Please try again.");
    } finally {
      setLoading(false);
    }
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

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto" id="form-success-card">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-emerald-500/20 text-center p-8 sm:p-12 relative"
        >
          {/* Subtle background visual glows */}
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500" />
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl" />
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl" />

          <div className="mx-auto w-20 h-20 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <Check size={40} strokeWidth={2.5} />
          </div>

          <h2 className="text-3xl font-display font-bold text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
            Registered!
          </h2>
          
          <p className="text-emerald-600 dark:text-emerald-400 font-medium mb-6 flex items-center justify-center gap-1.5 text-sm sm:text-base">
            <Sparkles size={16} /> Service: {formatDateLabel(serviceDate)}
          </p>

          <p className="text-lg text-slate-600 dark:text-slate-300 font-sans tracking-wide leading-relaxed px-2 font-medium">
            "God Bless you. Enjoy the rest of the service in God's presence."
          </p>

          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <Heart size={14} className="text-rose-500 animate-pulse" />
            <span>Church Administration Management</span>
          </div>
        </motion.div>
      </div>
    );
  }

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

          <form onSubmit={handleSubmit} className="space-y-5" id="attendance-main-form">
            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-sm font-medium flex gap-2">
                <span className="font-bold flex-shrink-0">⚠️ Error:</span>
                <span>{error}</span>
              </div>
            )}

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

            <div>
              <label htmlFor="whatsapp_number" className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-1">
                WhatsApp Number <span className="text-rose-500">*</span>
              </label>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1.5 italic">
                Must include country code (e.g. +23480XXXXXXXX or +1415XXXXXXX)
              </p>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                  📱
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

            {/* MUTUALLY EXCLUSIVE SELECTION: CHECKBOX COPIES AS CARD BUTTONS */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-2.5">
                Role Category <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  id="role-member-btn"
                  onClick={() => setRole("member")}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-250 ${
                    role === "member"
                      ? "bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500 scale-[0.98] ring-2 ring-blue-500/15"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <Users size={22} className="mb-1.5" />
                  <span className="text-sm font-bold tracking-tight">Member</span>
                  <div className="mt-1.5 flex items-center gap-1">
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
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-250 ${
                    role === "worker"
                      ? "bg-violet-500/5 text-violet-600 dark:text-violet-400 border-violet-500 scale-[0.98] ring-2 ring-violet-500/15"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <Shield size={22} className="mb-1.5" />
                  <span className="text-sm font-bold tracking-tight">Worker</span>
                  <div className="mt-1.5 flex items-center gap-1">
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

            {/* MUTUALLY EXCLUSIVE GENDER SELECTION: CHECKBOX COPIES AS CARD BUTTONS */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-2.5">
                Gender / Sex <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  id="gender-male-btn"
                  onClick={() => setGender("Male")}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-250 ${
                    gender === "Male"
                      ? "bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500 scale-[0.98] ring-2 ring-blue-500/15"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <span className="text-2xl mb-1.5">🧔</span>
                  <span className="text-sm font-bold tracking-tight">Male</span>
                  <div className="mt-1.5 flex items-center gap-1">
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
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-250 ${
                    gender === "Female"
                      ? "bg-pink-500/5 text-pink-600 dark:text-pink-400 border-pink-500 scale-[0.98] ring-2 ring-pink-500/15"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <span className="text-2xl mb-1.5">👩</span>
                  <span className="text-sm font-bold tracking-tight">Female</span>
                  <div className="mt-1.5 flex items-center gap-1">
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

            <button
              type="submit"
              id="submit-attendance-btn"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold tracking-wide hover:from-blue-700 hover:to-indigo-700 transition-all text-sm sm:text-base shadow-md cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Logging attendance...</span>
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
