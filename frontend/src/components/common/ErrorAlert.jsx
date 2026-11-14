import React from "react";
import {
  WifiOff,
  ServerCrash,
  ShieldAlert,
  Clock,
  AlertCircle,
  X,
} from "lucide-react";

export const ErrorAlert = ({ error, onDismiss }) => {
  if (!error) return null;

  const { type, title, message } = error;

  const renderIcon = () => {
    switch (type) {
      case "NETWORK_ERROR":
      case "TIMEOUT_ERROR":
        return <WifiOff className="text-amber-600 shrink-0 mt-0.5" size={18} />;
      case "SERVER_ERROR":
      case "SERVICE_UNAVAILABLE":
        return <ServerCrash className="text-rose-600 shrink-0 mt-0.5" size={18} />;
      case "AUTH_FAILED":
      case "FORBIDDEN":
        return <ShieldAlert className="text-rose-600 shrink-0 mt-0.5" size={18} />;
      case "RATE_LIMIT":
        return <Clock className="text-amber-600 shrink-0 mt-0.5" size={18} />;
      default:
        return <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={18} />;
    }
  };

  const isWarning = type === "NETWORK_ERROR" || type === "RATE_LIMIT" || type === "TIMEOUT_ERROR";

  const colorStyles = isWarning
    ? "bg-amber-50/90 border-amber-200 text-amber-950"
    : "bg-rose-50/90 border-rose-200 text-rose-950";

  const titleStyles = isWarning ? "text-amber-900" : "text-rose-900";
  const descStyles = isWarning ? "text-amber-800" : "text-rose-800";

  return (
    <div
      role="alert"
      className={`relative w-full rounded-xl border p-3.5 mb-4 text-[13px] flex items-start gap-2.5 transition-all duration-200 shadow-sm ${colorStyles}`}
    >
      {renderIcon()}

      <div className="flex-1 pr-4">
        {title && <p className={`font-semibold mb-0.5 ${titleStyles}`}>{title}</p>}
        <p className={`leading-relaxed text-[12.5px] ${descStyles}`}>{message}</p>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-2.5 right-2.5 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer p-1 rounded-md"
          aria-label="Dismiss alert"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default ErrorAlert;

