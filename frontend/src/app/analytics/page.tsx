"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import {
  AnalyticsSummary,
  UtilizationTrendPoint,
  EnergyTrendPoint,
  ResourceUtilizationRank,
  BuildingAnalytics,
  PeakDemandPoint,
  Building,
  MultiSourceIntelligenceResponse,
} from "@/lib/types";
import {
  BarChart3,
  TrendingUp,
  Zap,
  DollarSign,
  AlertTriangle,
  Building2,
  RefreshCw,
  Clock,
  Flame,
  Layers,
  Activity,
  ArrowRightLeft,
  Send,
  CheckCircle2,
  Info,
  ShieldCheck,
  Check,
  Calendar,
  Filter,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [selectedBuilding, setSelectedBuilding] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "underutilized" | "overloaded" | "optimal">("all");
  const [buildings, setBuildings] = useState<Building[]>([]);

  // View mode: "campus" | "multi_source"
  const [activeView, setActiveView] = useState<"campus" | "multi_source">("campus");

  // Multi-Source Hybrid Intelligence State
  const [multiSourceData, setMultiSourceData] = useState<MultiSourceIntelligenceResponse | null>(null);
  const [cssiThreshold, setCssiThreshold] = useState<number>(0.50);
  const [dispatching, setDispatching] = useState<boolean>(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);
  const [dispatchedCollisionIds, setDispatchedCollisionIds] = useState<number[]>([]);

  // Analytics Data
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [utilizationTrends, setUtilizationTrends] = useState<UtilizationTrendPoint[]>([]);
  const [energyTrends, setEnergyTrends] = useState<EnergyTrendPoint[]>([]);
  const [rankings, setRankings] = useState<ResourceUtilizationRank[]>([]);
  const [buildingAnalytics, setBuildingAnalytics] = useState<BuildingAnalytics[]>([]);
  const [peakDemand, setPeakDemand] = useState<PeakDemandPoint[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const bId = selectedBuilding ? parseInt(selectedBuilding) : undefined;

      const [
        bldgData,
        summaryData,
        utilTrendsData,
        nrgTrendsData,
        rankData,
        bldgAnalyticsData,
        peakData,
        multiSourceResp,
      ] = await Promise.all([
        api.getBuildingsList().catch(() => []),
        api.getAnalyticsSummary({ building_id: bId }).catch(() => null),
        api.getUtilizationTrends({ building_id: bId }).catch(() => []),
        api.getEnergyTrends({ building_id: bId }).catch(() => []),
        api.getResourceRankings({ building_id: bId, limit: 100 }).catch(() => []),
        api.getBuildingComparison().catch(() => []),
        api.getPeakDemand().catch(() => []),
        api.getMultiSourceIntelligence(cssiThreshold).catch(() => null),
      ]);

      setBuildings(Array.isArray(bldgData) ? bldgData : []);
      setSummary(summaryData);
      setUtilizationTrends(utilTrendsData);
      setEnergyTrends(nrgTrendsData);
      setRankings(rankData);
      setBuildingAnalytics(bldgAnalyticsData);
      setPeakDemand(peakData);
      if (multiSourceResp) setMultiSourceData(multiSourceResp);
    } catch (err: any) {
      setError(err.message || "Failed to load analytics data.");
    } finally {
      setLoading(false);
    }
  };

  const handleThresholdChange = async (newThreshold: number) => {
    setCssiThreshold(newThreshold);
    try {
      const data = await api.getMultiSourceIntelligence(newThreshold);
      setMultiSourceData(data);
    } catch (err: any) {
      console.error("Failed to update CSSI threshold:", err);
    }
  };

  const handleDispatch = async (collisionId?: number) => {
    setDispatching(true);
    setDispatchSuccess(null);
    try {
      const ids = collisionId ? [collisionId] : undefined;
      const res = await api.dispatchMultiSourceRecommendations(ids);
      if (collisionId) {
        setDispatchedCollisionIds((prev) => [...prev, collisionId]);
      } else {
        const allIds = multiSourceData?.timetable_stress_collisions.map((c) => c.collision_id) || [];
        setDispatchedCollisionIds((prev) => [...prev, ...allIds]);
      }
      setDispatchSuccess(`Successfully dispatched ${res.dispatched_count} intervention(s) to Action Center.`);
      setTimeout(() => setDispatchSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || "Failed to dispatch recommendations.");
    } finally {
      setDispatching(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBuilding]);

  // Format trend data for Recharts
  const formattedUtilData = useMemo(() => {
    if (!Array.isArray(utilizationTrends)) return [];
    return utilizationTrends.map((pt) => {
      const d = new Date(pt.timestamp);
      return {
        timestamp: `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.getHours()}:00`,
        utilization: pt.avg_utilization ?? pt.utilization_percent ?? 0,
        occupied: pt.avg_occupancy ?? pt.occupied_spaces ?? 0,
      };
    });
  }, [utilizationTrends]);

  const formattedEnergyData = useMemo(() => {
    if (!Array.isArray(energyTrends)) return [];
    return energyTrends.map((pt) => {
      const d = new Date(pt.timestamp);
      const val = pt.consumption_kwh ?? pt.energy_kwh ?? 0;
      return {
        timestamp: `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.getHours()}:00`,
        energy: Math.round(val * 10) / 10,
        cost: Math.round(pt.cost || 0),
      };
    });
  }, [energyTrends]);

  const filteredRankings = useMemo(() => {
    if (categoryFilter === "all") return rankings;
    return rankings.filter((r) => r.status_category === categoryFilter);
  }, [rankings, categoryFilter]);

  return (
    <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#004E72]">
                Analytics
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500 font-medium">Resource usage and performance</span>
            </div>
            <h1 className="text-2xl font-bold text-[#092634] tracking-tight flex items-center gap-2.5">
              <BarChart3 className="h-6 w-6 text-[#004E72]" />
              Analytics
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Understand how your resources are being used and identify opportunities for optimization.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Building Filter */}
            <div className="relative">
              <select
                value={selectedBuilding}
                onChange={(e) => setSelectedBuilding(e.target.value)}
                className="appearance-none pl-9 pr-8 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue shadow-subtle cursor-pointer"
              >
                <option value="">All Campus Buildings</option>
                {Array.isArray(buildings) &&
                  buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-brand-blue" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-3 shadow-subtle">
            <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* View Switcher: Campus Operational KPIs vs Multi-Source Hybrid Intelligence */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveView("campus")}
              className={`flex items-center gap-2 px-4 py-2 text-xs rounded-lg font-semibold transition-all ${
                activeView === "campus"
                  ? "bg-white text-[#092634] shadow-sm border border-slate-200 font-bold"
                  : "text-slate-600 hover:text-[#092634] hover:bg-white/50"
              }`}
            >
              <BarChart3 className={`h-4 w-4 ${activeView === "campus" ? "text-[#004E72]" : "text-slate-400"}`} />
              <span>Resource Usage</span>
            </button>

            <button
              onClick={() => setActiveView("multi_source")}
              className={`flex items-center gap-2 px-4 py-2 text-xs rounded-lg font-semibold transition-all ${
                activeView === "multi_source"
                  ? "bg-[#092634] text-white shadow-sm font-bold"
                  : "text-slate-600 hover:text-[#092634] hover:bg-white/50"
              }`}
            >
              <Activity className={`h-4 w-4 ${activeView === "multi_source" ? "text-[#FF6E42]" : "text-slate-400"}`} />
              <span>Cross-Source Analysis</span>
            </button>
          </div>
        </div>

        {activeView === "campus" ? (
          <>
            {/* Dynamic KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Utilization Card */}
              <Card className="p-5 border-slate-200 bg-white shadow-subtle hover:border-slate-300 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Institutional Utilization
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-brand-blue">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono text-brand-navy">
                    {summary ? `${summary.overall_utilization_percent}%` : "--"}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    avg across {summary?.total_spaces_analyzed || 0} spaces
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Thresholds:</span>
                  <span className="font-medium text-slate-700">&lt;40% Under | &gt;90% Over</span>
                </div>
              </Card>

              {/* Energy or Scheduled Capacity Card */}
              {summary && summary.total_energy_kwh > 0 ? (
                <Card className="p-5 border-slate-200 bg-white shadow-subtle hover:border-slate-300 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Energy Consumption
                    </span>
                    <div className="h-8 w-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                      <Zap className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold font-mono text-[#092634]">
                      {summary.total_energy_kwh.toLocaleString()}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">kWh</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>Billed Cost:</span>
                    <strong className="text-[#092634] font-mono font-bold">
                      ₹{summary.total_energy_cost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </strong>
                  </div>
                </Card>
              ) : (
                <Card className="p-5 border-slate-200 bg-white shadow-subtle hover:border-slate-300 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Allocated Hours
                    </span>
                    <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#004E72]">
                      <Clock className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold font-mono text-[#092634]">
                      {summary?.total_scheduled_hours ? summary.total_scheduled_hours.toLocaleString() : "--"}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">hours</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>Energy Status:</span>
                    <span className="text-slate-500 text-xs">Telemetry not configured</span>
                  </div>
                </Card>
              )}

              {/* Total Capacity Card */}
              <Card className="p-5 border-slate-200 bg-white shadow-subtle hover:border-slate-300 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Total Capacity
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <Layers className="h-4 w-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono text-[#092634]">
                    {summary?.total_capacity_seats ? summary.total_capacity_seats.toLocaleString() : "--"}
                  </span>
                  <span className="text-xs text-slate-500">total units</span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Monitored Resources:</span>
                  <strong className="text-[#092634] font-mono font-bold">
                    {summary?.total_spaces_analyzed ?? 0}
                  </strong>
                </div>
              </Card>

              {/* Space Distribution */}
              <Card className="p-5 border-slate-200 bg-white shadow-subtle hover:border-slate-300 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status Breakdown
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                    <Layers className="h-4 w-4" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200/60">
                    <div className="text-lg font-bold font-mono text-amber-700">
                      {summary?.underutilized_count ?? 0}
                    </div>
                    <div className="text-[10px] text-amber-800 uppercase tracking-wider font-semibold">
                      &lt;40%
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200/60">
                    <div className="text-lg font-bold font-mono text-emerald-700">
                      {summary?.optimal_count ?? 0}
                    </div>
                    <div className="text-[10px] text-emerald-800 uppercase tracking-wider font-semibold">
                      Optimal
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200/60">
                    <div className="text-lg font-bold font-mono text-rose-700">
                      {summary?.overloaded_count ?? 0}
                    </div>
                    <div className="text-[10px] text-rose-800 uppercase tracking-wider font-semibold">
                      &gt;90%
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Charts Row 1: Time Series Utilization & Energy */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Utilization Trends with Thresholds */}
              <Card className="p-5 border-slate-200 bg-white shadow-subtle">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-brand-navy flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-brand-blue" />
                      Utilization Trend vs Threshold Bounds
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Dynamic time-series occupancy showing 40% underutilized and 90% overloaded boundaries
                    </p>
                  </div>
                </div>

                <div className="h-72 w-full">
                  {formattedUtilData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                      No utilization time-series data available.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={formattedUtilData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="utilGradientLight" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#004E72" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#004E72" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="timestamp"
                          stroke="#64748B"
                          fontSize={11}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          domain={[0, 100]}
                          stroke="#64748B"
                          fontSize={11}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#FFFFFF",
                            borderColor: "#E2E8F0",
                            borderRadius: "8px",
                            color: "#092634",
                            fontSize: "12px",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          }}
                          formatter={(val: any) => [`${val}%`, "Utilization"]}
                        />
                        <ReferenceLine
                          y={40}
                          stroke="#D97706"
                          strokeDasharray="4 4"
                          label={{ value: "Underutilized (40%)", fill: "#D97706", fontSize: 10, position: "insideBottomRight" }}
                        />
                        <ReferenceLine
                          y={90}
                          stroke="#DC2626"
                          strokeDasharray="4 4"
                          label={{ value: "Overloaded (90%)", fill: "#DC2626", fontSize: 10, position: "insideTopRight" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="utilization"
                          stroke="#004E72"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#utilGradientLight)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              {/* Energy Consumption Trend */}
              <Card className="p-5 border-slate-200 bg-white shadow-subtle">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-brand-navy flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-600" />
                      Telemetry Energy &amp; Cost Profile
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Actual energy consumption (kWh) correlated with active room heating and power loads
                    </p>
                  </div>
                </div>

                <div className="h-72 w-full">
                  {formattedEnergyData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                      No energy telemetry records available.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={formattedEnergyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="timestamp"
                          stroke="#64748B"
                          fontSize={11}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          stroke="#64748B"
                          fontSize={11}
                          tickFormatter={(v) => `${v}k`}
                        />
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
                            name === "energy" ? `${val} kWh` : `₹${val}`,
                            name === "energy" ? "Energy" : "Cost",
                          ]}
                        />
                        <Bar dataKey="energy" fill="#FF6E42" radius={[4, 4, 0, 0]} opacity={0.9} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
            </div>

            {/* Charts Row 2: Campus Block Comparison & Diurnal Peak Profile */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Building Comparison */}
              <Card className="p-5 border-slate-200 bg-white shadow-subtle">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-brand-navy flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-brand-blue" />
                      Campus Block Comparison
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Comparison of utilization rate (%) and cumulative energy footprint by building
                    </p>
                  </div>
                </div>

                <div className="h-64 w-full">
                  {buildingAnalytics.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                      No building comparison data available.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={buildingAnalytics}
                        layout="vertical"
                        margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          stroke="#64748B"
                          fontSize={11}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <YAxis
                          dataKey="building_code"
                          type="category"
                          stroke="#64748B"
                          fontSize={11}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#FFFFFF",
                            borderColor: "#E2E8F0",
                            borderRadius: "8px",
                            color: "#092634",
                            fontSize: "12px",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          }}
                          formatter={(val: any, name: any, item: any) => [
                            `${val}% (${item.payload.total_energy_kwh.toLocaleString()} kWh)`,
                            "Avg Utilization",
                          ]}
                        />
                        <Bar dataKey="avg_utilization_percent" fill="#004E72" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              {/* Diurnal Peak Load Distribution */}
              <Card className="p-5 border-slate-200 bg-white shadow-subtle">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-brand-navy flex items-center gap-2">
                      <Clock className="h-4 w-4 text-brand-orange" />
                      Diurnal Peak Demand Profile
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      24-Hour campus load cycle revealing academic core hours vs idle night hours
                    </p>
                  </div>
                </div>

                <div className="h-64 w-full">
                  {peakDemand.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                      No peak demand data available.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={peakDemand}
                        margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="hour_of_day"
                          stroke="#64748B"
                          fontSize={11}
                          tickFormatter={(h) => `${h}:00`}
                        />
                        <YAxis
                          stroke="#64748B"
                          fontSize={11}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#FFFFFF",
                            borderColor: "#E2E8F0",
                            borderRadius: "8px",
                            color: "#092634",
                            fontSize: "12px",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          }}
                          formatter={(val: any, name: any, item: any) => [
                            `${val}% (${item.payload.avg_energy_kwh} kWh)`,
                            "Avg Utilization",
                          ]}
                          labelFormatter={(h) => `${h}:00 Hour Window`}
                        />
                        <Area
                          type="monotone"
                          dataKey="avg_utilization_percent"
                          stroke="#FF6E42"
                          strokeWidth={2}
                          fill="#FF6E42"
                          fillOpacity={0.15}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
            </div>

            {/* Detailed Space Utilization Table & Drilldown */}
            <Card className="border-slate-200 bg-white shadow-subtle overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-[#092634]">Resource Utilization Rankings</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Resources ranked by measured utilization and operational status
                  </p>
                </div>

                {/* Category Filter Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 self-start md:self-auto">
                  <button
                    onClick={() => setCategoryFilter("all")}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                      categoryFilter === "all"
                        ? "bg-white text-brand-navy shadow-sm font-bold border border-slate-200"
                        : "text-slate-600 hover:text-brand-navy"
                    }`}
                  >
                    All ({rankings.length})
                  </button>
                  <button
                    onClick={() => setCategoryFilter("underutilized")}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                      categoryFilter === "underutilized"
                        ? "bg-amber-100/80 text-amber-800 font-bold border border-amber-300"
                        : "text-slate-600 hover:text-brand-navy"
                    }`}
                  >
                    Underutilized (&lt;40%)
                  </button>
                  <button
                    onClick={() => setCategoryFilter("optimal")}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                      categoryFilter === "optimal"
                        ? "bg-emerald-100/80 text-emerald-800 font-bold border border-emerald-300"
                        : "text-slate-600 hover:text-brand-navy"
                    }`}
                  >
                    Optimal (40-90%)
                  </button>
                  <button
                    onClick={() => setCategoryFilter("overloaded")}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                      categoryFilter === "overloaded"
                        ? "bg-rose-100/80 text-rose-800 font-bold border border-rose-300"
                        : "text-slate-600 hover:text-brand-navy"
                    }`}
                  >
                    Overloaded (&gt;90%)
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3">Resource / Room</th>
                      <th className="px-6 py-3">Building</th>
                      <th className="px-6 py-3 text-right">Capacity</th>
                      <th className="px-6 py-3 text-right">Avg Utilization</th>
                      <th className="px-6 py-3 text-right">Total Energy</th>
                      <th className="px-6 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {filteredRankings.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-sans">
                          No spaces match the selected category filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRankings.map((space) => {
                        const statusBadgeVariant =
                          space.status_category === "underutilized"
                            ? "warning"
                            : space.status_category === "overloaded"
                            ? "danger"
                            : "success";

                        return (
                          <tr key={space.resource_id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-3.5 font-sans font-medium text-brand-navy">
                              <div>{space.resource_name}</div>
                              <span className="font-mono text-[11px] text-slate-400">{space.resource_code}</span>
                            </td>
                            <td className="px-6 py-3.5 font-sans text-slate-600">
                              {space.building_name}
                            </td>
                            <td className="px-6 py-3.5 text-right text-slate-600 font-medium">
                              {space.capacity} seats
                            </td>
                            <td className="px-6 py-3.5 text-right font-bold">
                              <span
                                className={
                                  space.avg_utilization_percent < 40
                                    ? "text-amber-600"
                                    : space.avg_utilization_percent > 90
                                    ? "text-rose-600"
                                    : "text-emerald-600"
                                }
                              >
                                {space.avg_utilization_percent}%
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-right text-slate-600">
                              {space.total_energy_kwh.toLocaleString()} kWh
                            </td>
                            <td className="px-6 py-3.5 text-center">
                              <Badge variant={statusBadgeVariant as any} size="sm">
                                {space.status_category.toUpperCase()}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : (
          /* Multi-Source Hybrid Intelligence View (SIH26202) */
          <div className="space-y-6">
            {/* Success Dispatch Alert */}
            {dispatchSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center justify-between shadow-subtle">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <span>{dispatchSuccess}</span>
                </div>
                <Badge variant="success" size="sm">Committed to Action Center</Badge>
              </div>
            )}

            {/* Stream Availability & Provenance Audit Card */}
            <Card className="p-5 border-blue-200 bg-white shadow-subtle">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-50 text-brand-blue border border-blue-200">
                      DATA AVAILABILITY &amp; PROVENANCE AUDIT
                    </span>
                    <Badge variant={multiSourceData?.data_availability.is_sufficient ? "success" : "danger"} size="sm">
                      {multiSourceData?.data_availability.data_sufficiency_status || "CHECKING"}
                    </Badge>
                  </div>
                  <h3 className="text-base font-bold text-brand-navy">
                    Multi-Source Relational &amp; External Telemetry Readiness
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    SIH26202 Verification: Mathematical fusion across 6 relational database tables and authentic Kaggle mirror records.
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  Formula: <span className="text-brand-blue font-bold">CSSI = 0.35·Grid + 0.35·Thermal + 0.30·Spatial</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                {multiSourceData?.data_availability.streams ? (
                  Object.entries(multiSourceData.data_availability.streams).map(([key, info]) => (
                    <div key={key} className="p-3 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold truncate">
                        {key.replace(/_/g, " ")}
                      </div>
                      <div className="text-sm font-mono font-bold text-brand-navy mt-1">
                        {info.record_count.toLocaleString()}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[10px]">
                        <span className="text-slate-500 truncate">{info.source}</span>
                        <span className={info.status === "Available" ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"}>
                          {info.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-6 text-slate-500 text-center py-4 font-sans">Checking stream availability...</div>
                )}
              </div>
            </Card>

            {/* Synchronized 24-Hour Diurnal Multi-Layer Profile */}
            <Card className="p-6 border-slate-200 bg-white shadow-subtle">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="blue">Cross-Source Correlation</Badge>
                    <span className="text-xs font-mono text-slate-500">
                      Telemetry + Scheduling + Grid Data
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-[#092634] tracking-tight">
                    Demand, Operations &amp; Power Overlay
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Combined view showing operational demand, meter power draw, grid load, and correlation indicators across the 24-hour cycle.
                  </p>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#004E72]"></span>
                    <span className="text-slate-600">Regional Grid (MW)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#FF6E42]"></span>
                    <span className="text-slate-600">Campus Power (kWh)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600"></span>
                    <span className="text-slate-600">Scheduled Students</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-600"></span>
                    <span className="text-slate-600">Outdoor Temp (°C)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-4 rounded bg-rose-600"></span>
                    <span className="text-rose-700 font-bold">CSSI Index (x100)</span>
                  </div>
                </div>
              </div>

              <div className="h-80 w-full">
                {multiSourceData?.diurnal_multi_layer_profile && multiSourceData.diurnal_multi_layer_profile.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={multiSourceData.diurnal_multi_layer_profile.map((p) => ({
                        hour: p.hour_label,
                        grid_mw: p.regional_grid_mw,
                        power_kwh: p.campus_power_kwh,
                        students: p.scheduled_enrollment,
                        temp_c: p.air_temperature_c,
                        cssi_scaled: Math.round(p.composite_stress_index * 100),
                      }))}
                      margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="gridMwGradLight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#004E72" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#004E72" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="campusKwhGradLight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FF6E42" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#FF6E42" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="hour" stroke="#64748B" fontSize={11} tickLine={false} />
                      <YAxis
                        yAxisId="power"
                        stroke="#004E72"
                        fontSize={11}
                        domain={["auto", "auto"]}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k MW`}
                      />
                      <YAxis
                        yAxisId="metrics"
                        orientation="right"
                        stroke="#FF6E42"
                        fontSize={11}
                        domain={[0, "auto"]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          borderColor: "#E2E8F0",
                          borderRadius: "8px",
                          color: "#092634",
                          fontSize: "12px",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                        formatter={(val: any, name: any) => {
                          if (name === "grid_mw") return [`${val.toLocaleString()} MW`, "Regional Grid Load"];
                          if (name === "power_kwh") return [`${val.toLocaleString()} kWh`, "Campus Metered Power"];
                          if (name === "students") return [`${val} students`, "Scheduled Enrollment Density"];
                          if (name === "temp_c") return [`${val}°C`, "Outdoor Ambient Temperature"];
                          if (name === "cssi_scaled") return [`${(val / 100).toFixed(3)}`, "Composite Stress Index (CSSI)"];
                          return [val, name];
                        }}
                      />
                      <Area yAxisId="power" type="monotone" dataKey="grid_mw" stroke="#004E72" strokeWidth={2} fill="url(#gridMwGradLight)" />
                      <Area yAxisId="metrics" type="monotone" dataKey="power_kwh" stroke="#FF6E42" strokeWidth={2} fill="url(#campusKwhGradLight)" />
                      <Line yAxisId="metrics" type="monotone" dataKey="students" stroke="#16A34A" strokeWidth={2} dot={false} />
                      <Line yAxisId="metrics" type="monotone" dataKey="temp_c" stroke="#D97706" strokeWidth={2} dot={false} />
                      <Line yAxisId="metrics" type="monotone" dataKey="cssi_scaled" stroke="#DC2626" strokeWidth={2.5} strokeDasharray="4 4" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                    No diurnal profile records available. Import telemetry or grid dataset.
                  </div>
                )}
              </div>
            </Card>

            {/* Empirical 5x5 Cross-Source Correlation Heatmap */}
            <Card className="p-6 border-slate-200 bg-white shadow-subtle">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="navy">EMPIRICAL BIVARIATE COUPLING</Badge>
                    <span className="text-xs font-mono text-slate-500">
                      N = {multiSourceData?.cross_source_correlation?.sample_size || 0} Aligned Timestamps
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-brand-navy">
                    Cross-Source Pearson Correlation Matrix (5 × 5)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Empirically calculated Pearson r coefficients across timetable enrollment, campus electrical demand, Wi-Fi occupancy, ambient temperature, and regional grid load.
                  </p>
                </div>
              </div>

              {multiSourceData?.cross_source_correlation ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="p-2.5 text-left text-slate-500 uppercase font-semibold">Variables</th>
                        {multiSourceData.cross_source_correlation.feature_labels.map((label, idx) => (
                          <th key={idx} className="p-2.5 text-center text-slate-700 font-semibold max-w-[120px]">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {multiSourceData.cross_source_correlation.matrix.map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-slate-100 hover:bg-slate-50/60">
                          <td className="p-2.5 text-left text-brand-navy font-semibold">{row.label}</td>
                          {row.values.map((val, cIdx) => {
                            const isDiag = rIdx === cIdx;
                            const isHigh = val >= 0.60;
                            const isMed = val >= 0.30 && val < 0.60;
                            let bgClass = "bg-slate-50 text-slate-600 border border-slate-200";
                            if (isDiag) bgClass = "bg-blue-100/70 text-brand-blue font-bold border border-blue-300";
                            else if (isHigh) bgClass = "bg-emerald-100/70 text-emerald-800 font-bold border border-emerald-300";
                            else if (isMed) bgClass = "bg-amber-100/70 text-amber-800 font-semibold border border-amber-300";

                            return (
                              <td key={cIdx} className="p-2.5 text-center">
                                <span className={`inline-block px-2.5 py-1 rounded-md ${bgClass}`}>
                                  {val >= 0 ? `+${val.toFixed(3)}` : val.toFixed(3)}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Key Insights Callout */}
                  <div className="mt-4 p-3.5 rounded-lg bg-blue-50/50 border border-blue-100 space-y-1.5 text-xs text-slate-700">
                    <div className="font-bold text-brand-navy flex items-center gap-1.5 mb-1">
                      <Info className="h-4 w-4 text-brand-blue" />
                      <span>Physical Cross-Coupling Findings:</span>
                    </div>
                    {multiSourceData.cross_source_correlation.key_insights.map((insight, idx) => (
                      <div key={idx} className="text-slate-600 flex items-start gap-2">
                        <span className="text-brand-blue font-bold">•</span>
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm">
                  Correlation matrix unavailable. Insufficient historical observations.
                </div>
              )}
            </Card>

            {/* High-Stress Timetable Collisions & Load-Shifting Dispatch */}
            <Card className="p-6 border-slate-200 bg-white shadow-subtle">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="warning">Optimization Candidates</Badge>
                    <span className="text-xs font-mono text-slate-500">
                      Identified: {multiSourceData?.timetable_stress_collisions.length || 0} peak conflicts
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#092634]">
                    Peak Load &amp; Capacity Bottlenecks
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Operational allocations during peak grid rates, high thermal load hours, or significant capacity mismatches.
                  </p>
                </div>

                {/* Threshold selector & Dispatch All */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
                    <span className="text-slate-500 font-medium">CSSI Threshold:</span>
                    {[0.30, 0.45, 0.50, 0.60].map((th) => (
                      <button
                        key={th}
                        onClick={() => handleThresholdChange(th)}
                        className={`px-2 py-0.5 rounded font-mono font-bold transition-colors ${
                          cssiThreshold === th
                            ? "bg-brand-blue text-white shadow-xs"
                            : "text-slate-600 hover:text-brand-navy"
                        }`}
                      >
                        {th.toFixed(2)}
                      </button>
                    ))}
                  </div>

                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => handleDispatch()}
                    disabled={dispatching || !multiSourceData?.timetable_stress_collisions.length}
                    className="flex items-center gap-2 text-xs font-bold"
                  >
                    <Send className={`h-3.5 w-3.5 ${dispatching ? "animate-spin" : ""}`} />
                    Dispatch All to Action Center
                  </Button>
                </div>
              </div>

              {/* Collisions Grid */}
              {multiSourceData?.timetable_stress_collisions && multiSourceData.timetable_stress_collisions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {multiSourceData.timetable_stress_collisions.map((c) => {
                    const isDispatched = dispatchedCollisionIds.includes(c.collision_id);
                    const curr = c.current_room;
                    const cand = c.candidate_room;

                    return (
                      <div
                        key={c.collision_id}
                        className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-subtle transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant={c.cssi >= 0.55 ? "danger" : "warning"} size="sm" className="font-mono font-bold">
                              CSSI: {c.cssi.toFixed(3)}
                            </Badge>
                            <span className="text-[11px] font-mono text-slate-500">
                              {c.day_of_week} • {c.start_time}-{c.end_time}
                            </span>
                          </div>

                          <h4 className="font-bold text-brand-navy text-sm tracking-tight">{c.subject_name}</h4>
                          <p className="text-xs text-slate-500">{c.department}</p>

                          {/* Current room details */}
                          <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                            <div className="flex items-center justify-between text-slate-600">
                              <span>Current Space:</span>
                              <span className="font-mono font-semibold text-brand-navy">{curr.name} ({curr.code})</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-500 text-[11px] mt-1 font-mono">
                              <span>Floor {curr.floor} • Cap {curr.capacity}</span>
                              <span>Enrolled: {c.expected_occupancy} ({c.current_utilization_percent}%)</span>
                            </div>
                          </div>

                          {/* Stress Drivers Breakdown */}
                          <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono">
                            <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                              <div className="text-slate-500">Grid Stress</div>
                              <div className="text-brand-blue font-bold">{c.stress_drivers.grid_stress_index.toFixed(2)}</div>
                            </div>
                            <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                              <div className="text-slate-500">Thermal Heat</div>
                              <div className="text-amber-600 font-bold">{c.stress_drivers.thermal_stress_index.toFixed(2)}</div>
                            </div>
                            <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                              <div className="text-slate-500">Spatial Gap</div>
                              <div className="text-rose-600 font-bold">{c.stress_drivers.spatial_mismatch_index.toFixed(2)}</div>
                            </div>
                          </div>

                          {/* Proposed Intervention */}
                          <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200/80 text-xs">
                            <div className="text-emerald-800 font-bold flex items-center gap-1.5">
                              <ArrowRightLeft className="h-3.5 w-3.5 text-emerald-600" />
                              <span>{cand ? "Relocate to Room:" : "Thermal Action:"}</span>
                            </div>
                            <div className="font-mono text-brand-navy font-semibold text-xs mt-1">
                              {cand ? `${cand.name} (${cand.code}) • Floor ${cand.floor} (Cap ${cand.capacity})` : "HVAC Pre-Cooling Coasting"}
                            </div>
                            <div className="text-[11px] text-emerald-700 font-mono mt-1 font-semibold">
                              Saves ~{c.estimated_savings.energy_reduction_kwh} kWh/hr • ₹{c.estimated_savings.tariff_savings_inr}/session
                            </div>
                          </div>
                        </div>

                        {/* Action button */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-mono">Verified Feasibility</span>
                          <Button
                            variant={isDispatched ? "outline" : "secondary"}
                            size="sm"
                            onClick={() => handleDispatch(c.collision_id)}
                            disabled={isDispatched || dispatching}
                            className="text-xs flex items-center gap-1.5"
                          >
                            {isDispatched ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Dispatched</span>
                              </>
                            ) : (
                              <>
                                <Send className="h-3.5 w-3.5 text-brand-blue" />
                                <span>Dispatch Action</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No high-stress timetable collisions detected above threshold {cssiThreshold.toFixed(2)}. All scheduled sessions operate within acceptable grid and thermal boundaries.
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
  );
}
