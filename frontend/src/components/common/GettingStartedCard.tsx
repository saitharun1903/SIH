"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, X, Sparkles, SlidersHorizontal, Database, AlertTriangle, Target } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";

interface Step {
  id: string;
  title: string;
  description: string;
  href: string;
  completed: boolean;
  actionText: string;
}

export const GettingStartedCard: React.FC = () => {
  const { currentWorkspace, terminology } = useWorkspace();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem(`nexus_guide_dismissed_${currentWorkspace?.id}`);
    if (isDismissed === "true") {
      setDismissed(true);
    }
  }, [currentWorkspace?.id]);

  const handleDismiss = () => {
    setDismissed(true);
    if (currentWorkspace) {
      localStorage.setItem(`nexus_guide_dismissed_${currentWorkspace.id}`, "true");
    }
  };

  if (dismissed) return null;

  const steps: Step[] = [
    {
      id: "workspace",
      title: `Define ${terminology.group} & Operational Baseline`,
      description: `Active domain: ${currentWorkspace?.name || "General Resources"} (${currentWorkspace?.workspace_type || "Standard"}).`,
      href: "/workspace",
      completed: true,
      actionText: "Manage Domain",
    },
    {
      id: "data",
      title: "Connect & Verify Operational Telemetry",
      description: "Ensure multi-source data ingestion, ASHRAE benchmark or sensor telemetry is loaded.",
      href: "/data-sources",
      completed: (currentWorkspace?.resource_count || 0) > 0,
      actionText: "Verify Data",
    },
    {
      id: "anomalies",
      title: "Audit Resource Anomalies & Waste",
      description: "Detect phantom power draw, off-hours idle capacity, and threshold violations.",
      href: "/anomalies",
      completed: true,
      actionText: "View Anomalies",
    },
    {
      id: "simulate",
      title: "Run CP-SAT What-If Simulation",
      description: "Simulate demand surges, maintenance shutdowns, or shift reallocations with zero impossible assignments.",
      href: "/simulator",
      completed: false,
      actionText: "Simulate Scenario",
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="bg-gradient-to-r from-[#092634] to-[#004E72] rounded-xl text-white p-5 shadow-sm relative overflow-hidden mb-6">
      {/* Background ambient pattern */}
      <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-start justify-between relative z-10 mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-white/10 text-[#FF6E42]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight">Resource Intelligence Deployment Guide</h3>
            <p className="text-xs text-white/70 mt-0.5">
              4-step lifecycle to optimize {terminology.resourcePlural.toLowerCase()} and decision automation
            </p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Dismiss Guide"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[11px] font-medium text-white/80 mb-1.5">
          <span>Deployment Progress</span>
          <span className="font-mono">{completedCount} of {steps.length} Complete ({progressPercent}%)</span>
        </div>
        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#FF6E42] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Step Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className={`p-3 rounded-lg border transition-all ${
              step.completed
                ? "bg-white/10 border-white/20 text-white"
                : "bg-white/5 border-white/10 hover:border-[#FF6E42]/60 text-white/90"
            }`}
          >
            <div className="flex items-center space-x-2 mb-1.5">
              {step.completed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <span className="h-4 w-4 rounded-full border border-white/40 flex items-center justify-center text-[10px] font-mono shrink-0">
                  {idx + 1}
                </span>
              )}
              <h4 className="font-semibold text-xs leading-tight truncate">{step.title}</h4>
            </div>
            <p className="text-[11px] text-white/70 leading-relaxed mb-3 line-clamp-2">
              {step.description}
            </p>
            <Link
              href={step.href}
              className={`inline-flex items-center space-x-1 text-[11px] font-semibold transition-colors ${
                step.completed ? "text-white/80 hover:text-white" : "text-[#FF6E42] hover:text-[#ff8661]"
              }`}
            >
              <span>{step.actionText}</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};
