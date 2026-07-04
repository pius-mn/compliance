"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
  title?: string;
}

export default function ErrorFallback({
  error,
  reset,
  title = "Something went wrong",
}: ErrorFallbackProps) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-2xl border-2 border-red-100 shadow-lg overflow-hidden">
        {/* Top accent bar */}
        <div className="h-2 bg-gradient-to-r from-[#E61C24] via-red-400 to-[#E61C24]" />

        <div className="p-8 flex flex-col items-center text-center gap-5">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-red-50 border-2 border-red-100 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-[#E61C24]" />
          </div>

          {/* Title */}
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              {title}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
              An unexpected error occurred. Our team has been notified.
            </p>
          </div>

          {/* Error details (collapsible) */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
          >
            {expanded ? "Hide details" : "Show error details"}
          </button>

          {expanded && (
            <pre className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 font-mono text-left overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap break-all">
              {error.message || "Unknown error"}
              {"\n\n"}
              {error.stack?.split("\n").slice(0, 5).join("\n")}
            </pre>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 w-full pt-2">
            <button
              onClick={reset}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-[#E61C24] hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
            <Link
              href="/"
              className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-200"
            >
              <Home className="w-3.5 h-3.5" />
              Go Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
