import React, { useEffect, useRef, useState } from "react";
import { Download, Printer, QrCode, Sparkles, Copy, Calendar, RefreshCw } from "lucide-react";
import QRCode from "qrcode";
import { motion } from "motion/react";

interface QrProps {
  appUrl: string;
  sundaysList?: any[];
  onSundayAdded?: () => any;
}

export default function QrCodeGenerator({ appUrl }: QrProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // The permanent QR code points directly to the roots public attendance registry page.
  // The system's smart detection will automatically verify returning users or show registration form.
  const targetUrl = appUrl || window.location.origin;

  useEffect(() => {
    if (!canvasRef.current) return;
    
    QRCode.toCanvas(
      canvasRef.current,
      targetUrl,
      {
        width: 240,
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
    link.download = `permanent_church_attendance_qr.png`;
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
          <title>Print Permanent Church Attendance QR Code</title>
          <style>
            body {
              font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
              text-align: center;
              padding: 50px 20px;
              color: #0f172a;
              background-color: #f8fafc;
            }
            .ticket {
              border: 3px dashed #4f46e5;
              padding: 40px;
              max-width: 440px;
              margin: 0 auto;
              border-radius: 32px;
              background-color: #ffffff;
              box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
            }
            h1 {
              font-size: 26px;
              margin-bottom: 8px;
              color: #1e1b4b;
              font-weight: 800;
              letter-spacing: -0.025em;
            }
            .subtitle {
              font-size: 14px;
              color: #475569;
              margin-bottom: 25px;
              line-height: 1.5;
            }
            .badge {
              display: inline-block;
              background-color: #e0e7ff;
              color: #4f46e5;
              padding: 8px 18px;
              font-weight: bold;
              border-radius: 9999px;
              font-size: 13px;
              margin-bottom: 25px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            img {
              max-width: 250px;
              margin: 10px 0 25px 0;
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              padding: 10px;
              background: white;
            }
            .info {
              font-size: 13px;
              color: #334155;
              margin-top: 10px;
              text-align: left;
              background-color: #f1f5f9;
              padding: 15px;
              border-radius: 16px;
              line-height: 1.6;
            }
            .info-title {
              font-weight: bold;
              color: #1e1b4b;
              margin-bottom: 6px;
              font-size: 13px;
            }
          </style>
        </head>
        <body onload="window.print();window.close();">
          <div class="ticket">
            <h1>Sanctuary Attendance QR Code</h1>
            <div class="subtitle">Scan to record your service attendance instantly</div>
            <div class="badge">Permanent Code • Reusable Weekly</div>
            <br/>
            <img src="${qrImageSrc}" alt="Permanent Attendance QR Code" />
            <br/>
            <div class="info">
              <div class="info-title">How to check-in:</div>
              • <strong>First-Time:</strong> Scan and submit the short form once to register.<br/>
              • <strong>Returning scanned:</strong> Scan on any incoming Sunday for instant auto check-in. No form filling needed!
            </div>
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
    <div className="space-y-6" id="qr-generator-section">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/50 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="p-1 px-3 bg-indigo-50 dark:bg-indigo-950/35 text-indigo-600 dark:text-indigo-400 font-bold rounded-full text-[10px] uppercase tracking-wider">
            🎯 MAIN SANCTUARY QR
          </span>
          <span className="inline-flex gap-1 text-xs text-indigo-500 dark:text-indigo-455 font-bold items-center">
            <Sparkles size={11} className="animate-bounce" /> Permanent Code
          </span>
        </div>
        <h3 className="text-xl font-display font-bold text-slate-800 dark:text-slate-100">
          Permanent Attendance QR Portal
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
          Generate, download, or print one single static QR code. It remains permanent and reusable every Sunday and every month.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Side: Massive Unique QR Code Card */}
        <div className="md:col-span-6 lg:col-span-5 flex justify-center items-start">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-between select-none w-full max-w-sm">
            <div className="text-center w-full">
              <span className="text-[10px] uppercase font-extrabold text-blue-600 dark:text-blue-400 tracking-widest block mb-1 bg-blue-50 dark:bg-blue-950/40 py-1 rounded-full px-3 max-w-max mx-auto">
                Permanent QR Code Sheet
              </span>
              <h4 className="text-lg font-display font-bold text-slate-800 dark:text-slate-100 mt-2">
                Sanctuary Portal Code
              </h4>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1">
                Same Code Remains Valid Every Sunday
              </p>
            </div>

            <div className="my-6 bg-slate-50 dark:bg-slate-950 p-4 rounded-3xl border border-slate-100 dark:border-slate-850 flex items-center justify-center shrink-0 shadow-inner">
              <canvas ref={canvasRef} style={{ width: "200px", height: "200px" }} />
            </div>

            <div className="w-full shrink-0">
              <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl mb-4 text-center border border-slate-100 dark:border-slate-850">
                {targetUrl}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-955 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download size={14} />
                  <span>Save PNG</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer size={14} />
                  <span>Print Ticket</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className={`w-full py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  copied
                    ? "bg-emerald-50 border-emerald-300 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-950 dark:border-slate-850 dark:text-slate-400 dark:hover:bg-slate-900"
                }`}
              >
                <Copy size={13} />
                <span>{copied ? "Link Copied!" : "Copy Scan URL"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Educational Setup Cards */}
        <div className="md:col-span-6 lg:col-span-7 flex flex-col justify-between gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800 shadow-sm flex-grow">
            <h4 className="font-display font-bold text-slate-800 dark:text-slate-100 text-base mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-indigo-600" />
              Smart Attendance Architecture
            </h4>
            
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
                <h5 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
                  1. Zero Clutter Print Solution
                </h5>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  Print this single code and stick it permanently onto doors, tables, or bulletin boards. Users can scan the same physical print week after week without needing a new generation or paper sheets.
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
                <h5 className="font-bold text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
                  2. Smart One-Click Check-in
                </h5>
                <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed font-medium">
                  When returning attendees scan, their mobile phone recognizes their previous enrollment key. The system checks them in permanently for today's Sunday service with zero manual name typing.
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
                <h5 className="font-bold text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
                  3. Built-In Duplicate Control
                </h5>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  If an attendee accidently scans the code twice during the same Sunday service, the database blocks duplicate roster cards and displays a friendly notice preventing record bloat.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-150 dark:border-slate-850 shrink-0">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-2 flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-600 animate-pulse" />
              Deployment Guideline
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              Wipe out complex monthly print schedulers. Place one big sanctuary attendance display terminal at the foyer, stream this static QR code on screen slideshows, and let the church portal track all demographics seamlessly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
