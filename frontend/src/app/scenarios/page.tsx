"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Zap,
  TrendingUp,
  Building2,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  BarChart3,
  Award,
  RefreshCw,
  Plus,
} from "lucide-react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { api } from "@/lib/api";
import { Scenario, ScenarioTemplate } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function ScenariosComparePage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [templates, setTemplates] = useState<ScenarioTemplate[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [seeding, setSeeding] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadScenarios();
  }, []);

  async function loadScenarios() {
    setLoading(true);
    setError(null);
    try {
      const [scList, tmplList] = await Promise.all([
        api.getScenarios().catch(() => []),
        api.getScenarioTemplates().catch(() => []),
      ]);

      setScenarios(scList);
      setTemplates(tmplList);

      const simulated = scList.filter((s) => s.results && s.results.length > 0);
      if (simulated.length > 0) {
        setSelectedIds(simulated.slice(0, 3).map((s) => s.id));
      } else if (scList.length > 0) {
        setSelectedIds(scList.slice(0, 3).map((s) => s.id));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load scenarios.");
    } finally {
      setLoading(false);
    }
  }

  async function handleProvisionTemplates() {
    setSeeding(true);
    setError(null);
    try {
      for (const tmpl of templates.slice(0, 3)) {
        const created = await api.createScenario({
          name: tmpl.title,
          description: tmpl.description,
          base_period: "Academic Year 2026-27",
          changes: tmpl.default_changes,
        });
        await api.simulateScenario(created.id);
      }
      await loadScenarios();
    } catch (err: any) {
      setError(err.message || "Failed to provision benchmark scenarios.");
    } finally {
      setSeeding(false);
    }
  }

  function toggleSelect(id: number) {
    if (selectedIds.includes(id)) {
      if (selectedIds.length > 1) {
        setSelectedIds(selectedIds.filter((item) => item !== id));
      }
    } else {
      if (selectedIds.length < 4) {
        setSelectedIds([...selectedIds, id]);
      }
    }
  }

  const comparedScenarios = useMemo(() => {
    return scenarios.filter((s) => selectedIds.includes(s.id));
  }, [scenarios, selectedIds]);

  // Chart data for visualization
  const chartData = useMemo(() => {
    return comparedScenarios.map((s) => {
      const res = s.results?.[0];
      const energyDemand = res?.after_metrics?.weekly_energy_kwh ?? 6737;
      const energySaved = res?.delta_metrics?.weekly_energy_savings_kwh ?? 0;
      const util = res?.after_metrics?.avg_utilization ?? 75.1;
      const monthlySavings = (res?.delta_metrics?.weekly_cost_savings_inr ?? 0) * 4.33;

      return {
        name: s.name.length > 18 ? s.name.substring(0, 18) + "..." : s.name,
        fullName: s.name,
        energyDemand,
        energySaved,
        utilization: util,
        monthlySavings: Math.round(monthlySavings),
        displaced: res?.delta_metrics?.displaced_events_count ?? 0,
        roomsFreed: res?.delta_metrics?.rooms_freed ?? 0,
      };
    });
  }, [comparedScenarios]);

  // Find the top recommendation
  const recommendedScenario = useMemo(() => {
    if (comparedScenarios.length === 0) return null;
    return comparedScenarios.reduce((best, curr) => {
      const bestRes = best.results?.[0];
      const currRes = curr.results?.[0];
      if (!currRes) return best;
      if (!bestRes) return curr;

      if (currRes.feasibility === "FEASIBLE" && bestRes.feasibility !== "FEASIBLE") return curr;
      if (bestRes.feasibility === "FEASIBLE" && currRes.feasibility !== "FEASIBLE") return best;

      const currSavings = currRes.delta_metrics?.weekly_energy_savings_kwh || 0;
      const bestSavings = bestRes.delta_metrics?.weekly_energy_savings_kwh || 0;
      return currSavings > bestSavings ? curr : best;
    }, comparedScenarios[0]);
  }, [comparedScenarios]);

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-blue">
              Strategic Evaluation
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">Multi-Scenario Trade-off Engine</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-navy flex items-center gap-3">
            <GitCompare className="h-6 w-6 text-brand-blue" />
            Scenario Comparison Matrix
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Conduct side-by-side comparative analysis of energy demand, classroom utilization, schedule disruption, and financial ROI.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/simulator">
            <Button variant="accent" size="sm" className="font-bold flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>New Simulation in Simulator</span>
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2 shadow-subtle">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Scenario Multi-Selector Bar */}
      <Card className="p-5 border-slate-200 bg-white shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Select Scenarios to Compare (Up to 4)
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {selectedIds.length} of {scenarios.length} selected
          </span>
        </div>

        {scenarios.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm">
            <p className="mb-3">No scenarios created yet.</p>
            <Button
              variant="primary"
              size="sm"
              onClick={handleProvisionTemplates}
              disabled={seeding}
              className="font-bold flex items-center gap-2 mx-auto"
            >
              {seeding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Provision &amp; Simulate 3 Benchmark Scenarios</span>
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {scenarios.map((s) => {
              const isSelected = selectedIds.includes(s.id);
              const latestRes = s.results?.[0];
              const isFeasible = latestRes?.feasibility === "FEASIBLE";

              return (
                <button
                  key={s.id}
                  onClick={() => toggleSelect(s.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium border flex items-center gap-2.5 transition-all ${
                    isSelected
                      ? "bg-blue-50 border-brand-blue text-brand-navy shadow-xs font-bold ring-1 ring-brand-blue/30"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-brand-navy"
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      latestRes
                        ? isFeasible
                          ? "bg-emerald-600"
                          : "bg-rose-600"
                        : "bg-slate-300"
                    }`}
                  />
                  <span>{s.name}</span>
                  {isSelected && <span className="text-brand-blue font-bold">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Recommended Strategy Banner */}
      {recommendedScenario && recommendedScenario.results?.[0] && (
        <Card className="p-5 border-blue-200 bg-blue-50/60 shadow-subtle flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-white border border-blue-200 text-brand-blue flex-shrink-0 shadow-xs">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="blue" size="sm" className="font-bold">
                  OPTIMAL POLICY VERDICT
                </Badge>
                <span className="text-base font-bold text-brand-navy">{recommendedScenario.name}</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Achieves maximum weekly energy conservation (
                {recommendedScenario.results[0].delta_metrics?.weekly_energy_savings_kwh.toLocaleString()} kWh)
                while maintaining complete timetable constraint feasibility.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 text-xs bg-white px-4 py-2.5 rounded-xl border border-blue-200 shadow-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Monthly Savings</span>
              <span className="text-emerald-700 font-bold text-sm font-mono">
                ₹{Math.round((recommendedScenario.results[0].delta_metrics?.weekly_cost_savings_inr || 0) * 4.33).toLocaleString()}
              </span>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Spaces Freed</span>
              <span className="text-brand-navy font-bold text-sm font-mono">
                {recommendedScenario.results[0].delta_metrics?.rooms_freed || 0} rooms
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Side-by-Side Trade-off Comparison Table */}
      {comparedScenarios.length > 0 ? (
        <Card className="p-0 overflow-hidden border-slate-200 bg-white shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-4 px-5 w-56 bg-slate-50">Decision Metric</th>
                  {comparedScenarios.map((s) => {
                    const isOptimal = recommendedScenario?.id === s.id;
                    return (
                      <th key={s.id} className={`py-4 px-5 min-w-[220px] ${isOptimal ? "bg-blue-50/50" : ""}`}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-brand-navy font-bold text-sm">{s.name}</span>
                          {isOptimal && (
                            <Badge variant="blue" size="sm">
                              BEST
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 normal-case mt-0.5 font-normal">
                          {s.base_period} • {s.changes?.length || 0} mutation(s)
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Feasibility Status */}
                <tr className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-5 font-semibold text-slate-500 bg-slate-50/50">
                    Feasibility Status
                  </td>
                  {comparedScenarios.map((s) => {
                    const res = s.results?.[0];
                    const isFeas = res?.feasibility === "FEASIBLE";
                    return (
                      <td key={s.id} className="py-3.5 px-5">
                        {res ? (
                          <Badge variant={isFeas ? "success" : "danger"} size="sm" className="font-bold uppercase">
                            {res.feasibility}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 italic">Not Simulated Yet</span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Active Spaces Required */}
                <tr className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-5 font-semibold text-slate-500 bg-slate-50/50">
                    Active Rooms Needed
                  </td>
                  {comparedScenarios.map((s) => {
                    const res = s.results?.[0];
                    const freed = res?.delta_metrics?.rooms_freed ?? 0;
                    const after = res?.delta_metrics?.rooms_after ?? res?.before_metrics?.active_rooms ?? 55;
                    return (
                      <td key={s.id} className="py-3.5 px-5">
                        <div className="font-bold text-brand-navy text-sm font-mono">{after} spaces</div>
                        <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                          {freed > 0 ? `↓ ${freed} spaces freed` : "Baseline footprint"}
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Average Seat Fill Rate */}
                <tr className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-5 font-semibold text-slate-500 bg-slate-50/50">
                    Average Seat Fill
                  </td>
                  {comparedScenarios.map((s) => {
                    const res = s.results?.[0];
                    const util = res?.after_metrics?.avg_utilization ?? 75.1;
                    const delta = res?.delta_metrics?.utilization_delta_percent ?? 0;
                    return (
                      <td key={s.id} className="py-3.5 px-5">
                        <div className="font-bold text-brand-navy text-sm font-mono">{util}%</div>
                        <div
                          className={`text-[11px] mt-0.5 font-medium ${
                            delta >= 0 ? "text-emerald-700" : "text-amber-700"
                          }`}
                        >
                          {delta >= 0 ? `+${delta}%` : `${delta}%`} vs baseline
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Weekly Energy Demand */}
                <tr className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-5 font-semibold text-slate-500 bg-slate-50/50">
                    Weekly Energy Demand
                  </td>
                  {comparedScenarios.map((s) => {
                    const res = s.results?.[0];
                    const demand = res?.after_metrics?.weekly_energy_kwh ?? 6737;
                    const saved = res?.delta_metrics?.weekly_energy_savings_kwh ?? 0;
                    return (
                      <td key={s.id} className="py-3.5 px-5">
                        <div className="font-bold text-brand-navy text-sm font-mono">{demand.toLocaleString()} kWh</div>
                        <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                          {saved > 0 ? `↓ ${saved.toLocaleString()} kWh saved` : "Baseline load"}
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Projected Monthly Savings */}
                <tr className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-5 font-semibold text-slate-500 bg-slate-50/50">
                    Projected Monthly Cost
                  </td>
                  {comparedScenarios.map((s) => {
                    const res = s.results?.[0];
                    const monthlySavings = (res?.delta_metrics?.weekly_cost_savings_inr ?? 0) * 4.33;
                    return (
                      <td key={s.id} className="py-3.5 px-5">
                        <div className="font-bold text-emerald-700 text-sm font-mono">
                          {monthlySavings > 0 ? `₹${Math.round(monthlySavings).toLocaleString()} saved` : "₹0"}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">@ ₹8.50 commercial tariff</div>
                      </td>
                    );
                  })}
                </tr>

                {/* Displaced Class Sessions */}
                <tr className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-5 font-semibold text-slate-500 bg-slate-50/50">
                    Timetable Perturbation
                  </td>
                  {comparedScenarios.map((s) => {
                    const res = s.results?.[0];
                    const displaced = res?.delta_metrics?.displaced_events_count ?? 0;
                    const total = res?.delta_metrics?.total_events ?? 980;
                    return (
                      <td key={s.id} className="py-3.5 px-5">
                        <div className="font-bold text-brand-blue text-sm font-mono">
                          {displaced} sessions moved
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {Math.round((displaced / Math.max(total, 1)) * 100)}% of timetable shifted
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* CP-SAT Solver Objective */}
                <tr className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-5 font-semibold text-slate-500 bg-slate-50/50">
                    CP-SAT Objective Value
                  </td>
                  {comparedScenarios.map((s) => {
                    const res = s.results?.[0];
                    return (
                      <td key={s.id} className="py-3.5 px-5 text-brand-navy font-mono text-xs font-bold">
                        {res?.objective_score ? res.objective_score.toLocaleString() : "N/A"}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="py-12 text-center border-dashed border-slate-300 bg-white">
          <p className="text-slate-500 text-sm">Please select at least 1 scenario above to view trade-off analysis.</p>
        </Card>
      )}

      {/* Visual Trade-Off Chart */}
      {chartData.length > 0 && (
        <Card className="p-5 border-slate-200 bg-white shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-brand-navy flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-brand-blue" />
                Energy Demand vs. Conservation Trade-off
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Side-by-side comparison of weekly energy demand (kWh) and weekly conservation (kWh) across selected scenarios
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickFormatter={(v) => `${v}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E2E8F0",
                    borderRadius: "8px",
                    color: "#092634",
                    fontSize: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(val: any, name: any) => [
                    `${val.toLocaleString()} kWh`,
                    name === "energyDemand" ? "Weekly Power Demand" : "Weekly Power Conserved",
                  ]}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "15px", fontSize: "12px" }}
                  formatter={(value) => (value === "energyDemand" ? "Net Energy Demand" : "Energy Conserved")}
                />
                <Bar dataKey="energyDemand" fill="#004E72" name="energyDemand" radius={[4, 4, 0, 0]} />
                <Bar dataKey="energySaved" fill="#FF6E42" name="energySaved" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
