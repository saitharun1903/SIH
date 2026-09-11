"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  Resource,
  AnalyticsSummary,
  UtilizationTrendPoint,
  EnergyTrendPoint,
  Schedule,
  Anomaly,
  PaginatedResponse,
} from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  Layers,
  Building2,
  Users,
  Maximize2,
  TrendingUp,
  Zap,
  DollarSign,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export default function ResourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const resourceId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [resource, setResource] = useState<Resource | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [utilTrends, setUtilTrends] = useState<UtilizationTrendPoint[]>([]);
  const [energyTrends, setEnergyTrends] = useState<EnergyTrendPoint[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);

  // Active Tab: "telemetry" | "schedule" | "anomalies" | "specs"
  const [activeTab, setActiveTab] = useState<"telemetry" | "schedule" | "anomalies" | "specs">("telemetry");

  const loadResourceData = async () => {
    if (!resourceId) return;
    setLoading(true);
    setError(null);
    try {
      const idNum = parseInt(resourceId);

      const [resData, summaryData, utilData, nrgData, schedData, anomData] = await Promise.all([
        api.get<Resource>(`/resources/${idNum}`),
        api.get<AnalyticsSummary>(`/analytics/summary?resource_id=${idNum}`).catch(() => null),
        api.get<UtilizationTrendPoint[]>(`/analytics/utilization-trends?resource_id=${idNum}`).catch(() => []),
        api.get<EnergyTrendPoint[]>(`/analytics/energy-trends?resource_id=${idNum}`).catch(() => []),
        api.get<PaginatedResponse<Schedule>>(`/schedules?resource_id=${idNum}&page_size=100`).catch(() => ({ items: [] } as any)),
        api.get<{ items: Anomaly[] }>(`/anomalies?resource_id=${idNum}&limit=50`).catch(() => ({ items: [] })),
      ]);

      setResource(resData);
      setSummary(summaryData);
      setUtilTrends(Array.isArray(utilData) ? utilData : []);
      setEnergyTrends(Array.isArray(nrgData) ? nrgData : []);
      setSchedules(Array.isArray(schedData?.items) ? schedData.items : []);
      setAnomalies(Array.isArray(anomData?.items) ? anomData.items : []);
    } catch (err: any) {
      setError(err.message || "Failed to load resource profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResourceData();
  }, [resourceId]);

  // Formatted Chart Data
  const formattedUtilData = useMemo(() => {
    if (!Array.isArray(utilTrends)) return [];
    return utilTrends.map((pt) => {
      const d = new Date(pt.timestamp);
      return {
        timestamp: `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.getHours()}:00`,
        utilization: pt.avg_utilization ?? pt.utilization_percent ?? 0,
        occupied: pt.avg_occupancy ?? pt.occupied_spaces ?? 0,
      };
    });
  }, [utilTrends]);

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

  // Compute total weekly scheduled hours
  const weeklyScheduledHours = useMemo(() => {
    return schedules.reduce((acc, s) => {
      const startParts = s.start_time.split(":").map(Number);
      const endParts = s.end_time.split(":").map(Number);
      const durationHours = (endParts[0] + endParts[1] / 60) - (startParts[0] + startParts[1] / 60);
      return acc + Math.max(0, durationHours);
    }, 0);
  }, [schedules]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500">
        <div className="h-8 w-8 border-3 border-brand-blue border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Retrieving institutional space telemetry...</p>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="space-y-6">
        <Link
          href="/resources"
          className="inline-flex items-center gap-2 text-xs font-semibold text-brand-blue hover:text-brand-navy"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Campus Resources</span>
        </Link>
        <Card className="p-8 border-rose-200 bg-rose-50 text-center">
          <AlertTriangle className="h-8 w-8 text-rose-600 mx-auto mb-2" />
          <h2 className="text-base font-bold text-rose-900">Resource Not Found</h2>
          <p className="text-xs text-rose-700 mt-1">{error || `No space found matching ID ${resourceId}`}</p>
          <Button variant="outline" size="sm" onClick={() => router.push("/resources")} className="mt-4">
            Return to Inventory
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link
              href="/resources"
              className="text-xs font-semibold text-brand-blue hover:underline flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Campus Resources</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-mono font-bold text-brand-navy">{resource.code}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-navy flex items-center gap-3">
            <span>{resource.name}</span>
            <Badge
              variant={
                resource.status === "Active"
                  ? "success"
                  : resource.status === "Maintenance"
                  ? "warning"
                  : "danger"
              }
              size="md"
            >
              {resource.status}
            </Badge>
          </h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <span>{resource.building_name || "Campus Block"}</span>
            <span className="text-slate-300">•</span>
            <span>Floor {resource.floor}</span>
            <span className="text-slate-300">•</span>
            <span>{resource.location || "Wing A"}</span>
            <span className="text-slate-300">•</span>
            <span className="font-mono">{resource.resource_type_name || "Space"}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadResourceData}
            className="flex items-center gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5 text-brand-blue" />
            <span>Refresh</span>
          </Button>

          <Link href={`/simulator?target_room=${resource.code}`}>
            <Button variant="accent" size="sm" className="font-bold flex items-center gap-1.5">
              <span>Simulate Relocation</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Utilization */}
        <Card className="p-5 border-slate-200 bg-white shadow-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Average Utilization
            </span>
            <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-brand-blue">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-brand-navy">
              {summary ? `${summary.overall_utilization_percent}%` : "--"}
            </span>
            <Badge
              variant={
                (summary?.overall_utilization_percent || 0) < 40
                  ? "warning"
                  : (summary?.overall_utilization_percent || 0) > 90
                  ? "danger"
                  : "success"
              }
              size="sm"
            >
              {(summary?.overall_utilization_percent || 0) < 40
                ? "Underutilized"
                : (summary?.overall_utilization_percent || 0) > 90
                ? "Overloaded"
                : "Optimal"}
            </Badge>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Capacity Target:</span>
            <span className="font-semibold text-brand-navy">{resource.capacity} seats</span>
          </div>
        </Card>

        {/* Energy Consumed */}
        <Card className="p-5 border-slate-200 bg-white shadow-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Metered Energy
            </span>
            <div className="h-8 w-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-brand-navy">
              {summary ? summary.total_energy_kwh.toLocaleString() : "--"}
            </span>
            <span className="text-xs font-semibold text-slate-500">kWh</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Room Load:</span>
            <span className="font-semibold text-brand-navy font-mono">
              {summary ? `${summary.energy_per_occupied_hour} kWh` : "--"}/hr
            </span>
          </div>
        </Card>

        {/* Billed Cost */}
        <Card className="p-5 border-slate-200 bg-white shadow-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Cumulative Cost
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-brand-navy">
              ₹{summary ? summary.total_energy_cost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : "--"}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Tariff Rate:</span>
            <span className="font-semibold text-slate-700">₹8.50 / kWh</span>
          </div>
        </Card>

        {/* Scheduled Sessions */}
        <Card className="p-5 border-slate-200 bg-white shadow-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Weekly Allocation
            </span>
            <div className="h-8 w-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-brand-navy">
              {schedules.length}
            </span>
            <span className="text-xs font-medium text-slate-500">sessions</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Operating Hours:</span>
            <span className="font-semibold text-brand-navy font-mono">
              {weeklyScheduledHours.toFixed(1)} hrs/week
            </span>
          </div>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <div className="flex space-x-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("telemetry")}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === "telemetry"
                ? "border-brand-blue text-brand-navy font-bold"
                : "border-transparent text-slate-500 hover:text-brand-navy"
            }`}
          >
            <TrendingUp className="h-4 w-4 text-brand-blue" />
            <span>Telemetry &amp; Trends</span>
          </button>

          <button
            onClick={() => setActiveTab("schedule")}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === "schedule"
                ? "border-brand-blue text-brand-navy font-bold"
                : "border-transparent text-slate-500 hover:text-brand-navy"
            }`}
          >
            <Calendar className="h-4 w-4 text-brand-blue" />
            <span>Weekly Timetable ({schedules.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("anomalies")}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === "anomalies"
                ? "border-brand-blue text-brand-navy font-bold"
                : "border-transparent text-slate-500 hover:text-brand-navy"
            }`}
          >
            <ShieldAlert className="h-4 w-4 text-brand-orange" />
            <span>Issues &amp; Anomalies ({anomalies.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("specs")}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === "specs"
                ? "border-brand-blue text-brand-navy font-bold"
                : "border-transparent text-slate-500 hover:text-brand-navy"
            }`}
          >
            <Info className="h-4 w-4 text-slate-400" />
            <span>Specifications &amp; Hardware</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Telemetry & Trends */}
      {activeTab === "telemetry" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5 border-slate-200 bg-white shadow-subtle">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-brand-navy flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-brand-blue" />
                  Occupancy &amp; Utilization Curve
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Time-series utilization observed in {resource.code}
                </p>
              </div>
            </div>

            <div className="h-72 w-full">
              {formattedUtilData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No time-series occupancy records logged for this space.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={formattedUtilData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="resUtilGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#004E72" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#004E72" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="timestamp" stroke="#64748B" fontSize={11} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} stroke="#64748B" fontSize={11} tickFormatter={(v) => `${v}%`} />
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
                    <ReferenceLine y={40} stroke="#D97706" strokeDasharray="4 4" />
                    <ReferenceLine y={90} stroke="#DC2626" strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="utilization" stroke="#004E72" strokeWidth={2} fill="url(#resUtilGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card className="p-5 border-slate-200 bg-white shadow-subtle">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-brand-navy flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-600" />
                  Electrical Load Telemetry
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sub-metered energy draw (kWh) across operational intervals
                </p>
              </div>
            </div>

            <div className="h-72 w-full">
              {formattedEnergyData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No electrical sub-meter telemetry recorded for this space.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formattedEnergyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="timestamp" stroke="#64748B" fontSize={11} tickLine={false} interval="preserveStartEnd" />
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
                      formatter={(val: any) => [`${val} kWh`, "Energy"]}
                    />
                    <Bar dataKey="energy" fill="#FF6E42" radius={[4, 4, 0, 0]} opacity={0.9} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Weekly Schedule */}
      {activeTab === "schedule" && (
        <Card className="p-0 border-slate-200 bg-white shadow-subtle overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-brand-navy">Weekly Timetable Schedule</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                All scheduled courses, lectures, and laboratory sessions allocated to {resource.code}
              </p>
            </div>
            <Badge variant="blue" size="sm">
              {schedules.length} Active Slots
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Day &amp; Time</th>
                  <th className="px-5 py-3">Subject / Course</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Instructor</th>
                  <th className="px-5 py-3 text-right">Enrollment</th>
                  <th className="px-5 py-3 text-right">Capacity Match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {schedules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-500 font-sans">
                      No timetable sessions currently scheduled in this room.
                    </td>
                  </tr>
                ) : (
                  schedules.map((s) => {
                    const utilPct = Math.round((s.expected_occupancy / (resource.capacity || 1)) * 100);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5 font-sans">
                          <div className="font-bold text-brand-navy">{s.day_of_week}</div>
                          <div className="text-[11px] font-mono text-slate-500">{s.start_time} - {s.end_time}</div>
                        </td>
                        <td className="px-5 py-3.5 font-sans">
                          <div className="font-semibold text-brand-navy">{s.subject_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{s.subject_code || "--"}</div>
                        </td>
                        <td className="px-5 py-3.5 font-sans text-slate-600">
                          {s.department}
                        </td>
                        <td className="px-5 py-3.5 font-sans text-slate-600">
                          {s.instructor || "Faculty Staff"}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-brand-navy">
                          {s.expected_occupancy} <span className="text-[10px] text-slate-400 font-normal">students</span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span
                            className={`font-bold ${
                              utilPct < 40 ? "text-amber-600" : utilPct > 90 ? "text-rose-600" : "text-emerald-600"
                            }`}
                          >
                            {utilPct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Anomalies & Issues */}
      {activeTab === "anomalies" && (
        <Card className="p-0 border-slate-200 bg-white shadow-subtle overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-brand-navy">Anomalies &amp; Operational Issues</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Isolation Forest and Physical Energy Rule violations detected in {resource.code}
              </p>
            </div>
            <Badge variant={anomalies.length > 0 ? "warning" : "success"} size="sm">
              {anomalies.length} Flagged Incidents
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Detected Timestamp</th>
                  <th className="px-5 py-3">Anomaly Type</th>
                  <th className="px-5 py-3">Severity</th>
                  <th className="px-5 py-3">Contributing Factors</th>
                  <th className="px-5 py-3 text-right">Estimated Waste</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {anomalies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-500 font-sans">
                      <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                      <div className="font-bold text-brand-navy">Zero Operational Anomalies</div>
                      <div className="text-xs text-slate-400 mt-1">This room is operating within normal energy and capacity bounds.</div>
                    </td>
                  </tr>
                ) : (
                  anomalies.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-slate-600">
                        {new Date(a.timestamp || a.detected_at || a.created_at || Date.now()).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-brand-navy">
                        {a.anomaly_type.replace(/_/g, " ").toUpperCase()}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={
                            a.severity === "Critical"
                              ? "danger"
                              : a.severity === "High"
                              ? "warning"
                              : "blue"
                          }
                          size="sm"
                        >
                          {a.severity}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate font-mono text-xs">
                        {a.contributing_factors && a.contributing_factors.length > 0
                          ? a.contributing_factors.map((f: any) => typeof f === 'string' ? f : f.factor).join(', ')
                          : "Statistical power outlier"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-rose-600">
                        ₹{Math.round(a.estimated_waste_cost ?? (a.metric_type === 'energy' ? Math.max(0, (a.actual_value - a.expected_value) * 8.5) : 0)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <Badge variant="neutral" size="sm">
                          {a.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 4: Specifications & Metadata */}
      {activeTab === "specs" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-5 border-slate-200 bg-white shadow-subtle space-y-4">
            <h3 className="text-base font-bold text-brand-navy border-b border-slate-100 pb-2">
              Physical Space Specifications
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Official Code:</span>
                <span className="font-mono font-bold text-brand-navy">{resource.code}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Display Name:</span>
                <span className="font-semibold text-brand-navy">{resource.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Resource Category:</span>
                <span className="font-medium text-brand-navy">{resource.resource_type_name || "Space"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Assigned Building:</span>
                <span className="font-semibold text-brand-navy">{resource.building_name} ({resource.building_code})</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Floor Level:</span>
                <span className="font-medium text-brand-navy">Floor {resource.floor}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Total Seating Capacity:</span>
                <span className="font-bold text-brand-navy font-mono">{resource.capacity} seats</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Floor Surface Area:</span>
                <span className="font-medium text-brand-navy font-mono">{resource.area} sq ft</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Campus Wing / Location:</span>
                <span className="font-medium text-brand-navy">{resource.location}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-slate-200 bg-white shadow-subtle space-y-4">
            <h3 className="text-base font-bold text-brand-navy border-b border-slate-100 pb-2">
              Telemetry &amp; Hardware Infrastructure
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Sub-Metered Electrical Feed:</span>
                <span className="font-mono text-emerald-700 font-bold">SM-MET-{resource.code.replace(/[^a-zA-Z0-9]/g, "")}-01</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Wi-Fi Telemetry Sensor:</span>
                <span className="font-mono text-slate-700">AP-WIFI-{resource.building_code || "BLD"}-F{resource.floor}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">HVAC Control Zone:</span>
                <span className="font-medium text-slate-700">VAV Zone {resource.floor}-{resource.location}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Isolation Forest Contamination:</span>
                <span className="font-mono text-slate-700">5.0% (Adaptive)</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Telemetry Sampling Rate:</span>
                <span className="font-medium text-slate-700">60-minute synchronized intervals</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
