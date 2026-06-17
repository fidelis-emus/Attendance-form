import React, { useEffect, useRef, useState } from "react";
import { Download, Printer, QrCode, Calendar, Sparkles, Copy, ChevronLeft, ChevronRight } from "lucide-react";
import QRCode from "qrcode";
import { motion } from "motion/react";

interface QrProps {
  appUrl: string;
  sundaysList?: string[];
  onSundayAdded?: () => void;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Sub-component to manage rendering the Unified Monthly QR Code ticket card
interface MonthlyCardProps {
  year: number;
  monthIdx: number;
  appUrl: string;
  sundaysList: string[];
}

function MonthlyQrCard({ year, monthIdx, appUrl, sundaysList }: MonthlyCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const monthPadded = String(monthIdx + 1).padStart(2, "0");
  const monthLabel = MONTHS[monthIdx];
  const dateStr = `month-${year}-${monthPadded}`;
  const targetUrl = `${appUrl || window.location.origin}/?date=${dateStr}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    
    QRCode.toCanvas(
      canvasRef.current,
      targetUrl,
      {
        width: 170,
        margin: 2,
        color: {
          dark: "#0f172a", // slate-900
          light: "#ffffff",
        },
      },
      (err) => {
        if (err) {
          console.error("QR Code rendering failed:", err);
          setError("QR Error");
        } else {
          setError(null);
        }
      }
    );
  }, [targetUrl]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `church_qr_${monthLabel.toLowerCase()}_${year}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print ticket.");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const qrImageSrc = canvas.toDataURL("image/png");

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Church QR ticket - ${monthLabel} ${year}</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              text-align: center;
              padding: 40px;
              color: #333;
            }
            .ticket {
              border: 3px dashed #2563eb;
              padding: 30px;
              max-width: 380px;
              margin: 0 auto;
              border-radius: 20px;
              background-color: #fcfdfc;
            }
            h1 {
              font-size: 22px;
              margin-bottom: 5px;
              color: #111827;
            }
            .subtitle {
              font-size: 13px;
              color: #4b5563;
              margin-bottom: 20px;
            }
            img {
              max-width: 220px;
              margin-bottom: 20px;
              border: 1px solid #e5e7eb;
              border-radius: 12px;
            }
            .date-badge {
              display: inline-block;
              background-color: #eff6ff;
              color: #1d4ed8;
              padding: 6px 16px;
              font-weight: bold;
              border-radius: 20px;
              font-size: 15px;
              margin-bottom: 15px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .help {
              font-size: 11px;
              color: #6b7280;
              margin-top: 15px;
            }
            .sundays-list {
              font-size: 11.5px;
              color: #4b5563;
              margin: 15px 0;
              padding: 10px;
              background: #f3f4f6;
              border-radius: 8px;
              text-align: left;
            }
            .sundays-title {
              font-weight: bold;
              margin-bottom: 4px;
              text-transform: uppercase;
              color: #374151;
            }
          </style>
        </head>
        <body onload="window.print();window.close();">
          <div class="ticket">
            <h1>Church Attendance Ticket</h1>
            <div class="subtitle">Scan QR code to log Sunday service attendance</div>
            <div class="date-badge">${monthLabel} ${year}</div>
            <br/>
            <img src="${qrImageSrc}" alt="QR code" />
            <br/>
            <div class="sundays-list">
              <div class="sundays-title">Covered Sundays:</div>
              ${sundaysList.map(s => `• ${s}`).join("<br/>")}
            </div>
            <div class="help">Unified Monthly Code: Automatically registers current Sunday on scan. Please paste on doorways or display displays.</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-between select-none max-w-sm mx-auto w-full">
      <div className="text-center w-full">
        <span className="text-[10px] uppercase font-extrabold text-blue-600 dark:text-blue-400 tracking-widest block mb-1 bg-blue-50 dark:bg-blue-950/40 py-1 rounded-full px-3 max-w-max mx-auto">
          Unified Monthly Code
        </span>
        <h4 className="text-xl font-display font-bold text-slate-800 dark:text-slate-100 mt-2">
          {monthLabel} {year}
        </h4>
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1">
          Valid for all Sundays this month
        </p>
      </div>

      <div className="my-6 bg-slate-50 dark:bg-slate-950 p-4 rounded-3xl border border-slate-100 dark:border-slate-850 flex items-center justify-center shrink-0 shadow-inner">
        <canvas ref={canvasRef} style={{ width: "150px", height: "150px" }} />
      </div>

      <div className="w-full shrink-0">
        <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate bg-slate-50 dark:bg-slate-950 p-2 rounded-xl mb-4 text-center border border-slate-100 dark:border-slate-850">
          {targetUrl}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            type="button"
            onClick={handleDownload}
            className="py-2.5 px-3 bg-slate-800 hover:bg-slate-950 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download size={14} />
            <span>Save PNG</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Printer size={14} />
            <span>Print ticket</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopyLink}
          className={`w-full py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            copied
              ? "bg-emerald-50 border-emerald-300 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400"
              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-950 dark:border-slate-850 dark:text-slate-405 dark:hover:bg-slate-900"
          }`}
        >
          <Copy size={13} />
          <span>{copied ? "Link Copied!" : "Copy Scan URL"}</span>
        </button>
      </div>
    </div>
  );
}

