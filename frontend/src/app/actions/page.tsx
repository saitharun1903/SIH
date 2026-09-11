"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  History,
  ShieldCheck,
  Building2,
  TrendingUp,
  Layers,
  ArrowRight,
  Filter,
  Check,
  RefreshCw,
  Clock,
  Sparkles,
  Search,
  ChevronRight,
  SlidersHorizontal,
  CheckSquare,
  FileCheck,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Recommendation, AuditLogEntry, ScenarioResult } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export default function ActionCenterPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("Active");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"actions" | "audit">("actions");

  // Simulation preview modal
  const [simResult, setSimResult] = useState<{ recId: number; result: ScenarioResult; scenarioId: number } | null>(null);
  const [simulatingRecId, setSimulatingRecId] = useState<number | null>(null);

  // Apply / Dismiss modal
  const [selectedRecForAction, setSelectedRecForAction] = useState<{ rec: Recommendation; mode: "apply" | "dismiss" } | null>(null);
  const [actionNotes, setActionNotes] = useState<string>("");
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, [statusFilter, priorityFilter]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [recs, logs] = await Promise.all([
        api.getRecommendations({
          status: statusFilter === "all" ? undefined : statusFilter,
          priority: priorityFilter === "all" ? undefined : priorityFilter,
        }),
        api.getAuditLogs(30).catch(() => []),
      ]);
      setRecommendations(recs);
      setAuditLogs(logs);
    } catch (err: any) {
      setError(err.message || "Failed to load operational recommendations.");
    } finally {
      setLoading(false);
    }
  }

  async function handleScanNow() {
    setScanning(true);
    setError(null);
    try {
      const updated = await api.generateRecommendations();
      setRecommendations(updated);
      setSuccessMessage(`Synthesized ${updated.length} verified action recommendations.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || "Recommendation synthesis failed.");
    } finally {
      setScanning(false);
    }
  }

  async function handleSimulate(recId: number) {
    setSimulatingRecId(recId);
    setError(null);
    try {
      const data = await api.simulateRecommendation(recId);
      setSimResult({
        recId,
        result: data.simulation,
        scenarioId: data.scenario_id,
      });
      const updatedLogs = await api.getAuditLogs(30);
      setAuditLogs(updatedLogs);
    } catch (err: any) {
      setError(err.message || "Failed to simulate recommendation.");
    } finally {
      setSimulatingRecId(null);
    }
  }

  async function handleConfirmStatusUpdate() {
    if (!selectedRecForAction) return;
    setSubmittingAction(true);
    try {
      const { rec, mode } = selectedRecForAction;
      if (mode === "apply") {
        await api.applyRecommendation(rec.id, actionNotes);
        setSuccessMessage(`Action "${rec.title}" approved and marked as Applied.`);
      } else {
        await api.dismissRecommendation(rec.id, actionNotes);
        setSuccessMessage(`Action "${rec.title}" dismissed.`);
      }
      setSelectedRecForAction(null);
      setActionNotes("");
      await loadData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to update action status.");
    } finally {
      setSubmittingAction(false);
    }
  }

  const filteredRecs = useMemo(() => {
    return recommendations.filter((r) => {
      const matchesSearch =
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.problem_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.resource?.name && r.resource.name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSearch;
    });
  }, [recommendations, searchQuery]);

  const metrics = useMemo(() => {
    const active = recommendations.filter((r) => r.status === "Active");
    const urgent = active.filter((r) => r.priority === "Critical" || r.priority === "High");
    const applied = recommendations.filter((r) => r.status === "Applied");

    const totalPotentialMonthlySavings = active.reduce((acc, curr) => {
      return acc + (curr.estimated_impact?.monthly_savings_inr || 0);
    }, 0);

    return {
      activeCount: active.length,
      urgentCount: urgent.length,
      appliedCount: applied.length,
      potentialMonthlySavings: Math.round(totalPotentialMonthlySavings),
    };
  }, [recommendations]);

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-blue">
              Autonomous Operations
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">Automated Work Orders &amp; Audit Trail</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-navy flex items-center gap-3">
            <Zap className="h-6 w-6 text-brand-blue" />
            Operational Action Center
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Synthesized operational interventions with 1-click counterfactual What-If verification and immutable institutional audit trail.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="accent"
            size="sm"
            onClick={handleScanNow}
            disabled={scanning}
            className="font-bold flex items-center gap-2 shadow-xs"
          >
            {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Scan &amp; Refresh Actions</span>
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between shadow-subtle">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800 font-bold">
            &times;
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between shadow-subtle">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800 font-bold">
            &times;
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-slate-200 bg-white shadow-subtle">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Active Action Items
          </span>
          <div className="text-3xl font-bold font-mono text-brand-navy">{metrics.activeCount}</div>
          <div className="mt-2 text-xs text-slate-500">Ready for facility execution</div>
        </Card>

        <Card className="p-5 border-slate-200 bg-white shadow-subtle">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Critical / High Priority
          </span>
          <div className="text-3xl font-bold font-mono text-amber-600">{metrics.urgentCount}</div>
          <div className="mt-2 text-xs text-amber-700 font-medium">Immediate ROI potential</div>
        </Card>

        <Card className="p-5 border-slate-200 bg-white shadow-subtle">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Potential Monthly Savings
          </span>
          <div className="text-3xl font-bold font-mono text-emerald-700">
            ₹{metrics.potentialMonthlySavings.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-emerald-800 font-medium">Across active items (@ ₹8.50/kWh)</div>
        </Card>

        <Card className="p-5 border-slate-200 bg-white shadow-subtle">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Implemented Actions
          </span>
          <div className="text-3xl font-bold font-mono text-brand-blue">{metrics.appliedCount}</div>
          <div className="mt-2 text-xs text-slate-500">Logged to institutional audit trail</div>
        </Card>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab("actions")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "actions"
                ? "bg-white text-brand-navy shadow-sm font-bold border border-slate-200"
                : "text-slate-600 hover:text-brand-navy"
            }`}
          >
            Operational Work Orders ({filteredRecs.length})
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === "audit"
                ? "bg-white text-brand-navy shadow-sm font-bold border border-slate-200"
                : "text-slate-600 hover:text-brand-navy"
            }`}
          >
            <History className="w-3.5 h-3.5 text-brand-blue" />
            <span>Decision Audit Trail ({auditLogs.length})</span>
          </button>
        </div>

        {activeTab === "actions" && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search action or room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-brand-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue w-48 shadow-xs"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue shadow-xs"
            >
              <option value="Active">Active Only</option>
              <option value="Applied">Applied / Resolved</option>
              <option value="Dismissed">Dismissed</option>
              <option value="all">All Statuses</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue shadow-xs"
            >
              <option value="all">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {activeTab === "actions" ? (
        <div className="space-y-4">
          {loading ? (
            <Card className="py-12 text-center border-slate-200 bg-white">
              <div className="inline-block h-6 w-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mb-2" />
              <div className="text-xs text-slate-500">Loading operational actions...</div>
            </Card>
          ) : filteredRecs.length === 0 ? (
            <Card className="py-12 text-center border-dashed border-slate-300 bg-white">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              <h3 className="text-base font-bold text-brand-navy">No Actions Found</h3>
              <p className="text-xs text-slate-500 mt-1">
                {statusFilter === "Active"
                  ? "All systems optimal. Click 'Scan & Refresh Actions' to run an anomaly scan."
                  : "No actions match your current filter settings."}
              </p>
            </Card>
          ) : (
            filteredRecs.map((rec) => {
              const priorityVariant =
                rec.priority === "Critical"
                  ? "danger"
                  : rec.priority === "High"
                  ? "warning"
                  : rec.priority === "Medium"
                  ? "blue"
                  : "neutral";

              const statusVariant =
                rec.status === "Active"
                  ? "warning"
                  : rec.status === "Applied"
                  ? "success"
                  : "neutral";

              return (
                <Card
                  key={rec.id}
                  className="p-5 border-slate-200 bg-white hover:border-slate-300 transition-all shadow-subtle"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={priorityVariant as any} size="sm" className="font-bold">
                          {rec.priority.toUpperCase()}
                        </Badge>
                        <Badge variant={statusVariant as any} size="sm">
                          {rec.status}
                        </Badge>
                        <span className="text-[11px] font-mono text-slate-400">
                          ID: #{rec.id}
                        </span>
                        {rec.resource && (
                          <span className="text-[11px] font-semibold text-brand-blue bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {rec.resource.name} ({rec.resource.code})
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-brand-navy">{rec.title}</h3>

                      <div className="text-xs text-slate-600 space-y-1">
                        <div>
                          <strong className="text-slate-800">Problem: </strong>
                          <span>{rec.problem_description}</span>
                        </div>
                        <div>
                          <strong className="text-slate-800">Proposed Intervention: </strong>
                          <span>{rec.recommended_action}</span>
                        </div>
                      </div>

                      {/* Expected Impact Badges */}
                      {rec.estimated_impact && (
                        <div className="pt-2 flex flex-wrap items-center gap-3 text-xs">
                          {rec.estimated_impact.monthly_savings_inr !== undefined && (
                            <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60 font-medium">
                              <span>Estimated Savings:</span>
                              <strong className="font-bold font-mono">
                                ₹{Math.round(rec.estimated_impact.monthly_savings_inr).toLocaleString()} / mo
                              </strong>
                            </div>
                          )}
                          {rec.estimated_impact.rooms_freed !== undefined && (
                            <div className="flex items-center gap-1.5 text-brand-blue bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 font-medium">
                              <span>Rooms Freed:</span>
                              <strong className="font-bold font-mono">{rec.estimated_impact.rooms_freed} space(s)</strong>
                            </div>
                          )}
                          {rec.estimated_impact.confidence_score !== undefined && (
                            <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                              <span>Confidence:</span>
                              <strong className="font-bold font-mono">
                                {Math.round(rec.estimated_impact.confidence_score * 100)}%
                              </strong>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap lg:flex-col items-center lg:items-end gap-2 pt-2 lg:pt-0">
                      <Button
                        variant="accent"
                        size="sm"
                        onClick={() => handleSimulate(rec.id)}
                        disabled={simulatingRecId === rec.id}
                        className="flex items-center gap-1.5 font-bold"
                      >
                        {simulatingRecId === rec.id ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Simulating...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Simulate Impact</span>
                          </>
                        )}
                      </Button>

                      {rec.status === "Active" && (
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRecForAction({ rec, mode: "apply" })}
                            className="border-emerald-200 text-emerald-800 hover:bg-emerald-50 text-xs font-semibold"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Apply</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRecForAction({ rec, mode: "dismiss" })}
                            className="border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700 text-xs"
                          >
                            <span>Dismiss</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        /* Audit Trail View */
        <Card className="p-0 overflow-hidden border-slate-200 bg-white shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Operator / User</th>
                  <th className="py-3 px-4">Action Type</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Audit Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                      No audit log entries recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-500 font-mono whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-4 font-sans font-medium text-brand-navy">
                        {log.user_email || "System Engine"}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <Badge variant="blue" size="sm">
                          {log.action}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-600">
                        {log.entity_type} #{log.entity_id}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-md truncate font-mono text-[11px]">
                        {log.metadata_json || "--"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Simulation Result Modal */}
      {simResult && (
        <Modal
          isOpen={true}
          onClose={() => setSimResult(null)}
          title="Counterfactual What-If Simulation Result"
          maxWidth="xl"
        >
          <div className="space-y-4 text-xs">
            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                simResult.result.feasibility === "FEASIBLE"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-rose-50 border-rose-200 text-rose-900"
              }`}
            >
              <div className="flex items-center gap-3">
                {simResult.result.feasibility === "FEASIBLE" ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-700 flex-shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-700 flex-shrink-0" />
                )}
                <div>
                  <div className="font-bold text-sm">
                    {simResult.result.feasibility === "FEASIBLE"
                      ? "Feasible Policy Mutation"
                      : "Constraint Conflict"}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    CP-SAT solved in {simResult.result.solve_duration_ms || "<2.5"} ms
                  </div>
                </div>
              </div>
              <Badge variant={simResult.result.feasibility === "FEASIBLE" ? "success" : "danger"} size="md">
                {simResult.result.feasibility}
              </Badge>
            </div>

            {/* Delta metrics */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase text-slate-500 font-semibold">Rooms Freed</div>
                <div className="text-lg font-bold font-mono text-brand-navy mt-1">
                  {simResult.result.delta_metrics?.rooms_freed ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase text-slate-500 font-semibold">Weekly Energy Saved</div>
                <div className="text-lg font-bold font-mono text-emerald-700 mt-1">
                  {simResult.result.delta_metrics?.weekly_energy_savings_kwh.toLocaleString() ?? 0} kWh
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase text-slate-500 font-semibold">Sessions Moved</div>
                <div className="text-lg font-bold font-mono text-brand-blue mt-1">
                  {simResult.result.delta_metrics?.displaced_events_count ?? 0}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                href={`/simulator`}
                className="text-brand-blue font-semibold hover:underline flex items-center gap-1"
              >
                <span>Open full scenario in Simulator</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <Button variant="outline" size="sm" onClick={() => setSimResult(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Apply / Dismiss Modal */}
      {selectedRecForAction && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedRecForAction(null)}
          title={selectedRecForAction.mode === "apply" ? "Approve Work Order" : "Dismiss Recommendation"}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              {selectedRecForAction.mode === "apply"
                ? `You are marking "${selectedRecForAction.rec.title}" as implemented. This action will be logged to the immutable audit trail.`
                : `Are you sure you want to dismiss "${selectedRecForAction.rec.title}"?`}
            </p>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Administrative Notes (Optional)</label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="e.g. Approved by facility director; maintenance work order #402 dispatched."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                rows={3}
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRecForAction(null)}
              >
                Cancel
              </Button>
              <Button
                variant={selectedRecForAction.mode === "apply" ? "primary" : "danger"}
                size="sm"
                onClick={handleConfirmStatusUpdate}
                disabled={submittingAction}
                className="font-bold"
              >
                {submittingAction
                  ? "Updating..."
                  : selectedRecForAction.mode === "apply"
                  ? "Approve & Implement"
                  : "Confirm Dismiss"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
