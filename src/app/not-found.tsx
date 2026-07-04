"use client";

import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-2xl border-2 border-slate-200 shadow-lg overflow-hidden">
        {/* Top accent bar */}
        <div className="h-2 bg-gradient-to-r from-[#E61C24] via-red-400 to-[#E61C24]" />

        <div className="p-8 flex flex-col items-center text-center gap-5">
          {/* Status code */}
          <div className="w-20 h-20 rounded-2xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center">
            <span className="text-3xl font-black text-slate-300 tracking-tight">404</span>
          </div>

          {/* Message */}
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              Page Not Found
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 w-full pt-2">
            <Link
              href="/"
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-[#E61C24] hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
            >
              <Home className="w-3.5 h-3.5" />
              Go Home
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-200"
            >
              <Search className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
