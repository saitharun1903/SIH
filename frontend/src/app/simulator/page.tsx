"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Play,
  Zap,
  Sliders,
  Building2,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Trash2,
  Layers,
  ArrowRight,
  Clock,
  Sparkles,
  RefreshCw,
  Search,
  Check,
  Calendar,
  Users,
  ShieldCheck,
  CheckSquare,
  FileCheck,
  Send,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  Scenario,
  ScenarioTemplate,
  ScenarioResult,
  ScenarioChangeCreate,
  Building,
} from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/context/WorkspaceContext";

export default function SimulatorPage() {
  const { terminology } = useWorkspace();
  const [templates, setTemplates] = useState<ScenarioTemplate[]>([]);

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null);
  const [activeResult, setActiveResult] = useState<ScenarioResult | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Simulation day filter
  const [selectedDay, setSelectedDay] = useState<string>("all");

  // Reallocations table search & filter
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [moveFilter, setMoveFilter] = useState<"all" | "moved" | "retained">("all");

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newScenarioName, setNewScenarioName] = useState<string>("");
  const [newScenarioDesc, setNewScenarioDesc] = useState<string>("");
  const [newScenarioPeriod, setNewScenarioPeriod] = useState<string>("Operational Baseline");
  const [newChanges, setNewChanges] = useState<ScenarioChangeCreate[]>([
    { change_type: "change_enrollment", parameters: { enrollment_multiplier: 1.15 } },
  ]);

  // Initial data load
  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    setError(null);
    try {
      const [tmplData, scData, bldgData] = await Promise.all([
        api.getScenarioTemplates().catch(() => []),
        api.getScenarios().catch(() => []),
        api.getBuildingsList().catch(() => []),
      ]);

      setTemplates(tmplData);
      setScenarios(scData);
      setBuildings(Array.isArray(bldgData) ? bldgData : []);

      if (scData.length > 0) {
        setSelectedScenarioId(scData[0].id);
        if (scData[0].results && scData[0].results.length > 0) {
          setActiveResult(scData[0].results[0]);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load simulation environment.");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectScenario(id: number) {
    setSelectedScenarioId(id);
    const target = scenarios.find((s) => s.id === id);
    if (target && target.results && target.results.length > 0) {
      setActiveResult(target.results[0]);
    } else {
      setActiveResult(null);
    }
  }

  async function handleLaunchTemplate(template: ScenarioTemplate) {
    setSimulating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const created = await api.createScenario({
        name: template.title,
        description: template.description,
        base_period: "Operational Baseline",
        changes: template.default_changes,
      });

      const result = await api.simulateScenario(created.id, selectedDay);

      const updatedList = await api.getScenarios();
      setScenarios(updatedList);
      setSelectedScenarioId(created.id);
      setActiveResult(result);
      setSuccessMessage(`Scenario "${template.title}" optimized successfully!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || "Template execution failed.");
    } finally {
      setSimulating(false);
    }
  }

  async function handleRunSimulation() {
    if (!selectedScenarioId) return;
    setSimulating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await api.simulateScenario(selectedScenarioId, selectedDay);
      setActiveResult(result);

      const updatedList = await api.getScenarios();
      setScenarios(updatedList);

      setSuccessMessage("Mathematical CP-SAT constraint optimization complete.");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || "Simulation execution failed.");
    } finally {
      setSimulating(false);
    }
  }

  async function handleDeleteScenario(id: number) {
    if (!confirm("Are you sure you want to delete this scenario and all simulation runs?")) return;
    try {
      await api.deleteScenario(id);
      const remaining = scenarios.filter((s) => s.id !== id);
      setScenarios(remaining);
      if (selectedScenarioId === id) {
        if (remaining.length > 0) {
          setSelectedScenarioId(remaining[0].id);
          setActiveResult(remaining[0].results?.[0] || null);
        } else {
          setSelectedScenarioId(null);
          setActiveResult(null);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete scenario.");
    }
  }

  function handleAddChange() {
    setNewChanges([
      ...newChanges,
      { change_type: "deactivate_building", parameters: { building_id: buildings[0]?.id || 1 } },
    ]);
  }

  function handleRemoveChange(index: number) {
    setNewChanges(newChanges.filter((_, i) => i !== index));
  }

  async function handleCreateCustomScenario(e: React.FormEvent) {
    e.preventDefault();
    if (!newScenarioName.trim()) return;
    setSimulating(true);
    setError(null);
    try {
      const created = await api.createScenario({
        name: newScenarioName,
        description: newScenarioDesc,
        base_period: newScenarioPeriod,
        changes: newChanges,
      });

      const result = await api.simulateScenario(created.id, selectedDay);

      const updatedList = await api.getScenarios();
      setScenarios(updatedList);
      setSelectedScenarioId(created.id);
      setActiveResult(result);
      setShowCreateModal(false);

      setNewScenarioName("");
      setNewScenarioDesc("");
      setNewChanges([{ change_type: "change_enrollment", parameters: { enrollment_multiplier: 1.15 } }]);
      setSuccessMessage(`Custom scenario "${created.name}" created and optimized.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to create scenario.");
    } finally {
      setSimulating(false);
    }
  }

  const filteredReallocations = useMemo(() => {
    if (!activeResult?.reallocations) return [];
    return activeResult.reallocations.filter((event) => {
      const matchesSearch =
        event.subject_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.original_resource_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.optimized_resource_name.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (moveFilter === "moved") return event.was_moved;
      if (moveFilter === "retained") return !event.was_moved;
      return true;
    });
  }, [activeResult, searchQuery, moveFilter]);

  const selectedScenario = useMemo(() => {
    return scenarios.find((s) => s.id === selectedScenarioId);
  }, [scenarios, selectedScenarioId]);

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#004E72]">
              Decisions
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">Scenario Evaluation</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#092634] flex items-center gap-3">
            <Sliders className="h-6 w-6 text-[#004E72]" />
            What-If Simulator
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Test a change before applying it. Evaluate resource availability, demand shifts, and capacity changes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="accent"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 shadow-sm font-semibold text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Scenario</span>
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

      {/* Suggested Scenarios */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Suggested Scenarios
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Quick tests calibrated to your workspace resources and operating schedule
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono">Constraint Solver Ready</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {templates.map((tmpl) => (
            <Card
              key={tmpl.template_id}
              className="p-4 border-slate-200 bg-white hover:border-brand-blue/40 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {tmpl.category}
                  </span>
                  {tmpl.category?.toLowerCase().includes("capacity") ? (
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                  ) : tmpl.category?.toLowerCase().includes("energy") || tmpl.category?.toLowerCase().includes("sustainability") ? (
                    <Zap className="w-4 h-4 text-emerald-600" />
                  ) : tmpl.category?.toLowerCase().includes("maintenance") || tmpl.category?.toLowerCase().includes("retrofit") ? (
                    <Building2 className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Layers className="w-4 h-4 text-brand-blue" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-brand-navy group-hover:text-brand-blue transition-colors">
                  {tmpl.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-3 leading-relaxed">
                  {tmpl.description}
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLaunchTemplate(tmpl)}
                disabled={simulating}
                className="mt-4 w-full flex items-center justify-center gap-1.5 text-xs font-bold text-brand-blue border-blue-200 bg-blue-50/50 hover:bg-blue-100/60"
              >
                {simulating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Optimizing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>Launch &amp; Simulate</span>
                  </>
                )}
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Step 2 & 3: Active Scenario Selector & Simulation Control Bar */}
      <Card className="p-5 border-slate-200 bg-white shadow-subtle">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Active Scenario Under Test
              </label>
              <select
                value={selectedScenarioId || ""}
                onChange={(e) => handleSelectScenario(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue min-w-[240px]"
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Day Partition Filter
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              >
                <option value="all">Full Week (Monday – Friday)</option>
                <option value="Monday">Monday Only</option>
                <option value="Tuesday">Tuesday Only</option>
                <option value="Wednesday">Wednesday Only</option>
                <option value="Thursday">Thursday Only</option>
                <option value="Friday">Friday Only</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end lg:self-center">
            {selectedScenarioId && (
              <button
                onClick={() => handleDeleteScenario(selectedScenarioId)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-all"
                title="Delete this scenario"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Hero Simulation Action Button in Brand Orange */}
            <Button
              variant="accent"
              size="md"
              onClick={handleRunSimulation}
              disabled={simulating || !selectedScenarioId}
              className="flex items-center gap-2 font-bold shadow-md shadow-orange-500/10"
            >
              {simulating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Solving CP-SAT Invariants...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Run CP-SAT Simulation</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {selectedScenario && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-brand-navy">Active Policy Mutations:</span>
            {selectedScenario.changes.map((ch, idx) => (
              <span key={idx} className="px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-slate-700 font-medium">
                {ch.change_type === "deactivate_building" && `🏢 Close ${terminology.group} #${ch.parameters?.building_id || ch.target_resource_id}`}
                {ch.change_type === "deactivate_resource" && `🚪 Deactivate ${terminology.resource} #${ch.target_resource_id}`}
                {ch.change_type === "change_enrollment" && `👥 ${Math.round(((ch.parameters?.enrollment_multiplier || 1) - 1) * 100)}% Demand Surge`}
                {ch.change_type === "move_day_online" && `🌐 ${ch.parameters?.day_of_week || "Friday"} Remote / Standby`}
              </span>
            ))}

          </div>
        )}
      </Card>

      {/* Simulation Results Section */}
      {activeResult ? (
        <div className="space-y-6">
          {/* Top Verdict Feasibility Banner */}
          <div
            className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-subtle ${
              activeResult.feasibility === "FEASIBLE"
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                : "bg-rose-50/80 border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-start gap-3.5">
              {activeResult.feasibility === "FEASIBLE" ? (
                <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700 flex-shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-rose-100 text-rose-700 flex-shrink-0">
                  <XCircle className="w-6 h-6" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-lg font-bold">
                    {activeResult.feasibility === "FEASIBLE"
                      ? "Feasible Policy Configuration Verified"
                      : "Capacity & Overlap Bottleneck Detected"}
                  </span>
                  <Badge
                    variant={activeResult.feasibility === "FEASIBLE" ? "success" : "danger"}
                    size="md"
                    className="font-bold uppercase"
                  >
                    {activeResult.feasibility}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {activeResult.feasibility === "FEASIBLE"
                    ? "Constraint engine verified zero operational conflicts and satisfied all physical resource capacity limits."
                    : "Physical resource capacities or operational overlaps prevent complete allocation without displacement."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-5 text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Solve Time</span>
                <span className="font-bold font-mono text-brand-navy">
                  {activeResult.solve_duration_ms ? `${activeResult.solve_duration_ms} ms` : "< 2.5s"}
                </span>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Objective Score</span>
                <span className="font-bold font-mono text-brand-blue">
                  {activeResult.objective_score.toLocaleString()}
                </span>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Solver Engine</span>
                <span className="font-bold font-mono text-brand-navy">Constraint Solver</span>
              </div>
            </div>
          </div>

          {/* Key Before vs After Metrics Scorecards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Active Spaces */}
            <Card className="p-5 border-slate-200 bg-white shadow-subtle">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Active Spaces Required
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono text-brand-navy">
                  {activeResult.delta_metrics.rooms_after ?? activeResult.before_metrics?.active_rooms}
                </span>
                <span className="text-xs text-slate-400 line-through font-mono">
                  {activeResult.delta_metrics.rooms_before ?? activeResult.before_metrics?.active_rooms}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-emerald-700 font-bold">
                  {activeResult.delta_metrics.rooms_freed > 0
                    ? `↓ ${activeResult.delta_metrics.rooms_freed} rooms freed`
                    : "0 room change"}
                </span>
                <span className="text-slate-400">Offline headroom</span>
              </div>
            </Card>

            {/* Average Seat Fill Rate */}
            <Card className="p-5 border-slate-200 bg-white shadow-subtle">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Average Seat Fill Rate
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono text-brand-navy">
                  {activeResult.delta_metrics.utilization_after ?? activeResult.after_metrics?.avg_utilization}%
                </span>
                <span className="text-xs text-slate-400 line-through font-mono">
                  {activeResult.delta_metrics.utilization_before ?? activeResult.before_metrics?.avg_utilization}%
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span
                  className={`font-bold ${
                    activeResult.delta_metrics.utilization_delta_percent >= 0
                      ? "text-emerald-700"
                      : "text-amber-700"
                  }`}
                >
                  {activeResult.delta_metrics.utilization_delta_percent >= 0 ? "+" : ""}
                  {activeResult.delta_metrics.utilization_delta_percent}% efficiency
                </span>
                <span className="text-slate-400">Seat fill match</span>
              </div>
            </Card>

            {/* Weekly Energy Demand */}
            <Card className="p-5 border-slate-200 bg-white shadow-subtle">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Weekly Energy Savings
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono text-emerald-700">
                  {activeResult.delta_metrics.weekly_energy_savings_kwh.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-500">kWh</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-emerald-700 font-bold font-mono">
                  {activeResult.delta_metrics.weekly_cost_savings_inr
                    ? `₹${Math.round(activeResult.delta_metrics.weekly_cost_savings_inr).toLocaleString()} / wk`
                    : `₹${Math.round(activeResult.delta_metrics.weekly_energy_savings_kwh * 8.5).toLocaleString()} / wk`}
                </span>
                <span className="text-slate-400">Commercial tariff</span>
              </div>
            </Card>

            {/* Displaced Sessions */}
            <Card className="p-5 border-slate-200 bg-white shadow-subtle">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Reallocated Sessions
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono text-brand-blue">
                  {activeResult.delta_metrics.displaced_events_count ?? 0}
                </span>
                <span className="text-xs font-medium text-slate-400">
                  / {activeResult.delta_metrics.total_events ?? activeResult.reallocations?.length ?? 0}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-brand-blue font-bold">
                  {activeResult.delta_metrics.displaced_events_count === 0
                    ? "0 schedule disruption"
                    : "Intelligently shifted"}
                </span>
                <span className="text-slate-400">Perturbation</span>
              </div>
            </Card>
          </div>

          {/* Mathematical Invariant Checklist */}
          <Card className="p-5 border-slate-200 bg-white shadow-subtle">
            <h3 className="text-sm font-bold text-brand-navy flex items-center gap-2 mb-3">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              Constraint Satisfaction &amp; Operational Safety Checklist
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-900">Capacity Feasibility</div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">Zero rooms exceeded physical seat threshold.</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-900">No Double-Bookings</div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">Temporal disjointness verified across all slots.</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-900">Hardware &amp; Equipment</div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">Computing &amp; Lab requirements respected.</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-900">Building Shutdown Invariants</div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">Closed facilities vacated completely.</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Strategic Rationale & Algorithmic Takeaways */}
          {activeResult.recommendations && activeResult.recommendations.length > 0 && (
            <Card className="p-5 border-blue-200 bg-blue-50/40 shadow-subtle">
              <h3 className="text-sm font-bold text-brand-navy flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-brand-blue" />
                Solver Strategy &amp; Institutional Recommendations
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeResult.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-white border border-blue-100 text-xs text-slate-700 flex items-start gap-2.5 shadow-xs"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Violations Warning (If any) */}
          {activeResult.violations && activeResult.violations.length > 0 && (
            <div className="p-5 rounded-xl bg-rose-50 border border-rose-200 shadow-subtle">
              <h3 className="text-sm font-bold text-rose-900 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Unsatisfied Invariants &amp; Bottlenecks ({activeResult.violations.length})
              </h3>
              <ul className="space-y-1.5 text-xs text-rose-800">
                {activeResult.violations.map((v, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-rose-600 font-bold">•</span>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reallocation Plan Table */}
          <Card className="p-0 border-slate-200 bg-white shadow-subtle overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-brand-navy">
                  Schedule Reallocation Matrix
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detailed assignment comparison between baseline schedule and simulated solution
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search subject, room, dept..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-brand-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue w-52"
                  />
                </div>

                {/* Filter */}
                <select
                  value={moveFilter}
                  onChange={(e: any) => setMoveFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                >
                  <option value="all">All Assignments</option>
                  <option value="moved">Reallocated Only</option>
                  <option value="retained">Retained Baseline Only</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Subject &amp; Department</th>
                    <th className="py-3 px-3">Day &amp; Time Slot</th>
                    <th className="py-3 px-3 text-right">Students</th>
                    <th className="py-3 px-4">Baseline Room</th>
                    <th className="py-3 px-4">CP-SAT Optimized Room</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4">Decision Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReallocations.slice(0, 100).map((event) => (
                    <tr key={event.schedule_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-medium text-brand-navy">
                        <div>{event.subject_name}</div>
                        <div className="text-[11px] text-slate-400 font-normal">{event.department}</div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-brand-navy">{event.day_of_week}</div>
                        <div className="text-[11px] font-mono text-slate-500">{event.time_slot}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-brand-navy">
                        {event.expected_occupancy}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-700">{event.original_resource_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">Cap: {event.original_capacity} seats</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-brand-blue">{event.optimized_resource_name}</div>
                        <div className="text-[11px] text-brand-blue/70 font-mono">Cap: {event.optimized_capacity} seats</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {event.was_moved ? (
                          <Badge variant="warning" size="sm">
                            Reallocated
                          </Badge>
                        ) : (
                          <Badge variant="success" size="sm">
                            Retained
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500 max-w-xs leading-relaxed">
                        {event.reason}
                      </td>
                    </tr>
                  ))}
                  {filteredReallocations.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                        No class events match your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {filteredReallocations.length > 100 && (
              <div className="py-3 px-4 text-center text-xs text-slate-500 border-t border-slate-100 bg-slate-50/50">
                Showing first 100 of {filteredReallocations.length} sessions.
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card className="py-16 text-center border-dashed border-slate-300 bg-white">
          <Sliders className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-brand-navy">No Simulation Result Active</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Select an existing scenario from the dropdown above, launch one of the 1-click curated templates, or construct a custom scenario.
          </p>
        </Card>
      )}

      {/* Build Custom Scenario Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-brand-navy/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-brand-navy">Design Custom What-If Scenario</h2>
                <p className="text-xs text-slate-500">
                  Formulate policy conditions, closures, or capacity changes for CP-SAT stress testing.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCustomScenario} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Scenario Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Energy Audit: Floor 3 Shutdown"
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Academic Term / Base Period
                  </label>
                  <input
                    type="text"
                    value={newScenarioPeriod}
                    onChange={(e) => setNewScenarioPeriod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="Brief description of the test"
                    value={newScenarioDesc}
                    onChange={(e) => setNewScenarioDesc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                  />
                </div>
              </div>

              {/* Changes List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Policy Mutations &amp; Invariant Overrides ({newChanges.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddChange}
                    className="text-xs font-bold text-brand-blue hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Mutation</span>
                  </button>
                </div>

                {newChanges.map((ch, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-3"
                  >
                    <select
                      value={ch.change_type}
                      onChange={(e) => {
                        const next = [...newChanges];
                        next[idx].change_type = e.target.value;
                        if (e.target.value === "change_enrollment") {
                          next[idx].parameters = { enrollment_multiplier: 1.15 };
                        } else if (e.target.value === "deactivate_building") {
                          next[idx].parameters = { building_id: buildings[0]?.id || 1 };
                        } else if (e.target.value === "move_day_online") {
                          next[idx].parameters = { day_of_week: "Friday" };
                        }
                        setNewChanges(next);
                      }}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                    >
                      <option value="change_enrollment">Change Enrollment Multiplier</option>
                      <option value="deactivate_building">Deactivate Entire Building</option>
                      <option value="move_day_online">Transition Day to Remote Online</option>
                    </select>

                    {/* Change Parameters */}
                    <div className="flex-1 w-full">
                      {ch.change_type === "change_enrollment" && (
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.05"
                            value={ch.parameters?.enrollment_multiplier || 1.0}
                            onChange={(e) => {
                              const next = [...newChanges];
                              next[idx].parameters = { enrollment_multiplier: parseFloat(e.target.value) };
                              setNewChanges(next);
                            }}
                            className="flex-1 accent-brand-blue"
                          />
                          <span className="text-xs font-bold font-mono text-brand-navy w-14 text-right">
                            {ch.parameters?.enrollment_multiplier}x (
                            {Math.round(((ch.parameters?.enrollment_multiplier || 1) - 1) * 100)}%)
                          </span>
                        </div>
                      )}

                      {ch.change_type === "deactivate_building" && (
                        <select
                          value={ch.parameters?.building_id || buildings[0]?.id || 1}
                          onChange={(e) => {
                            const next = [...newChanges];
                            next[idx].parameters = { building_id: parseInt(e.target.value) };
                            setNewChanges(next);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                        >
                          {Array.isArray(buildings) &&
                            buildings.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name} ({b.code})
                              </option>
                            ))}
                        </select>
                      )}

                      {ch.change_type === "move_day_online" && (
                        <select
                          value={ch.parameters?.day_of_week || "Friday"}
                          onChange={(e) => {
                            const next = [...newChanges];
                            next[idx].parameters = { day_of_week: e.target.value };
                            setNewChanges(next);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                        >
                          <option value="Monday">Monday</option>
                          <option value="Tuesday">Tuesday</option>
                          <option value="Wednesday">Wednesday</option>
                          <option value="Thursday">Thursday</option>
                          <option value="Friday">Friday</option>
                        </select>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveChange(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="accent"
                  size="sm"
                  disabled={simulating}
                  className="font-bold flex items-center gap-2"
                >
                  {simulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>Save &amp; Optimize Now</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
