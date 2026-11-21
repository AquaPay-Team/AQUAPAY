import React from "react";
import { Loader2 } from "lucide-react";

export function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] w-full">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-xs font-medium text-slate-400 tracking-wide uppercase">
          Loading...
        </span>
      </div>
    </div>
  );
}

export default RouteLoadingFallback;