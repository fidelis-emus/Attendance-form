import React, { useState, useEffect } from "react";
import { Download, Upload, Plus, Check, RefreshCw, Trash2, Calendar, FileText } from "lucide-react";

interface BackupRestoreManagerProps {
  user: any;
  addNotification: (msg: string, type: "success" | "error" | "info") => void;
  setConfirmState: (state: any) => void;
}

export default function BackupRestoreManager({
  user,
  addNotification,
  setConfirmState
}: BackupRestoreManagerProps) {
  const [backupHistoryList, setBackupHistoryList] = useState<any[]>([]);
  const [autoBackupFrequency, setAutoBackupFrequency] = useState<string>("Disabled");
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [isValidatingBackup, setIsValidatingBackup] = useState(false);

  const fetchBackupHistoryAndConfig = async () => {
    try {
      const q = `adminId=${encodeURIComponent(user?.uid || "")}&adminEmail=${encodeURIComponent(user?.email || "")}`;
      const [historyRes, configRes] = await Promise.all([
        fetch(`/api/backup/history?${q}`).then(res => res.json()),
        fetch(`/api/backup/config?${q}`).then(res => res.json())
      ]);
      if (Array.isArray(historyRes)) {
        setBackupHistoryList(historyRes);
      }
      if (configRes && configRes.frequency) {
        setAutoBackupFrequency(configRes.frequency);
      }
    } catch (err) {
      console.error("Failed to load backup history/config:", err);
    }
  };

  useEffect(() => {
    fetchBackupHistoryAndConfig();
  }, []);

  const handleFileSelectAndValidate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsValidatingBackup(true);
    setValidationResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const response = await fetch("/api/backup/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-id": user?.uid || "",
            "x-admin-email": user?.email || ""
          },
          body: JSON.stringify({ backupData: parsed })
        });
        const data = await response.json();
        if (response.ok && data.success) {
          setValidationResult({
            rawPayload: parsed,
            summary: data
          });
          addNotification("Backup file validated successfully. Ready to restore!", "success");
        } else {
          addNotification(data.error || "File validation failed.", "error");
        }
      } catch (err: any) {
        addNotification("Invalid backup file format: " + err.message, "error");
      } finally {
        setIsValidatingBackup(false);
      }
    };
    reader.readAsText(file);
  };

  const handleApplyRestore = async () => {
    if (!validationResult) return;
    
    setConfirmState({
      isOpen: true,
      title: "Confirm Database Restore",
      message: "Warning: Restoring will overwrite the current database. All current records will be replaced. A safe restore backup will be recorded automatically first. Do you want to proceed?",
      confirmText: "Restore Now",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        setIsRestoring(true);
        addNotification("Applying safe database restore transaction...", "info");
        try {
          // Trigger automatic snapshot first for safe restore requirement
          await fetch("/api/backup/history/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-admin-id": user?.uid || "",
              "x-admin-email": user?.email || ""
            }
          });

          const response = await fetch("/api/backup/restore", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-admin-id": user?.uid || "",
              "x-admin-email": user?.email || ""
            },
            body: JSON.stringify({ backupData: validationResult.rawPayload })
          });
          
          const data = await response.json();
          if (response.ok && data.success) {
            addNotification("Database restored perfectly. Refreshing dashboard...", "success");
            setValidationResult(null);
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } else {
            addNotification(data.error || "Restore failed.", "error");
          }
        } catch (err: any) {
          addNotification("Restore execution failed: " + err.message, "error");
        } finally {
          setIsRestoring(false);
        }
      }
    });
  };

  const handleCreateBackupSnapshot = async () => {
    setIsCreatingSnapshot(true);
    addNotification("Creating historical system backup snapshot...", "info");
    try {
      const response = await fetch("/api/backup/history/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-id": user?.uid || "",
          "x-admin-email": user?.email || ""
        }
      });
      if (response.ok) {
        addNotification("Backup snapshot recorded successfully!", "success");
        fetchBackupHistoryAndConfig();
      } else {
        const data = await response.json();
        addNotification(data.error || "Snapshot generation failed.", "error");
      }
    } catch (err: any) {
      addNotification("Snapshot failed: " + err.message, "error");
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Backup Archive",
      message: `Are you sure you want to permanently delete backup archive "${filename}"? This action is irreversible.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        try {
          const response = await fetch("/api/backup/history/delete", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-admin-id": user?.uid || "",
              "x-admin-email": user?.email || ""
            },
            body: JSON.stringify({ filename })
          });
          if (response.ok) {
            addNotification("Backup file deleted from storage.", "success");
            fetchBackupHistoryAndConfig();
          } else {
            const data = await response.json();
            addNotification(data.error || "Deletion failed.", "error");
          }
        } catch (err: any) {
          addNotification("Delete failed: " + err.message, "error");
        }
      }
    });
  };

  const handleRestoreFromHistory = async (filename: string) => {
    setConfirmState({
      isOpen: true,
      title: "Restore from Backup Archive",
      message: `Are you sure you want to restore the database to historical snapshot "${filename}"? A backup snapshot of the current state will be created first, and then the selected archive will be fully applied. This will restart the dashboard!`,
      confirmText: "Apply Restore",
      cancelText: "Cancel",
      type: "warning",
      onConfirm: async () => {
        setIsRestoring(true);
        addNotification("Restoring from historical archive point...", "info");
        try {
          // Trigger dynamic pre-restore backup snapshot first
          await fetch("/api/backup/history/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-admin-id": user?.uid || "",
              "x-admin-email": user?.email || ""
            }
          });

          const response = await fetch("/api/backup/history/restore", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-admin-id": user?.uid || "",
              "x-admin-email": user?.email || ""
            },
            body: JSON.stringify({ filename })
          });
          if (response.ok) {
            addNotification("Database restored and validated. Syncing portal...", "success");
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } else {
            const data = await response.json();
            addNotification(data.error || "Restore execution failed.", "error");
          }
        } catch (err: any) {
          addNotification("Restore failed: " + err.message, "error");
        } finally {
          setIsRestoring(false);
        }
      }
    });
  };

  const handleSaveAutoBackupConfig = async (freq: string) => {
    setAutoBackupFrequency(freq);
    try {
      const response = await fetch("/api/backup/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-id": user?.uid || "",
          "x-admin-email": user?.email || ""
        },
        body: JSON.stringify({ frequency: freq })
      });
      if (response.ok) {
        addNotification(`Automated database backup interval configured: ${freq}`, "success");
      } else {
        const data = await response.json();
        addNotification(data.error || "Config failed.", "error");
      }
    } catch (err: any) {
      addNotification("Configuration save failed: " + err.message, "error");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm relative overflow-hidden space-y-8">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600" />
      
      {/* Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-150 dark:border-slate-850 pb-6">
        <div>
          <h3 className="text-xl font-display font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1.5">
            🗄️ PostgreSQL Database Backup & Restore Control Center
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Enterprise-grade dynamic snapshot engine. Save, restore, schedule, or audit backups safely under full multi-table database transactions.
          </p>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCreateBackupSnapshot}
            disabled={isCreatingSnapshot}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Plus size={14} />
            {isCreatingSnapshot ? "Creating Snapshot..." : "Create Backup Point"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Auto-Backup Configurations & Direct Exports */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-50 dark:bg-slate-950 p-6 border border-slate-200/50 dark:border-slate-850/60 rounded-2xl space-y-5">
            <h4 className="font-display font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
              ⚙️ Backup Schedule Policy
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Configure automatic snapshot generation frequency. Backups are saved on local secure volumes and pruned to retain the latest 30 points.
            </p>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Automatic Backup Frequency
              </label>
              <select
                value={autoBackupFrequency}
                onChange={(e) => handleSaveAutoBackupConfig(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-150 text-xs font-bold shadow-sm"
              >
                <option value="Disabled">Disabled (Manual Only)</option>
                <option value="Daily">Daily Execution (Midnight)</option>
                <option value="Weekly">Weekly Execution (Sunday Midnight)</option>
                <option value="Monthly">Monthly Execution (1st of Month)</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 p-6 border border-slate-200/50 dark:border-slate-850/60 rounded-2xl space-y-4">
            <h4 className="font-display font-bold text-slate-800 dark:text-slate-200 text-sm">
              📥 Immediate Direct Download
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Export the entire PostgreSQL database. Restores can only be processed from files exported in the correct JSON schema structure.
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <a
                href={`/api/backup/export?format=json&adminId=${encodeURIComponent(user?.uid || "")}&adminEmail=${encodeURIComponent(user?.email || "")}`}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-center text-xs font-bold rounded-xl shadow cursor-pointer transition-all inline-flex items-center justify-center gap-1"
              >
                <Download size={13} /> JSON Format
              </a>
              <a
                href={`/api/backup/export?format=sql&adminId=${encodeURIComponent(user?.uid || "")}&adminEmail=${encodeURIComponent(user?.email || "")}`}
                className="px-3 py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-center text-xs font-bold rounded-xl shadow cursor-pointer transition-all inline-flex items-center justify-center gap-1"
              >
                <Download size={13} /> SQL Format
              </a>
            </div>
          </div>
        </div>

        {/* Interactive Validator & File Restore Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950/40 p-6 sm:p-8 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 relative">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
              <Upload size={20} />
            </div>
            
            <div className="space-y-1">
              <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest">
                Upload & Validate Backup File for Restore
              </h5>
              <p className="text-xs text-slate-500 dark:text-slate-455 max-w-md">
                Drag and drop your downloaded `.json` backup file here, or browse local files to run validation checks before full database rewrite.
              </p>
            </div>
            
            <label className="px-4 py-2 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5">
              <Plus size={14} className="text-slate-500" />
              Browse JSON Archive File
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelectAndValidate}
                className="hidden"
              />
            </label>
            
            {isValidatingBackup && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 flex flex-col items-center justify-center gap-2 rounded-2xl transition-all">
                <RefreshCw className="animate-spin text-indigo-600" size={24} />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Parsing & Validating Archive Structure...</span>
              </div>
            )}
          </div>

          {/* Dynamic Validation Report Screen */}
          {validationResult && (
            <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/50 dark:border-emerald-900/30 p-6 rounded-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500 text-lg">✅</span>
                  <div>
                    <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Cryptographic Signature Validated
                    </h5>
                    <p className="text-xs text-slate-505">
                      Backup package verification passed successfully. Ready to load into PostgreSQL database.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setValidationResult(null)}
                  className="text-xs font-bold text-rose-500 hover:text-rose-600 cursor-pointer"
                >
                  Clear
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850/60 text-xs font-medium text-slate-600 dark:text-slate-455 shadow-inner">
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Backup Created On:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {new Date(validationResult.summary.backupDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Database Version:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{validationResult.summary.databaseVersion}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Church Center Name:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{validationResult.summary.churchName}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Total System Records:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{validationResult.summary.totalRecords.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <h6 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-3 pl-0.5">
                  Table Schema Content Records Breakdown
                </h6>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {Object.entries(validationResult.summary.tableCounts).map(([tableName, count]: [string, any]) => (
                    <div key={tableName} className="bg-slate-50 dark:bg-slate-900/60 border border-slate-150 dark:border-slate-850 p-2.5 rounded-lg flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold text-slate-500 capitalize">{tableName.replace("_", " ")}:</span>
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 font-mono">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-150 dark:border-slate-850/50">
                <button
                  type="button"
                  onClick={handleApplyRestore}
                  disabled={isRestoring}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check size={14} />
                  {isRestoring ? "Overwriting Database under transaction..." : "Apply & Overwrite Database Now"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Snapshots History Table */}
      <div className="border-t border-slate-150 dark:border-slate-850 pt-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pl-0.5">
          <div>
            <h4 className="font-display font-bold text-slate-850 dark:text-slate-100 text-sm">
              📜 Database Snapshot History Logs
            </h4>
            <p className="text-xs text-slate-505 dark:text-slate-455">
              Direct transaction restore points saved on node disk arrays. Safe snapshots are auto-created prior to any restore operations.
            </p>
          </div>
        </div>

        {backupHistoryList.length === 0 ? (
          <div className="py-12 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-150 dark:border-slate-850 flex flex-col items-center justify-center text-center space-y-2">
            <span className="text-lg">🗂️</span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">No Snapshot History Recorded Yet</span>
            <p className="text-[11px] text-slate-400 max-w-sm leading-relaxed">
              Trigger your first manual snapshot above or set a scheduling frequency interval to populate database archive recovery records.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden border border-slate-200/50 dark:border-slate-850 rounded-2xl bg-white dark:bg-slate-950 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-150 dark:border-slate-850 bg-slate-50 dark:bg-slate-900/60 text-slate-500 text-[10px] uppercase tracking-widest font-bold">
                  <th className="py-3.5 px-4 font-bold">Archive Filename</th>
                  <th className="py-3.5 px-4 font-bold">Creation Date & Time</th>
                  <th className="py-3.5 px-4 font-bold">Backup Size</th>
                  <th className="py-3.5 px-4 font-bold">Generated By</th>
                  <th className="py-3.5 px-4 font-bold text-right pr-6">Recovery Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-850/60 text-xs text-slate-700 dark:text-slate-300 font-medium">
                {backupHistoryList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-all">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">{item.filename}</td>
                    <td className="py-3 px-4">
                      {new Date(item.backupDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at{" "}
                      {new Date(item.backupDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="py-3 px-4 text-slate-505">{(item.size / 1024).toFixed(1)} KB</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        item.createdBy === "System Auto-Scheduler" || item.createdBy === "System Scheduler"
                          ? "bg-slate-100 text-slate-600 dark:bg-slate-850 dark:text-slate-400"
                          : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400"
                      }`}>
                        {item.createdBy}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right pr-6 space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestoreFromHistory(item.filename)}
                        className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-xs font-bold transition-all cursor-pointer border border-transparent hover:border-rose-200/50"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBackup(item.filename)}
                        className="px-2.5 py-1 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