export default function QrCodeGenerator({ appUrl }: QrProps) {
  const currentObj = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentObj.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentObj.getMonth()); // 0-indexed month
  const [sundaysInSelectedMonth, setSundaysInSelectedMonth] = useState<string[]>([]);

  // Function to calculate all Sundays of the chosen month
  useEffect(() => {
    const dates: string[] = [];
    const d = new Date(selectedYear, selectedMonth, 1);
    
    // Scan matching first Sunday of the month
    while (d.getDay() !== 0) {
      d.setDate(d.getDate() + 1);
    }
    
    // Cycle every 7 days adding Sundays until month ends
    while (d.getMonth() === selectedMonth && d.getFullYear() === selectedYear) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${day}`);
      d.setDate(d.getDate() + 7);
    }
    
    setSundaysInSelectedMonth(dates);
  }, [selectedYear, selectedMonth]);

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(v => v - 1);
    } else {
      setSelectedMonth(v => v - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(v => v + 1);
    } else {
      setSelectedMonth(v => v + 1);
    }
  };

  const formatSundayLabel = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6" id="qr-generator-section">
      {/* Monthly Interactive Selector Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/50 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1 px-2.5 bg-indigo-50 dark:bg-indigo-950/35 text-indigo-600 dark:text-indigo-400 font-bold rounded-full text-[10px] uppercase tracking-wider">
                🎯 ATTENDANCE REGISTRY
              </span>
              <span className="inline-flex gap-1.5 text-xs text-indigo-500 dark:text-indigo-400 font-bold items-center">
                <Sparkles size={11} className="animate-bounce" /> Smart-Unified
              </span>
            </div>
            <h3 className="text-xl font-display font-bold text-slate-800 dark:text-slate-100">
              Monthly Sunday Service QR Codes
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              We dynamically compile one single, unified monthly QR code that attends to all Sundays in the selected month automatically!
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrevMonth}
              type="button"
              className="p-2 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950 rounded-xl cursor-pointer transition-all"
            >
              <ChevronLeft size={18} />
            </button>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-4 py-2 text-sm font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-800 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-4 py-2 text-sm font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-800 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={selectedYear - 1}>{selectedYear - 1}</option>
              <option value={selectedYear}>{selectedYear}</option>
              <option value={selectedYear + 1}>{selectedYear + 1}</option>
            </select>

            <button
              onClick={handleNextMonth}
              type="button"
              className="p-2 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950 rounded-xl cursor-pointer transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Quick select pills */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          {MONTHS.map((m, idx) => (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedMonth(idx)}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedMonth === idx
                  ? "bg-blue-600 text-white"
                  : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-850/80 text-slate-600 dark:text-slate-400"
              }`}
            >
              {m.substring(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Bento Grid: Left Monthly Card, Right list of Sundays Covered */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-5 flex justify-center items-start">
          <MonthlyQrCard
            year={selectedYear}
            monthIdx={selectedMonth}
            appUrl={appUrl}
            sundaysList={sundaysInSelectedMonth.map(formatSundayLabel)}
          />
        </div>

        <div className="md:col-span-7 flex flex-col justify-between gap-6">
          {/* Card containingcovered roster info */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800 shadow-sm flex-grow">
            <h4 className="font-display font-bold text-slate-800 dark:text-slate-100 text-base mb-3.5 flex items-center gap-2">
              <Calendar size={17} className="text-blue-500" />
              Sundays Covered under this Monthly Code
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sundaysInSelectedMonth.map((date) => (
                <div
                  key={date}
                  className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-350">
                      {formatSundayLabel(date)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                      Roster: {date}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-bold rounded-lg text-[9px] uppercase tracking-wider">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Standard Setup Directions for Projectors */}
          <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-slate-850 shrink-0">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-2 flex items-center gap-2">
              <Sparkles size={15} className="text-blue-500" />
              How Unified Monthly Scan Works
            </h4>
            <ul className="list-disc list-inside space-y-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <li>
                You only need <strong className="text-blue-600 dark:text-blue-450 font-bold">one permanent QR sheet</strong> on the church door or wall for the entire month! No need to replace printed codes weekly.
              </li>
              <li>
                When attendees scan on Sunday June 7, the checkout form smart-detects the current date and automatically schedules their check-in for June 7.
              </li>
              <li>
                If scanned on Sunday June 14, it assigns June 14, and so forth, guaranteeing seamless Sunday registration with zero manual intervention.
              </li>
              <li>
                Download or Print the ticket using the actions on the card to distribute to door hosts or stream onto displays.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
