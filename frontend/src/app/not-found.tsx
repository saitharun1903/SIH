"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col items-center justify-center p-4 text-center">
      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 mb-4 shadow-subtle">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-extrabold text-[#092634] mb-2 font-mono">404 — Page Not Found</h1>
      <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
        The requested institutional resource, report, or operational dataset could not be located in NEXUS.
      </p>
      <Link
        href="/dashboard"
        className="px-4 py-2 rounded-lg bg-[#004E72] hover:bg-[#003d59] text-white text-xs font-bold transition-colors inline-flex items-center space-x-2 shadow-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Return to Dashboard</span>
      </Link>
    </div>
  );
}
