"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App Router Global Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col items-center justify-center p-4 text-center">
      <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mb-4 shadow-subtle">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-extrabold text-[#092634] mb-2 font-mono">500 — Application Error</h1>
      <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
        An unexpected runtime exception occurred while processing this institutional view. Telemetry has been captured.
      </p>
      <Button
        onClick={() => reset()}
        variant="primary"
        size="sm"
        className="inline-flex items-center space-x-2 bg-[#004E72] hover:bg-[#003d59] text-white font-bold shadow-sm"
      >
        <RefreshCw className="h-4 w-4" />
        <span>Retry View</span>
      </Button>
    </div>
  );
}
