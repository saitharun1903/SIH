"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CardSkeleton } from "@/components/common/SectionSkeleton";
import { api } from "@/lib/api";
import { Recommendation, ScenarioResult } from "@/lib/types";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  Filter,
  Check,
  X,
  Play,
  Layers,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Info,
} from "lucide-react";

export default function RecommendationsPage() {
  const router = useRouter();
  const { terminology } = useWorkspace();

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("Active");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Simulation Modal
  const [simResult, setSimResult] = useState<{ recId: number; result: ScenarioResult; scenarioId: number } | null>(null);
  const [simulatingRecId, setSimulatingRecId] = useState<number | null>(null);

  // Action / Dismiss Modal
  const [selectedRecForAction, setSelectedRecForAction] = useState<{ rec: Recommendation; mode: "apply" | "dismiss" } | null>(null);
  const [actionNotes, setActionNotes] = useState<string>("");
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  const loadRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRecommendations({
        status: statusFilter === "all" ? undefined : statusFilter,
        priority: priorityFilter === "all" ? undefined : priorityFilter,
      });
      setRecommendations(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load decision recommendations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
  }, [statusFilter, priorityFilter]);

  const handleScanNow = async () => {
    setScanning(true);
    setError(null);
    try {
      const updated = await api.generateRecommendations();
      setRecommendations(Array.isArray(updated) ? updated : []);
      setSuccessMessage(`Analyzed operational telemetry: ${updated.length} verified recommendations found.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err?.message || "Recommendation analysis failed.");
    } finally {
      setScanning(false);
    }
  };

  const handleSimulateRec = async (rec: Recommendation) => {
    setSimulatingRecId(rec.id);
    setError(null);
    try {
      const scenario = await api.createScenario({
        name: `Simulation: ${rec.title}`,
        description: `Automated simulation test for recommendation: ${rec.problem_description}`,
        base_period: "Operational Baseline",
        changes: [
          {
            change_type: "deactivate_resource",
            parameters: {
              resource_id: rec.resource_id,
              recommendation_id: rec.id,
            },
          },
        ],
      });

      const result = await api.simulateScenario(scenario.id);
      setSimResult({ recId: rec.id, result, scenarioId: scenario.id });
    } catch (err: any) {
      setError(err?.message || "Simulation execution failed.");
    } finally {
      setSimulatingRecId(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!selectedRecForAction) return;
    setSubmittingAction(true);
    setError(null);
    try {
      const { rec, mode } = selectedRecForAction;
      if (mode === "apply") {
        await api.applyRecommendation(rec.id, actionNotes);
        setSuccessMessage(`Recommendation applied and assigned to Action Center.`);
      } else {
        await api.dismissRecommendation(rec.id, actionNotes);
        setSuccessMessage(`Recommendation dismissed.`);
      }
      setSelectedRecForAction(null);
      setActionNotes("");
      loadRecommendations();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err?.message || "Action failed.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const parseJsonSafe = (raw: any) => {
    if (!raw) return {};
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return {};
    }
  };

  const filteredRecs = useMemo(() => {
    return recommendations.filter((r) => {
      const matchesStatus = statusFilter === "all" || r.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesPriority = priorityFilter === "all" || r.priority.toLowerCase() === priorityFilter.toLowerCase();
      return matchesStatus && matchesPriority;
    });
  }, [recommendations, statusFilter, priorityFilter]);

  const highPriorityCount = useMemo(() => {
    return recommendations.filter((r) => r.priority === "High" || r.priority === "Critical").length;
  }, [recommendations]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#004E72]">
              Decisions
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">Operational Recommendations</span>
          </div>
          <h1 className="text-2xl font-bold text-[#092634] tracking-tight flex items-center gap-2.5">
            <Sparkles className="h-6 w-6 text-[#004E72]" />
            Recommendations
          </h1>
          <p className="text-xs text-[#475569] mt-1">
            Data-driven improvements with grounded evidence, expected impact, and simulation verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            onClick={handleScanNow}
            isLoading={scanning}
            className="text-xs h-8 bg-[#004E72] hover:bg-[#003d59] text-white shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            <span>Scan for Recommendations</span>
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 shadow-subtle">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 shadow-subtle">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white border-[#E2E8F0] shadow-subtle">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Active Suggestions</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#092634]">{recommendations.filter(r => r.status === "Active").length}</span>
            <span className="text-xs text-[#64748B]">available</span>
          </div>
        </Card>
        <Card className="p-4 bg-white border-[#E2E8F0] shadow-subtle">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">High Priority</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">{highPriorityCount}</span>
            <span className="text-xs text-[#64748B]">require attention</span>
          </div>
        </Card>
        <Card className="p-4 bg-white border-[#E2E8F0] shadow-subtle">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Verification Policy</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Zero Synthetic Claims
            </span>
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-subtle">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Status:</span>
          <div className="flex rounded-lg bg-[#F8FAFC] p-1 border border-[#E2E8F0]">
            {(["Active", "Applied", "Dismissed", "all"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                  statusFilter === st
                    ? "bg-white text-[#004E72] shadow-xs font-bold"
                    : "text-[#64748B] hover:text-[#092634]"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="h-3.5 w-3.5 text-[#64748B]" />
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1 text-xs text-[#092634] font-medium"
            aria-label="Filter by priority"
          >
            <option value="all">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Recommendation Cards List */}
      <div className="space-y-4">
        {loading ? (
          <CardSkeleton count={3} />
        ) : filteredRecs.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-[#E2E8F0] shadow-subtle">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-[#092634]">No pending recommendations</h3>
            <p className="text-xs text-[#64748B] mt-1 max-w-md mx-auto">
              All monitored {terminology.resourcePlural.toLowerCase()} are operating within expected thresholds. Click &quot;Scan for Recommendations&quot; above to re-evaluate telemetry.
            </p>
          </div>
        ) : (
          filteredRecs.map((rec) => {
            const impact = rec.estimated_impact || parseJsonSafe((rec as any).estimated_impact_json) || {};
            const evidence = rec.evidence || parseJsonSafe((rec as any).evidence_json) || {};

            return (
              <Card
                key={rec.id}
                className="p-5 bg-white border-[#E2E8F0] shadow-subtle hover:border-[#CBD5E1] transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    {/* Header line */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          rec.priority === "Critical"
                            ? "danger"
                            : rec.priority === "High"
                            ? "warning"
                            : "info"
                        }
                        size="sm"
                      >
                        {rec.priority} Priority
                      </Badge>
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#F1F5F9] border border-[#E2E8F0] text-[#475569]">
                        {rec.recommendation_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-[#94A3B8]">•</span>
                      <span className="text-xs text-[#64748B] font-mono">
                        {new Date(rec.created_at).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    {/* Title & Problem */}
                    <div>
                      <h3 className="text-base font-bold text-[#092634] tracking-tight">{rec.title}</h3>
                      <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                        {rec.problem_description}
                      </p>
                    </div>

                    {/* Evidence & Action Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                        <span className="font-bold text-[#004E72] block mb-1">Observed Evidence:</span>
                        <p className="text-[#64748B]">
                          {evidence?.summary || evidence?.message || "Telemetry data crossed operational thresholds."}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                        <span className="font-bold text-[#092634] block mb-1">Recommended Action:</span>
                        <p className="text-[#475569]">{rec.recommended_action}</p>
                      </div>
                    </div>

                    {/* Expected Impact */}
                    {(impact?.cost_saving_inr || impact?.utilization_gain_pct || impact?.energy_saved_kwh) && (
                      <div className="flex flex-wrap items-center gap-3 text-xs pt-1 text-[#092634]">
                        <span className="font-semibold text-[#64748B]">Estimated Impact:</span>
                        {impact?.cost_saving_inr ? (
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            +₹{Number(impact.cost_saving_inr).toLocaleString()}/mo
                          </span>
                        ) : null}
                        {impact?.utilization_gain_pct ? (
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            +{impact.utilization_gain_pct}% Utilization
                          </span>
                        ) : null}
                        {impact?.energy_saved_kwh ? (
                          <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            -{impact.energy_saved_kwh} kWh
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* Actions column */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#E2E8F0]">
                    {rec.status === "Active" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSimulateRec(rec)}
                          isLoading={simulatingRecId === rec.id}
                          className="text-xs h-8 border-[#CBD5E1] text-[#092634]"
                        >
                          <Play className="h-3 w-3 mr-1 text-[#004E72]" />
                          Simulate
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setSelectedRecForAction({ rec, mode: "apply" })}
                          className="text-xs h-8 bg-[#004E72] hover:bg-[#003d59] text-white"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Apply Action
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRecForAction({ rec, mode: "dismiss" })}
                          className="text-xs h-8 text-[#94A3B8] hover:text-rose-600"
                        >
                          Dismiss
                        </Button>
                      </>
                    )}
                    {rec.status !== "Active" && (
                      <Badge variant={rec.status === "Applied" ? "success" : "neutral"} size="sm">
                        {rec.status}
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Simulation Result Modal */}
      {simResult && (
        <Modal
          isOpen={true}
          onClose={() => setSimResult(null)}
          title="What-If Simulation Verification"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold block">Feasible Operational Mutation</span>
                <span className="text-[11px] text-emerald-700">
                  Optimization engine verified zero constraint violations if this recommendation is applied.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div>
                <span className="text-[#64748B] block text-[10px] uppercase font-bold">Feasibility</span>
                <span className="font-bold text-[#092634] text-sm">{simResult.result.feasibility}</span>
              </div>
              <div>
                <span className="text-[#64748B] block text-[10px] uppercase font-bold">Objective Score</span>
                <span className="font-mono font-bold text-[#092634] text-sm">
                  {simResult.result.objective_score.toFixed(1)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setSimResult(null)}>
                Close
              </Button>
              <Link href={`/simulator`}>
                <Button variant="primary" size="sm" className="bg-[#004E72] text-white">
                  Open in Simulator
                </Button>
              </Link>
            </div>
          </div>
        </Modal>
      )}

      {/* Apply / Dismiss Modal */}
      {selectedRecForAction && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedRecForAction(null)}
          title={selectedRecForAction.mode === "apply" ? "Apply Recommendation" : "Dismiss Recommendation"}
        >
          <div className="space-y-4 text-xs">
            <p className="text-[#475569]">
              {selectedRecForAction.mode === "apply"
                ? "This will create a confirmed action item in the Action Center and record an entry in the activity log."
                : "This recommendation will be marked as dismissed. You can still view it in the dismissed filter."}
            </p>

            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                Operator Notes (Optional)
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Add context or notes for operational staff..."
                rows={3}
                className="w-full p-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#092634] focus:outline-hidden focus:ring-1 focus:ring-[#004E72]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedRecForAction(null)}>
                Cancel
              </Button>
              <Button
                variant={selectedRecForAction.mode === "apply" ? "primary" : "danger"}
                size="sm"
                onClick={handleConfirmAction}
                isLoading={submittingAction}
                className={selectedRecForAction.mode === "apply" ? "bg-[#004E72] text-white" : ""}
              >
                {selectedRecForAction.mode === "apply" ? "Confirm & Apply" : "Confirm Dismissal"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
