import React, { useEffect, useRef, useState } from "react";
import { Download, Printer, QrCode, Calendar, Plus, Sparkles } from "lucide-react";
import QRCode from "qrcode";
import { motion } from "motion/react";

interface QrProps {
  appUrl: string;
  sundaysList?: string[];
  onSundayAdded?: () => void;
}

export default function QrCodeGenerator({ appUrl, sundaysList = [], onSundayAdded }: QrProps) {
  const [sundays, setSundays] = useState<string[]>([]);
  const [selectedSunday, setSelectedSunday] = useState("");
  const [newSunday, setNewSunday] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingAdd, setLoadingAdd] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (sundaysList && sundaysList.length > 0) {
      setSundays(sundaysList);
      // If selectedSunday is empty or not in lists, default to first item which is newest Sunday
      if (!selectedSunday || !sundaysList.includes(selectedSunday)) {
        setSelectedSunday(sundaysList[0]);
      }
    } else {
      const baseSundays = [
        "2026-06-07",
        "2026-06-14",
        "2026-06-21",
        "2026-06-28",
      ];
      setSundays(baseSundays);
      if (!selectedSunday) {
        setSelectedSunday("2026-06-14");
      }
    }
  }, [sundaysList]);

  // Auto-resolve dynamic scanner url
  const targetUrl = `${appUrl || window.location.origin}/?date=${selectedSunday}`;

  useEffect(() => {
    if (!canvasRef.current || !selectedSunday) return;
    
    QRCode.toCanvas(
      canvasRef.current,
      targetUrl,
      {
        width: 256,
        margin: 2,
        color: {
          dark: "#0f172a", // slate-900
          light: "#ffffff",
        },
      },
      (err) => {
        if (err) {
          console.error("QR Code rendering failed:", err);
          setError("Failed to render QR Code.");
        } else {
          setError(null);
        }
      }
    );
  }, [targetUrl, selectedSunday]);

  const handleAddSunday = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newSunday) return;

    // Check if valid date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newSunday)) {
      setError("Please write the date strictly in YYYY-MM-DD format (e.g., 2026-07-05).");
      return;
    }

    setLoadingAdd(true);
    try {
      const response = await fetch("/api/sundays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newSunday }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData?.error || "Failed to define custom service Sunday date.");
      }

      setNewSunday("");
      if (onSundayAdded) {
        onSundayAdded();
      } else {
        if (!sundays.includes(newSunday)) {
          const updated = [...sundays, newSunday].sort((a, b) => b.localeCompare(a));
          setSundays(updated);
        }
        setSelectedSunday(newSunday);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to define custom Sunday date.");
    } finally {
      setLoadingAdd(false);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `church_qr_${selectedSunday}.png`;
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
          <title>Print Church QR ticket - ${selectedSunday}</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              text-align: center;
              padding: 50px;
              color: #333;
            }
            .ticket {
              border: 3px dashed #0969da;
              padding: 40px;
              max-width: 400px;
              margin: 0 auto;
              border-radius: 20px;
              background-color: #fcfdfc;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 5px;
              color: #111827;
            }
            .subtitle {
              font-size: 14px;
              color: #4b5563;
              margin-bottom: 25px;
            }
            img {
              max-width: 250px;
              margin-bottom: 25px;
              border: 1px solid #e5e7eb;
              border-radius: 10px;
            }
            .date-badge {
              display: inline-block;
              background-color: #ebf5ff;
              color: #0969da;
              padding: 6px 16px;
              font-weight: bold;
              border-radius: 30px;
              font-size: 15px;
              margin-bottom: 20px;
            }
            .help {
              font-size: 12px;
              color: #6b7280;
            }
          </style>
        </head>
        <body onload="window.print();window.close();">
          <div class="ticket">
            <h1>Church Service Attendance</h1>
            <div class="subtitle">Scan the QR code to submit attendance</div>
            <div class="date-badge">Sunday Service: ${selectedSunday}</div>
            <br/>
            <img src="${qrImageSrc}" alt="QR code" />
            <br/>
            <div class="help">Place this ticket at the church door or on visual projectors.</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const formatDisplayDate = (dStr: string) => {
    try {
      const parts = dStr.split("-");
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dStr;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="qr-generator-section">
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm relative">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 rounded-s-2xl" />
          <h3 className="text-lg font-display font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-blue-500" />
            Select Sunday Service Date
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {sundays.map((sun) => (
              <button
                key={sun}
                type="button"
                onClick={() => setSelectedSunday(sun)}
                className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold tracking-tight text-center border transition-all ${
                  selectedSunday === sun
                    ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/15"
                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                }`}
              >
                {formatDisplayDate(sun)}
                <span className="block text-[9px] opacity-75 font-normal mt-0.5">{sun}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleAddSunday} className="border-t border-slate-100 dark:border-slate-800 pt-5">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Add New Sunday Service Date
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="2026-07-05 (YYYY-MM-DD)"
                value={newSunday}
                onChange={(e) => setNewSunday(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500 text-slate-800 dark:text-slate-100 font-mono text-sm"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-sm tracking-tight flex items-center gap-1 cursor-pointer"
              >
                <Plus size={16} /> Add Sunday
              </button>
            </div>
            {error && (
              <p className="text-rose-500 text-xs font-bold mt-2">⚠️ {error}</p>
            )}
          </form>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-850">
          <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm mb-2.5 uppercase tracking-wider">
            Sunday QR Attendance Instructions
          </h4>
          <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 inline-block font-medium">
            <li>Choose the target Sunday service date.</li>
            <li>Display the generated black-and-white QR code ticket either on projectors in church, or print them onto dashboard tickets.</li>
            <li>Instruct church members and workers to scan the barcode using their smartphones.</li>
            <li>It opens their mobile register instantly! No paper rosters or physical rosters are needed.</li>
          </ol>
        </div>
      </div>

      <div className="lg:col-span-5 flex justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center rounded-2xl shadow-lg p-6 sm:p-8 w-full max-w-sm flex flex-col justify-between"
        >
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold uppercase tracking-wider rounded-full mb-4">
              <Sparkles size={11} /> Live Ticket
            </div>
            <h4 className="text-base font-display font-bold text-slate-800 dark:text-slate-100 mb-1">
              {formatDisplayDate(selectedSunday)}
            </h4>
            <p className="text-[11px] font-mono text-slate-400 mb-5">
              Service Date: {selectedSunday}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 p-4 rounded-xl inline-block mx-auto mb-6">
            <canvas ref={canvasRef} className="rounded" />
          </div>

          <div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono break-all mb-5 px-2 select-all hover:text-blue-500 cursor-copy bg-slate-50 dark:bg-slate-950 py-1.5 rounded border border-slate-100 dark:border-slate-850">
              {targetUrl}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleDownload}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-900 dark:bg-slate-820 dark:hover:bg-slate-750 text-white rounded-xl text-xs font-bold tracking-wide flex items-center justify-center gap-1 cursor-pointer"
              >
                <Download size={14} /> Download PNG
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold tracking-wide flex items-center justify-center gap-1 cursor-pointer shadow shadow-blue-500/10"
              >
                <Printer size={14} /> Print Ticket
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
