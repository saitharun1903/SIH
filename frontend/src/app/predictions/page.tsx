"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import {
  ForecastResponse,
  ForecastOverview,
  Building,
  Resource,
  MacroGridProfile,
} from "@/lib/types";
import {
  TrendingUp,
  Zap,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Sparkles,
  Layers,
  Building2,
  Brain,
  ShieldCheck,
  Activity,
  Thermometer,
  CloudSun,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export default function PredictionsPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Configuration States
  const [metricName, setMetricName] = useState<"utilization" | "occupancy" | "energy">("utilization");
  const [horizon, setHorizon] = useState<"1d" | "7d" | "30d">("7d");
  const [selectedBuilding, setSelectedBuilding] = useState<string>("");
  const [selectedResource, setSelectedResource] = useState<string>("");

  // Options
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);

  // Forecast Data
  const [overview, setOverview] = useState<ForecastOverview | null>(null);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);

  // Regional Macro Grid & Weather State (PJM & NOAA Mirror)
  const [macroProfile, setMacroProfile] = useState<MacroGridProfile | null>(null);
  const [showMacroPanel, setShowMacroPanel] = useState<boolean>(false);

  // Load selection options
  useEffect(() => {
    Promise.all([
      api.getBuildingsList().catch(() => []),
      api.getResourcesList().catch(() => []),
      api.getForecastOverview().catch(() => null),
      api.getMacroGridTrends().catch(() => null),
    ])
      .then(([bldgs, resList, overData, macroData]) => {
        setBuildings(Array.isArray(bldgs) ? bldgs : []);
        setResources(Array.isArray(resList) ? resList : []);
        setOverview(overData);
        if (macroData) setMacroProfile(macroData);
      })
      .catch((err) => console.error("Initial load failed:", err));
  }, []);

  const loadForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const bId = selectedBuilding ? parseInt(selectedBuilding) : undefined;
      const rId = selectedResource ? parseInt(selectedResource) : undefined;

      const data = await api.getForecast({
        resource_id: rId,
        building_id: bId,
        metric_name: metricName,
        horizon: horizon,
      });
      setForecastData(data);
    } catch (err: any) {
      setError(err.message || "Failed to compute forecast.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForecast();
  }, [metricName, horizon, selectedBuilding, selectedResource]);

  // Combine historical and future forecast into single continuous time series
  const combinedChartData = useMemo(() => {
    if (!forecastData) return [];

    const hist = forecastData.historical.map((pt) => {
      const d = new Date(pt.timestamp);
      return {
        timestamp: `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.getHours()}:00`,
        actual: pt.actual_value as number | null,
        predicted: null as number | null,
        lower_bound: null as number | null,
        upper_bound: null as number | null,
        isFuture: false,
      };
    });

    const fut = forecastData.forecast.map((pt) => {
      const d = new Date(pt.target_timestamp || pt.timestamp || Date.now());
      return {
        timestamp: `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.getHours()}:00`,
        actual: null as number | null,
        predicted: pt.predicted_value as number | null,
        lower_bound: pt.lower_bound as number | null,
        upper_bound: pt.upper_bound as number | null,
        isFuture: true,
      };
    });

    if (hist.length > 0 && fut.length > 0) {
      const lastHist = hist[hist.length - 1];
      fut[0].actual = lastHist.actual;
    }

    return [...hist, ...fut];
  }, [forecastData]);

  // Extract peak stress forecasted intervals (>80% utilization)
  const stressPeriods = useMemo(() => {
    if (!forecastData || metricName !== "utilization") return [];
    return forecastData.forecast
      .filter((pt) => pt.predicted_value >= 80.0)
      .slice(0, 5);
  }, [forecastData, metricName]);

  const getMetricUnit = () => {
    switch (metricName) {
      case "utilization":
        return "%";
      case "occupancy":
        return " persons";
      case "energy":
        return " kWh";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-blue">
              Predictive Intelligence
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">Quantile Gradient Boosted Trees</span>
          </div>
          <h1 className="text-2xl font-bold text-brand-navy tracking-tight flex items-center gap-2.5">
            <Brain className="h-6 w-6 text-brand-blue" />
            Demand &amp; Utilization Forecasting Engine
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Quantile Gradient Boosted Trees (P10, P50, P90) projecting future spatial demand, timetable stress, and electrical energy loads.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-brand-blue text-xs font-mono">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Telemetry: 14-Day Ground-Truth</span>
          </div>

          <Button
            variant={showMacroPanel ? "primary" : "outline"}
            size="sm"
            onClick={() => setShowMacroPanel(!showMacroPanel)}
            className="flex items-center gap-2 border-slate-200"
          >
            <Activity className="h-4 w-4 text-brand-blue" />
            <span>Regional Grid &amp; Weather</span>
            {macroProfile && (
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-brand-blue font-mono font-bold">
                r = +{macroProfile.correlations.temperature_vs_grid_load.toFixed(2)}
              </span>
            )}
            {showMacroPanel ? (
              <ChevronUp className="h-3.5 w-3.5 text-slate-500 ml-0.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-slate-500 ml-0.5" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadForecast}
            disabled={loading}
            className="flex items-center gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-brand-blue" : ""}`} />
            <span>Re-Calculate</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center gap-3 shadow-subtle">
          <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Dynamic Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Average Forecasted Load */}
        <Card className="p-5 border-slate-200 bg-white shadow-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Projected Avg Load
            </span>
            <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-brand-blue">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold font-mono text-brand-navy">
              {forecastData
                ? (forecastData.metrics.predicted_avg ?? (forecastData.forecast.length > 0 ? forecastData.forecast.reduce((a, b) => a + (b.predicted_value || 0), 0) / forecastData.forecast.length : 0)).toFixed(1)
                : "--"}
            </span>
            <span className="text-xs font-semibold text-slate-500">{getMetricUnit()}</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Across {horizon} planning horizon
          </div>
        </Card>

        {/* Peak Forecasted Interval */}
        <Card className="p-5 border-slate-200 bg-white shadow-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Projected Peak Load
            </span>
            <div className="h-8 w-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold font-mono text-amber-700">
              {forecastData
                ? (forecastData.metrics.predicted_peak ?? (forecastData.forecast.length > 0 ? Math.max(...forecastData.forecast.map((f) => f.predicted_value || 0)) : 0)).toFixed(1)
                : "--"}
            </span>
            <span className="text-xs font-semibold text-slate-500">{getMetricUnit()}</span>
          </div>
          <div className="mt-2 text-xs text-amber-800 font-medium">
            P90 Upper Bound: {forecastData ? (forecastData.metrics.confidence_bounds?.upper ?? (forecastData.forecast.length > 0 ? Math.max(...forecastData.forecast.map((f) => f.upper_bound || 0)) : 0)).toFixed(1) : "--"}{getMetricUnit()}
          </div>
        </Card>

        {/* Forecast Accuracy / MAPE */}
        <Card className="p-5 border-slate-200 bg-white shadow-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Model Accuracy (1 - MAPE)
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold font-mono text-emerald-700">
              {forecastData ? `${(100 - forecastData.metrics.mape).toFixed(1)}%` : "--"}
            </span>
          </div>
          <div className="mt-2 text-xs text-emerald-800 font-medium">
            Tested on {forecastData?.historical.length || 0} telemetry intervals
          </div>
        </Card>

        {/* High Stress Windows */}
        <Card className="p-5 border-slate-200 bg-white shadow-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Projected Stress Events
            </span>
            <div className="h-8 w-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold font-mono text-rose-700">
              {stressPeriods.length}
            </span>
            <span className="text-xs text-slate-500">critical windows</span>
          </div>
          <div className="mt-2 text-xs text-rose-700 font-medium">
            {stressPeriods.length > 0 ? "Potential timetable bottleneck" : "Optimal headroom across horizon"}
          </div>
        </Card>
      </div>

      {/* Regional Macro Grid & Weather Auxiliary Panel */}
      {showMacroPanel && macroProfile && (
        <Card className="p-5 border-blue-200 bg-blue-50/40 shadow-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-100 pb-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <CloudSun className="h-4 w-4 text-brand-blue" />
                <h3 className="text-sm font-bold text-brand-navy">
                  Regional Grid Macro Profile &amp; Climate Telemetry
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Data fused from PJM Hourly Electricity Load (Kaggle) &amp; NOAA Global Surface Temperature Mirror.
              </p>
            </div>
            <div className="text-xs font-mono text-brand-blue bg-white px-3 py-1 rounded-lg border border-blue-200">
              Provider: {macroProfile.dataset_name || "PJM Regional Grid"}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-white rounded-lg border border-blue-100">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Grid Avg Load</span>
              <div className="text-base font-bold font-mono text-brand-navy mt-0.5">
                {(macroProfile.statistics?.mean_grid_load_mw ?? 0).toLocaleString()} MW
              </div>
              <span className="text-[10px] text-slate-500">Peak: {(macroProfile.statistics?.max_grid_load_mw ?? 0).toLocaleString()} MW</span>
            </div>

            <div className="p-3 bg-white rounded-lg border border-blue-100">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Ambient Temperature</span>
              <div className="text-base font-bold font-mono text-amber-700 mt-0.5">
                {macroProfile.statistics?.mean_temperature_c ?? 22}°C
              </div>
              <span className="text-[10px] text-slate-500">
                Range: {macroProfile.statistics?.temperature_range_c?.min ?? 14}°C – {macroProfile.statistics?.temperature_range_c?.max ?? 31}°C
              </span>
            </div>

            <div className="p-3 bg-white rounded-lg border border-blue-100">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Temp / Grid Correlation</span>
              <div className="text-base font-bold font-mono text-emerald-700 mt-0.5">
                +{(macroProfile.correlations?.temperature_vs_grid_load ?? 0.72).toFixed(3)}
              </div>
              <span className="text-[10px] text-emerald-800">{macroProfile.correlations?.hvac_cooling_driver || "Thermal cooling driver"}</span>
            </div>

            <div className="p-3 bg-white rounded-lg border border-blue-100">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Temporal Coverage</span>
              <div className="text-xs font-mono text-slate-700 mt-1 font-semibold">
                Peak Hours: {macroProfile.grid_peak_hours?.join(", ") || "12, 13, 14, 15, 16"}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">N = {(macroProfile.total_records ?? 1440).toLocaleString()} samples</span>
            </div>
          </div>
        </Card>
      )}

      {/* Configuration & Filter Bar */}
      <Card className="p-4 border-slate-200 bg-white shadow-subtle">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Metric Selector */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Target Metric
            </label>
            <select
              value={metricName}
              onChange={(e) => setMetricName(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            >
              <option value="utilization">Space Utilization (%)</option>
              <option value="occupancy">Occupancy Headcount (Persons)</option>
              <option value="energy">Billed Energy Draw (kWh)</option>
            </select>
          </div>

          {/* Horizon Selector */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Planning Horizon
            </label>
            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            >
              <option value="1d">Next 24 Hours (Operational)</option>
              <option value="7d">Next 7 Days (Tactical Scheduling)</option>
              <option value="30d">Next 30 Days (Strategic Term)</option>
            </select>
          </div>

          {/* Building Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Building Filter
            </label>
            <select
              value={selectedBuilding}
              onChange={(e) => {
                setSelectedBuilding(e.target.value);
                setSelectedResource("");
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            >
              <option value="">Campus Aggregation (All)</option>
              {Array.isArray(buildings) &&
                buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
            </select>
          </div>

          {/* Resource Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Specific Room Filter
            </label>
            <select
              value={selectedResource}
              onChange={(e) => setSelectedResource(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            >
              <option value="">All Rooms in Selection</option>
              {Array.isArray(resources) &&
                resources
                  .filter((r) => !selectedBuilding || r.building_id === parseInt(selectedBuilding))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} - {r.name}
                    </option>
                  ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Main Forecast Chart */}
      <Card className="p-6 border-slate-200 bg-white shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-brand-navy flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-blue" />
              Quantile Trajectory Projection with Confidence Band
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical actuals transitioned into P10-P50-P90 forecast bounds
            </p>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#004E72]"></span>
              <span className="text-slate-600">Historical Actuals</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF6E42]"></span>
              <span className="text-slate-600">P50 Median Forecast</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded bg-[#FF6E42]/20 border border-[#FF6E42]/40"></span>
              <span className="text-slate-600">P10 – P90 Uncertainty</span>
            </div>
          </div>
        </div>

        <div className="h-80 w-full">
          {combinedChartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              No forecast points computed for this configuration.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={combinedChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="quantileGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6E42" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#FF6E42" stopOpacity={0.05} />
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
                  stroke="#64748B"
                  fontSize={11}
                  tickFormatter={(v) => (metricName === "utilization" ? `${v}%` : `${v}`)}
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
                    if (val === null || val === undefined) return [null, null];
                    if (name === "actual") return [`${Number(val).toFixed(1)}${getMetricUnit()}`, "Historical Actual"];
                    if (name === "predicted") return [`${Number(val).toFixed(1)}${getMetricUnit()}`, "P50 Predicted"];
                    if (name === "upper_bound") return [`${Number(val).toFixed(1)}${getMetricUnit()}`, "P90 Upper Bound"];
                    if (name === "lower_bound") return [`${Number(val).toFixed(1)}${getMetricUnit()}`, "P10 Lower Bound"];
                    return [val, name];
                  }}
                />

                {metricName === "utilization" && (
                  <ReferenceLine
                    y={80}
                    stroke="#D97706"
                    strokeDasharray="4 4"
                    label={{ value: "Stress Warning (80%)", fill: "#D97706", fontSize: 10, position: "insideTopRight" }}
                  />
                )}

                {/* Shaded P10-P90 Bound Area */}
                <Area
                  type="monotone"
                  dataKey="upper_bound"
                  stroke="transparent"
                  fill="url(#quantileGrad)"
                />

                {/* Actual Historical Line */}
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#004E72"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls={false}
                />

                {/* Forecast P50 Line */}
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#FF6E42"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Stress Windows Advisory */}
      {stressPeriods.length > 0 && (
        <Card className="p-5 border-amber-200 bg-amber-50/50 shadow-subtle">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <h3 className="text-sm font-bold text-amber-900">
              Anticipated High-Demand Stress Intervals (&gt;80% Saturation)
            </h3>
          </div>
          <p className="text-xs text-amber-800 mb-3">
            Gradient boosted forecasting indicates scheduled lecture densities exceeding optimal comfort and ventilation margins in the coming cycle:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs font-mono">
            {stressPeriods.map((pt, idx) => {
              const d = new Date(pt.target_timestamp || pt.timestamp || Date.now());
              return (
                <div key={idx} className="p-2.5 rounded-lg bg-white border border-amber-200 shadow-xs">
                  <div className="text-[11px] text-slate-500 font-sans">
                    {d.toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" })}
                  </div>
                  <div className="text-base font-bold text-amber-900 mt-0.5">
                    {pt.predicted_value.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-amber-700 font-sans mt-0.5">
                    Window: {d.getHours()}:00 - {d.getHours() + 1}:00
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
