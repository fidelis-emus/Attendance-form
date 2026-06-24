import React from "react";
import { AlertTriangle, Info } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "warning",
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const colorMap = {
    danger: {
      bg: "bg-red-50 dark:bg-red-950/20",
      icon: "text-red-600 dark:text-red-400",
      btn: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    },
    warning: {
      bg: "bg-amber-50 dark:bg-amber-950/20",
      icon: "text-amber-600 dark:text-amber-400",
      btn: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
    },
    info: {
      bg: "bg-blue-50 dark:bg-blue-950/20",
      icon: "text-indigo-600 dark:text-indigo-400",
      btn: "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500",
    },
  };

  const colors = colorMap[type] || colorMap.warning;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onCancel}
      />
      
      {/* Modal wrapper */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-slate-200/50 dark:border-slate-800">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className={`mx-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors.bg}`}>
                {type === "danger" || type === "warning" ? (
                  <AlertTriangle className={`h-5 w-5 ${colors.icon}`} />
                ) : (
                  <Info className={`h-5 w-5 ${colors.icon}`} />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-display">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-line">
                  {message}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-950/40 px-6 py-4 flex flex-row-reverse gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onConfirm}
              className={`inline-flex w-full justify-center rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto cursor-pointer ${colors.btn}`}
            >
              {confirmText}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex w-full justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-750 transition-all focus:outline-none sm:w-auto cursor-pointer"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
