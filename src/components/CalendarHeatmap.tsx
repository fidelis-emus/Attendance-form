import React, { useState, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, Grid, Layout, Info, TrendingUp, Users, Shield, Smile, Filter } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CalendarHeatmapProps {
  attendanceHistory: any[];
}

export default function CalendarHeatmap({ attendanceHistory }: CalendarHeatmapProps) {
  // Current local year filter
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [viewMode, setViewMode] = useState<"months" | "timeline">("months");
  
  // Interactive filters
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Hover state for interactive tooltip
  const [hoveredDay, setHoveredDay] = useState<{
    date: Date;
    dateStr: string;
    records: any[];
    total: number;
    members: number;
    workers: number;
    children: number;
  } | null>(null);

  // Dynamic years list from actual attendance records
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    attendanceHistory.forEach((rec) => {
      if (rec.date) {
        const y = new Date(rec.date).getFullYear();
        if (!isNaN(y)) {
          years.add(y);
        }
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [attendanceHistory, currentYear]);

  // Format Helper Local Year-Month-Day
  const formatDateStr = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Compile active days and attendance counts
  const attendanceMap = useMemo(() => {
    const map: Record<string, {
      records: any[];
      total: number;
      members: number;
      workers: number;
      children: number;
    }> = {};

    attendanceHistory.forEach((rec) => {
      if (!rec.date) return;
      const dStr = rec.date; // already YYYY-MM-DD
      
      // Filter out before compiling counts
      if (eventTypeFilter !== "all" && (rec.eventType || "Sunday Experience") !== eventTypeFilter) return;
      
      const recRole = String(rec.personType || rec.role || "").toLowerCase();
      if (roleFilter !== "all") {
        if (roleFilter === "member" && recRole !== "member") return;
        if (roleFilter === "worker" && recRole !== "worker") return;
        if (roleFilter === "children" && recRole !== "children" && recRole !== "chiden") return;
      }

      if (!map[dStr]) {
        map[dStr] = { records: [], total: 0, members: 0, workers: 0, children: 0 };
      }

      map[dStr].records.push(rec);
      map[dStr].total += 1;
      
      if (recRole === "member") {
        map[dStr].members += 1;
      } else if (recRole === "worker") {
        map[dStr].workers += 1;
      } else if (recRole === "chiden" || recRole === "children") {
        map[dStr].children += 1;
      }
    });

    return map;
  }, [attendanceHistory, eventTypeFilter, roleFilter]);

  // Generate list of all days in the selected year
  const daysInSelectedYear = useMemo(() => {
    const arr = [];
    const start = new Date(selectedYear, 0, 1);
    const end = new Date(selectedYear, 11, 31);
    const curr = new Date(start);
    while (curr <= end) {
      arr.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return arr;
  }, [selectedYear]);

  // Color mapping based on headcount count
  const getColorClass = (count: number) => {
    if (count === 0) return "bg-slate-100 dark:bg-slate-800/40 text-slate-300 border-slate-200/20";
    if (count <= 5) return "bg-emerald-50 dark:bg-emerald-950/20 hover:scale-110 border-emerald-100/50";
    if (count <= 20) return "bg-emerald-250 dark:bg-emerald-900/40 hover:scale-125 border-emerald-300/30";
    if (count <= 50) return "bg-emerald-400 dark:bg-emerald-700/60 hover:scale-125 border-emerald-400/55";
    return "bg-emerald-600 dark:bg-emerald-500 hover:scale-125 border-emerald-600/70 shadow-sm";
  };

  // Identify Peak Turnout Events (Ranked highest list)
  const peakEvents = useMemo(() => {
    const list: Array<{
      date: string;
      total: number;
      members: number;
      workers: number;
      children: number;
      eventTypes: string[];
    }> = [];

    Object.entries(attendanceMap).forEach(([dateStr, metricsVal]) => {
      const metrics = metricsVal as {
        records: any[];
        total: number;
        members: number;
        workers: number;
        children: number;
      };
      // Parse year to match selected
      const eventYear = new Date(dateStr).getFullYear();
      if (eventYear === selectedYear && metrics.total > 0) {
        const types = Array.from(new Set(metrics.records.map((r: any) => r.eventType || "Sunday Experience"))) as string[];
        list.push({
          date: dateStr,
          total: metrics.total,
          members: metrics.members,
          workers: metrics.workers,
          children: metrics.children,
          eventTypes: types,
        });
      }
    });

    return list.sort((a, b) => b.total - a.total).slice(0, 5);
  }, [attendanceMap, selectedYear]);

  // Render month layout helper (months view)
  const monthsData = useMemo(() => {
    const months = [];
    for (let m = 0; m < 12; m++) {
      const firstDay = new Date(selectedYear, m, 1);
      const daysInMonth = new Date(selectedYear, m + 1, 0).getDate();
      const padding = firstDay.getDay(); // 0 is Sunday, etc.
      
      const monthDays = [];
      // Empty spaces for start day alignment
      for (let p = 0; p < padding; p++) {
        monthDays.push(null);
      }
      for (let d = 1; d <= daysInMonth; d++) {
        monthDays.push(new Date(selectedYear, m, d));
      }
      months.push({
        num: m,
        name: firstDay.toLocaleString("default", { month: "long" }),
        days: monthDays,
      });
    }
    return months;
  }, [selectedYear]);

  // Render classic timeline columns (timeline view)
  // 53 columns representing weeks of the year, rows representing Sunday(0) to Saturday(6)
  const weeksData = useMemo(() => {
    // Generate empty 7x53 grid
    const grid: Array<Array<Date | null>> = Array.from({ length: 7 }, () => Array(53).fill(null));
    const firstJan = new Date(selectedYear, 0, 1);
    const jan1Day = firstJan.getDay();

    daysInSelectedYear.forEach((day) => {
      const diffInDays = Math.floor((day.getTime() - firstJan.getTime()) / (1000 * 60 * 60 * 24));
      const colIndex = Math.floor((diffInDays + jan1Day) / 7);
      const rowIndex = day.getDay();
      if (colIndex < 53) {
        grid[rowIndex][colIndex] = day;
      }
    });

    return grid;
  }, [daysInSelectedYear, selectedYear]);

  const handleDayHover = (day: Date | null) => {
    if (!day) {
      setHoveredDay(null);
      return;
    }
    const dStr = formatDateStr(day);
    const metrics = attendanceMap[dStr] || { records: [], total: 0, members: 0, workers: 0, children: 0 };
    setHoveredDay({
      date: day,
      dateStr: dStr,
      ...metrics
    });
  };

  const getIntensityText = (count: number) => {
    if (count === 0) return "No attendance logged";
    if (count <= 10) return "Level 1: Minimal Turnout";
    if (count <= 30) return "Level 2: Moderate Turnout";
    if (count <= 60) return "Level 3: Strong Turnout";
    return "Level 4: Peak Turnout 🔥";
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6" id="calendar-heatmap-card">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <span className="p-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Calendar size={18} />
            </span>
            <span>Annual Attendance Heatmap</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic distribution mapping tool highlighting high-turnout dates and attendance logs across {selectedYear}.
          </p>
        </div>

        {/* View Selection & Filters Container */}
        <div className="flex flex-wrap items-center gap-2.5 no-print">
          {/* Year Navigator */}
          <div className="flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 rounded-xl px-2 py-1">
            <button
              onClick={() => setSelectedYear(prev => prev - 1)}
              className="p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg"
              title="Previous Year"
            >
              <ChevronLeft size={16} />
            </button>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 outline-none px-2 py-0.5 cursor-pointer font-sans"
            >
              {availableYears.map(y => (
                <option key={y} value={y} className="bg-white dark:bg-slate-900">{y}</option>
              ))}
            </select>
            <button
              onClick={() => setSelectedYear(prev => prev + 1)}
              className="p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg"
              title="Next Year"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 p-0.5 rounded-xl">
            <button
              onClick={() => setViewMode("months")}
              className={`flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                viewMode === "months"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              title="Show 12 Mini Calendar Months"
            >
              <Grid size={13} />
              <span>Months</span>
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                viewMode === "timeline"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              title="GitHub Style Timeline Map"
            >
              <Layout size={13} />
              <span>Timeline</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-250/20 rounded-xl no-print">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <Filter size={13} />
          <span>Quick Filters:</span>
        </span>

        {/* Event Type */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400">Programs:</span>
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="text-xs bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value="all">All Services</option>
            <option value="Sunday Experience">Sunday Experience</option>
            <option value="Word Cafe">Word Cafe</option>
            <option value="Special Program">Special Programs Included</option>
          </select>
        </div>

        {/* Role Type */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400">Demographic:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value="all">Total Population (All)</option>
            <option value="member">Members Database only</option>
            <option value="worker">Registered Workers only</option>
            <option value="children">Kids roster category only</option>
          </select>
        </div>
      </div>

      {/* MAIN HEATMAP AREA */}
      <div className="relative overflow-x-auto select-none rounded-xl" id="heatmap-data-scrollable">
        <AnimatePresence mode="wait">
          {viewMode === "months" ? (
            <motion.div
              key="months"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5"
            >
              {monthsData.map((m) => (
                <div key={m.num} className="border border-slate-100 dark:border-slate-850 p-3 rounded-xl bg-slate-50/20 dark:bg-slate-950/20 flex flex-col">
                  <h4 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 tracking-wider text-center uppercase mb-2 border-b border-slate-100 dark:border-slate-850/50 pb-1">
                    {m.name}
                  </h4>
                  <div className="grid grid-cols-7 gap-1 text-center font-sans">
                    {/* Day Names Row */}
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(label => (
                      <span key={label} className="text-[9px] font-bold text-slate-400">{label}</span>
                    ))}
                    {/* Month Days list */}
                    {m.days.map((day, dIdx) => {
                      if (!day) {
                        return <div key={`empty-${dIdx}`} className="aspect-square w-full" />;
                      }
                      const dStr = formatDateStr(day);
                      const metrics = attendanceMap[dStr] || { total: 0 };
                      const color = getColorClass(metrics.total);

                      return (
                        <div
                          key={dStr}
                          className={`aspect-square rounded-md border border-slate-250/20 ${color} cursor-pointer transition-all duration-100 flex items-center justify-center relative text-[10px] font-bold ${
                            metrics.total > 0 ? "text-emerald-950 dark:text-emerald-100" : "text-slate-300 dark:text-slate-600 font-normal"
                          }`}
                          onMouseEnter={() => handleDayHover(day)}
                          onMouseLeave={() => setHoveredDay(null)}
                          onClick={() => handleDayHover(day)}
                        >
                          {day.getDate()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="min-w-[760px] p-4 border border-slate-100 dark:border-slate-850 rounded-xl bg-slate-50/10 dark:bg-slate-950/10"
            >
              <div className="flex gap-2">
                {/* Visual labels for weekdays */}
                <div className="flex flex-col justify-between text-[10px] text-slate-400 font-bold pr-1 pt-6 h-[84px]">
                  <span>S</span>
                  <span>M</span>
                  <span>T</span>
                  <span>W</span>
                  <span>T</span>
                  <span>F</span>
                  <span>S</span>
                </div>

                <div className="flex-1 space-y-1">
                  {/* Months labels horizontal */}
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1 pb-1">
                    <span>Jan</span>
                    <span>Feb</span>
                    <span>Mar</span>
                    <span>Apr</span>
                    <span>May</span>
                    <span>Jun</span>
                    <span>Jul</span>
                    <span>Aug</span>
                    <span>Sep</span>
                    <span>Oct</span>
                    <span>Nov</span>
                    <span>Dec</span>
                  </div>

                  {/* 7 rows of weeks */}
                  <div className="space-y-1">
                    {weeksData.map((row, rIdx) => (
                      <div key={rIdx} className="flex gap-1">
                        {row.map((day, cIdx) => {
                          if (!day) {
                            return (
                              <div
                                key={`empty-${rIdx}-${cIdx}`}
                                className="w-2.5 h-2.5 rounded-sm bg-transparent"
                              />
                            );
                          }
                          const dStr = formatDateStr(day);
                          const metrics = attendanceMap[dStr] || { total: 0 };
                          const color = getColorClass(metrics.total);

                          return (
                            <div
                              key={dStr}
                              className={`w-2.5 h-2.5 rounded-sm border border-slate-200/10 ${color} cursor-pointer transition-all duration-100`}
                              onMouseEnter={() => handleDayHover(day)}
                              onMouseLeave={() => setHoveredDay(null)}
                              onClick={() => handleDayHover(day)}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FLOATING HOVER INTUITIVE TOOLTIP PANEL */}
        {hoveredDay && (
          <div className="absolute top-2 right-2 max-w-xs bg-slate-900 border border-slate-800 text-white rounded-xl p-3 shadow-xl z-30 transition-all duration-100 text-xs flex flex-col gap-1.5 animate-fadeIn backdrop-blur-md">
            <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
              <span className="font-extrabold font-mono tracking-wider text-emerald-400">
                {hoveredDay.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </span>
              <span className="text-[10px] text-slate-400 font-sans tracking-wide">
                {hoveredDay.date.getFullYear()}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-300">Total Attendance:</span>
              <span className="text-sm font-black text-emerald-300 font-display">{hoveredDay.total} present</span>
            </div>

            {hoveredDay.total > 0 && (
              <div className="grid grid-cols-3 gap-1 pt-1 text-center font-sans">
                <div className="bg-slate-850 p-1.5 rounded-lg border border-slate-800/80">
                  <span className="block text-[9px] text-slate-400 uppercase tracking-widest font-bold">Members</span>
                  <span className="text-xs font-black text-emerald-400 font-mono">{hoveredDay.members}</span>
                </div>
                <div className="bg-slate-850 p-1.5 rounded-lg border border-slate-800/80">
                  <span className="block text-[9px] text-slate-400 uppercase tracking-widest font-bold">Kids</span>
                  <span className="text-xs font-black text-amber-400 font-mono">{hoveredDay.children}</span>
                </div>
                <div className="bg-slate-850 p-1.5 rounded-lg border border-slate-800/80">
                  <span className="block text-[9px] text-slate-400 uppercase tracking-widest font-bold">Workers</span>
                  <span className="text-xs font-black text-indigo-400 font-mono">{hoveredDay.workers}</span>
                </div>
              </div>
            )}

            {hoveredDay.total > 0 && hoveredDay.records.length > 0 && (
              <div className="bg-slate-850/50 p-1.5 border border-slate-800 rounded-lg text-[10px] text-slate-400 italic">
                Programs: {Array.from(new Set(hoveredDay.records.map(r => r.eventType || "Sunday Experience"))).join(", ")}
              </div>
            )}

            <div className="text-[10px] text-slate-400 mt-1 border-t border-slate-800 pt-1">
              {getIntensityText(hoveredDay.total)}
            </div>
          </div>
        )}
      </div>

      {/* HEATMAP FOOTER: LEGEND & PEAK LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-100 dark:border-slate-850">
        {/* Heatmap intensity legend */}
        <div className="space-y-3.5">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-slate-400" />
            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Attendance Intensity Range</h5>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 mr-1.5">No Turnout</span>
            <div className="flex gap-1.5">
              <div className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200/20" title="0 turnout" />
              <div className="w-5 h-5 rounded bg-emerald-50 dark:bg-emerald-950/20 border border-slate-200/20" title="1-5 range" />
              <div className="w-5 h-5 rounded bg-emerald-250 dark:bg-emerald-900/40 border border-slate-250/20" title="6-20 range" />
              <div className="w-5 h-5 rounded bg-emerald-400 dark:bg-emerald-700/60 border border-slate-300/20" title="21-50 range" />
              <div className="w-5 h-5 rounded bg-emerald-600 dark:bg-emerald-500 border border-slate-400/20" title="50+ peak" />
            </div>
            <span className="text-slate-400 ml-1.5">Peak turnout</span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 pr-4">
            *Squares representing Sundays and events light up with higher intensity as more attendees are marked Present in your rosters datastore.
          </p>
        </div>

        {/* Peak attendance list (quicker identification of high-turnout events) */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <TrendingUp size={14} className="text-emerald-500" />
            <h5 className="text-[11px] font-bold uppercase tracking-wider">Top Peak Turnout Dates ({selectedYear})</h5>
          </div>

          {peakEvents.length === 0 ? (
            <div className="p-3 bg-slate-50 dark:bg-slate-950/40 text-slate-400 rounded-xl text-center text-xs italic font-sans border border-slate-100 dark:border-slate-850">
              No recorded attendance events for {selectedYear} yet. Click attendance tab or check-in to generate data!
            </div>
          ) : (
            <div className="space-y-2">
              {peakEvents.map((ev, idx) => (
                <div key={ev.date} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-850 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 bg-emerald-50 dark:bg-emerald-950/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold rounded-lg flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-extrabold text-slate-705 dark:text-slate-200">
                        {new Date(ev.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                      </span>
                      <span className="block text-[10px] text-slate-400 font-sans mt-0.5">
                        {ev.eventTypes.join(", ") || "Sunday Experience"}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <span className="font-black text-emerald-600 dark:text-emerald-400 pr-1">{ev.total} present</span>
                    <span className="block text-[9px] text-slate-400 mt-0.5 font-bold uppercase tracking-wider">
                      {ev.members}M • {ev.children}K • {ev.workers}W
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
