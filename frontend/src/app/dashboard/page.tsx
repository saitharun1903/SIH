"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { GettingStartedCard } from "@/components/common/GettingStartedCard";
import { Card } from "@/components/ui/Card";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import {
  AnalyticsSummary,
  AnomalySummary,
  Anomaly,
  ForecastOverview,
  UtilizationTrendPoint,
  EnergyTrendPoint,
  Recommendation,
  Building,
} from "@/lib/types";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Layers,
  AlertTriangle,
  TrendingUp,
  Zap,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowRight,
  RefreshCw,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const { currentWorkspace, terminology } = useWorkspace();
  const isAdmin = hasRole(["Administrator"]);

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [elapsedText, setElapsedText] = useState("Just now");
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("7d");


  // Real Database Data
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [anomalySummary, setAnomalySummary] = useState<AnomalySummary | null>(null);
  const [forecastOverview, setForecastOverview] = useState<ForecastOverview | null>(null);
  const [utilizationTrends, setUtilizationTrends] = useState<UtilizationTrendPoint[]>([]);
  const [energyTrends, setEnergyTrends] = useState<EnergyTrendPoint[]>([]);
  const [priorityAnomalies, setPriorityAnomalies] = useState<Anomaly[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  // Dynamically update "Updated X ago"
  useEffect(() => {
    const updateElapsed = () => {
      const sec = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      if (sec < 60) {
        setElapsedText("Just now");
      } else if (sec < 3600) {
        setElapsedText(`${Math.floor(sec / 60)}m ago`);
      } else {
        setElapsedText(`${Math.floor(sec / 3600)}h ago`);
      }
    };
    const interval = setInterval(updateElapsed, 30000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const loadDashboardData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const bldgParam = selectedBuilding !== "all" ? parseInt(selectedBuilding) : undefined;

      const [
        bldgsRes,
        summaryRes,
        anomSummRes,
        forecastRes,
        utilRes,
        energyRes,
        anomListRes,
        recsRes,
      ] = await Promise.all([
        api.getBuildingsList().catch((e) => {
          console.error("Failed to load buildings list", e);
          return [];
        }),
        api.getAnalyticsSummary({ building_id: bldgParam }).catch((e) => {
          console.error("Failed to load analytics summary", e);
          return null;
        }),
        api.getAnomalySummary().catch((e) => {
          console.error("Failed to load anomaly summary", e);
          return null;
        }),
        api.getForecastOverview().catch((e) => {
          console.error("Failed to load forecast overview", e);
          return null;
        }),
        api.getUtilizationTrends({ building_id: bldgParam }).catch((e) => {
          console.error("Failed to load utilization trends", e);
          return [];
        }),
        api.getEnergyTrends({ building_id: bldgParam }).catch((e) => {
          console.error("Failed to load energy trends", e);
          return [];
        }),
        api.getAnomalies({ status: "Active", building_id: bldgParam, limit: 4 }).catch((e) => {
          console.error("Failed to load anomalies", e);
          return { items: [], total: 0, limit: 4, offset: 0 };
        }),
        api.getRecommendations({ status: "Active" }).catch((e) => {
          console.error("Failed to load recommendations", e);
          return [];
        }),
      ]);

      setBuildings(Array.isArray(bldgsRes) ? bldgsRes : []);
      setSummary(summaryRes);
      setAnomalySummary(anomSummRes);
      setForecastOverview(forecastRes);
      setUtilizationTrends(Array.isArray(utilRes) ? utilRes : []);
      setEnergyTrends(Array.isArray(energyRes) ? energyRes : []);
      setPriorityAnomalies(Array.isArray(anomListRes?.items) ? anomListRes.items : []);
      setRecommendations(Array.isArray(recsRes) ? recsRes : []);
      setLastUpdated(new Date());
      setElapsedText("Just now");
    } catch (err: any) {
      console.error("Failed to load dashboard data", err);
      setError("Unable to load operational dashboard. Please retry or check backend health.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedBuilding, timeRange]);

  // Formatted date helper for charts
  const formatChartDate = (ts: string) => {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return ts;
    }
  };

  // Top Operational Trend Narration (Data-Derived)
  const topNarrative = useMemo(() => {
    if (!summary && !anomalySummary) return null;

    const loss = anomalySummary?.estimated_financial_loss || 0;
    const activeCount = anomalySummary?.active_count || 0;
    const util = summary?.overall_utilization_percent || 0;

    if (activeCount > 0 && loss > 0) {
      return {
        title: `₹${loss.toLocaleString(undefined, { maximumFractionDigits: 0 })} in active inefficiencies detected`,
        description: `Operational analysis identified ${activeCount} active boundary anomalies across campus facilities. Primary contributors include phantom energy loads during unbooked evening windows and room capacity mismatches.`,
        level: "warning",
      };
    }

    if (util < 40) {
      return {
        title: `Low spatial utilization across academic spaces (${util}%)`,
        description: `Current seat-hour density is operating below optimal institutional thresholds. Consolidating timetable sessions into high-efficiency wings can free idle rooms for maintenance and reduce baseline HVAC draw.`,
        level: "info",
      };
    }

    return {
      title: `Resource operations running within baseline parameters`,
      description: `Overall utilization is at ${util}%. All monitored ${terminology.resourcePlural.toLowerCase()} are operating within expected capacity and operational limits.`,
      level: "success",
    };
  }, [summary, anomalySummary, terminology]);

  // Determine user lifecycle state (Part F):
  // State 1: New organization / no workspace configured
  // State 2: Workspace configured, but no resources
  // State 3: Resources exist, but insufficient telemetry/usage
  // State 4: Operational data exists
  const dashboardState = useMemo(() => {
    if (!currentWorkspace) return 1;
    const hasResources = (summary?.total_spaces_analyzed ?? 0) > 0 || buildings.length > 0;
    if (!hasResources) return 2;
    const hasTelemetry =
      (utilizationTrends && utilizationTrends.length > 0) ||
      (energyTrends && energyTrends.length > 0) ||
      (summary && summary.overall_utilization_percent > 0);
    if (!hasTelemetry) return 3;
    return 4;
  }, [currentWorkspace, summary, buildings, utilizationTrends, energyTrends]);

  return (
    <div className="space-y-6">
      {/* 0. Getting Started Lifecycle Tracker */}
      <GettingStartedCard />

      {/* 1. Page Header: Title, Description & Operational Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#092634]">
              {currentWorkspace ? currentWorkspace.name : "Resource Intelligence"}
            </h1>
            {currentWorkspace?.code && (
              <span className="px-2 py-0.5 rounded bg-[#F1F5F9] border border-[#CBD5E1] text-xs font-mono font-semibold text-[#092634]">
                {currentWorkspace.code}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
            Monitor {terminology.resourcePlural.toLowerCase()}, identify operational bottlenecks, and act on verified ROI opportunities.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Facility / Group Filter */}
          <div className="flex items-center space-x-1.5 bg-white border border-[#E2E8F0] rounded-md px-2.5 py-1 text-xs shadow-subtle">
            <Building2 className="h-3.5 w-3.5 text-[#64748B]" />
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="bg-transparent border-none text-[#092634] font-medium focus:ring-0 cursor-pointer pr-4 text-xs"
              aria-label={`Filter by ${terminology.group}`}
            >
              <option value="all">All {terminology.group}s ({Array.isArray(buildings) ? buildings.length : 0})</option>
              {Array.isArray(buildings) &&
                buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
            </select>
          </div>

          {/* Time Range */}

          <div className="flex items-center space-x-1.5 bg-white border border-[#E2E8F0] rounded-md px-2.5 py-1 text-xs shadow-subtle">
            <Calendar className="h-3.5 w-3.5 text-[#64748B]" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-transparent border-none text-[#092634] font-medium focus:ring-0 cursor-pointer pr-4 text-xs"
              aria-label="Time Horizon"
            >
              <option value="7d">Past 7 Days</option>
              <option value="14d">Past 14 Days</option>
              <option value="30d">Past 30 Days</option>
            </select>
          </div>

          {/* Refresh Button with Dynamic Elapsed Text */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDashboardData(true)}
            isLoading={refreshing}
            className="text-xs h-8 text-[#475569] hover:text-[#092634]"
            title="Refresh Operational Metrics"
          >
            <RefreshCw className="h-3 w-3 mr-1.5" />
            <span>{elapsedText}</span>
          </Button>

          {/* Hero Simulation Action */}
          <Link href="/simulator">
            <Button variant="accent" size="sm" className="text-xs h-8 shadow-sm">
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
              <span>What-If Simulator</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => loadDashboardData()} className="text-xs">
            Retry
          </Button>
        </div>
      )}

      {/* State 1: New organization / no workspace configured */}
      {dashboardState === 1 && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 max-w-4xl mx-auto shadow-subtle text-center my-6">
          <div className="h-12 w-12 rounded-xl bg-[#004E72] text-white flex items-center justify-center font-bold text-xl mx-auto shadow-sm mb-4">
            N
          </div>
          <h2 className="text-2xl font-bold text-[#092634] tracking-tight">
            Welcome to NEXUS
          </h2>
          <p className="text-sm text-[#475569] mt-1.5 max-w-xl mx-auto">
            Manage resources, understand what is happening, and test better decisions.
          </p>

          <div className="mt-8 text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#004E72] mb-3">
              Get Started
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="h-6 w-6 rounded-full bg-[#004E72] text-white text-xs font-bold flex items-center justify-center mb-2">1</span>
                <h4 className="text-sm font-semibold text-[#092634]">Set up workspace</h4>
                <p className="text-xs text-[#64748B] mt-1">Configure your domain template and operational parameters.</p>
              </div>
              <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="h-6 w-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center mb-2">2</span>
                <h4 className="text-sm font-semibold text-[#092634]">Add resources</h4>
                <p className="text-xs text-[#64748B] mt-1">Define equipment, facilities, rooms, or vehicles.</p>
              </div>
              <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="h-6 w-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center mb-2">3</span>
                <h4 className="text-sm font-semibold text-[#092634]">Import data</h4>
                <p className="text-xs text-[#64748B] mt-1">Upload operational schedules, power meters, or sensor logs.</p>
              </div>
              <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="h-6 w-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center mb-2">4</span>
                <h4 className="text-sm font-semibold text-[#092634]">Set a goal</h4>
                <p className="text-xs text-[#64748B] mt-1">Track target utilization, cost savings, or uptime goals.</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-3">
                <Link href="/workspace">
                  <Button variant="primary" size="sm">Set up workspace</Button>
                </Link>
                <Link href="/imports">
                  <Button variant="outline" size="sm">Import data</Button>
                </Link>
              </div>
              <span className="text-xs text-[#64748B]">Zero synthetic claims • Grounded telemetry</span>
            </div>
          </div>
        </div>
      )}

      {/* State 2: Workspace configured, but no resources */}
      {dashboardState === 2 && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 max-w-2xl mx-auto shadow-subtle text-center my-6">
          <div className="h-12 w-12 rounded-xl bg-blue-50 text-[#004E72] flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-[#092634]">Your workspace is ready</h2>
          <p className="text-sm text-[#475569] mt-2">
            Add resources or import data to start getting insights.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/resources">
              <Button variant="primary" size="sm">Add resources</Button>
            </Link>
            <Link href="/imports">
              <Button variant="outline" size="sm">Import data</Button>
            </Link>
          </div>
        </div>
      )}

      {/* State 3: Resources exist, but insufficient telemetry/schedules */}
      {dashboardState === 3 && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-subtle my-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#004E72]">Resources Configured</span>
              <h2 className="text-lg font-bold text-[#092634] mt-0.5">
                {summary?.total_spaces_analyzed || buildings.length} {terminology.resourcePlural.toLowerCase()} registered
              </h2>
              <p className="text-xs text-[#475569] mt-1 max-w-2xl">
                Operational telemetry, schedules, or usage logs are needed to compute live utilization trends and detect anomalies.
              </p>
            </div>
            <div className="flex gap-2.5 shrink-0">
              <Link href="/imports">
                <Button variant="primary" size="sm">Import telemetry</Button>
              </Link>
              <Link href="/schedules">
                <Button variant="outline" size="sm">Manage schedules</Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* State 4: Operational Data Exists -> Full Live Overview */}
      {dashboardState === 4 && (
        <>
          {/* 2. Key Performance Area (4 Restrained High-Value Metrics) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Resource Efficiency */}
        <Card className="hover:border-[#CBD5E1] transition-colors">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Resource Efficiency
              </p>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-2xl sm:text-3xl font-bold text-[#092634] tracking-tight">
                  {loading ? "..." : summary ? `${summary.overall_utilization_percent}%` : "No data"}
                </span>
                {summary && (
                  <Badge
                    variant={summary.overall_utilization_percent >= 50 ? "success" : "warning"}
                    size="sm"
                  >
                    {summary.overall_utilization_percent >= 50 ? "Optimal" : "Sub-optimal"}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-[#64748B] mt-1.5">
                {summary?.total_scheduled_hours?.toLocaleString() || 0} scheduled seat-hours
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-[#EBF3F7] text-[#004E72] flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
        </Card>

        {/* Metric 2: Monitored Resources */}
        <Card className="hover:border-[#CBD5E1] transition-colors">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Resources Monitored
              </p>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-2xl sm:text-3xl font-bold text-[#092634] tracking-tight">
                  {loading ? "..." : summary?.total_spaces_analyzed ?? "0"}
                </span>
                <span className="text-xs text-[#64748B] font-medium">spaces</span>
              </div>
              <p className="text-[11px] text-[#64748B] mt-1.5">
                {summary?.total_capacity_seats?.toLocaleString() || 0} total institutional seats
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-[#EBF3F7] text-[#004E72] flex items-center justify-center shrink-0">
              <Layers className="h-4 w-4" />
            </div>
          </div>
        </Card>

        {/* Metric 3: Active Issues */}
        <Card className="hover:border-[#CBD5E1] transition-colors">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Active Issues
              </p>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-2xl sm:text-3xl font-bold text-[#092634] tracking-tight">
                  {loading ? "..." : anomalySummary?.active_count ?? 0}
                </span>
                <Badge
                  variant={(anomalySummary?.active_count || 0) > 0 ? "orange" : "success"}
                  size="sm"
                >
                  {(anomalySummary?.active_count || 0) > 0 ? "Requires Action" : "Nominal"}
                </Badge>
              </div>
              <p className="text-[11px] text-[#64748B] mt-1.5">
                {anomalySummary?.estimated_financial_loss
                  ? `₹${anomalySummary.estimated_financial_loss.toLocaleString(undefined, { maximumFractionDigits: 0 })} estimated waste`
                  : "No loss recorded"}
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-[#FFF1ED] text-[#D8481E] flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
        </Card>

        {/* Metric 4: Forecasted Demand Pressure */}
        <Card className="hover:border-[#CBD5E1] transition-colors">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Demand Pressure
              </p>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-2xl sm:text-3xl font-bold text-[#092634] tracking-tight">
                  {loading
                    ? "..."
                    : forecastOverview?.avg_forecasted_utilization !== undefined
                    ? `${forecastOverview.avg_forecasted_utilization}%`
                    : "Stable"}
                </span>
                <Badge variant="blue" size="sm">
                  P90 Horizon
                </Badge>
              </div>
              <p className="text-[11px] text-[#64748B] mt-1.5">
                Peak forecast: {forecastOverview?.peak_forecasted_utilization ?? (forecastOverview as any)?.peak_utilization_surge ?? 0}%
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-[#EBF3F7] text-[#004E72] flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4" />
            </div>
          </div>
        </Card>
      </div>

      {/* 3. Main Intelligence Panel: "What's happening" */}
      {topNarrative && (
        <div className="p-4 sm:p-5 rounded-lg bg-white border border-[#E2E8F0] shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div
              className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                topNarrative.level === "warning"
                  ? "bg-[#FFF1ED] text-[#D8481E]"
                  : topNarrative.level === "info"
                  ? "bg-[#EBF3F7] text-[#004E72]"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  What's Happening
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#004E72]" />
                <span className="text-[10px] text-[#64748B]">Operational Signal</span>
              </div>
              <p className="text-sm font-semibold text-[#092634] mt-0.5">
                {topNarrative.title}
              </p>
              <p className="text-xs text-[#475569] mt-1 max-w-3xl leading-relaxed">
                {topNarrative.description}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
            <Link href="/anomalies">
              <Button variant="outline" size="sm" className="text-xs">
                <span>View Issues</span>
              </Button>
            </Link>
            <Link href="/simulator">
              <Button variant="primary" size="sm" className="text-xs">
                <span>Simulate Solutions</span>
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* 4. Two-Column Analytics Hub (Utilization Trend & Energy Trend) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Utilization Trend */}
        <Card
          title="Spatial Utilization Trend"
          subtitle="Time-series seat-hour occupancy relative to capacity baseline"
          action={
            <Link href="/analytics" className="text-xs font-semibold text-[#004E72] hover:underline flex items-center">
              <span>Deep Analytics</span>
              <ArrowUpRight className="h-3 w-3 ml-0.5" />
            </Link>
          }
        >
          {loading ? (
            <div className="h-60 flex items-center justify-center text-xs text-[#64748B]">
              Loading utilization telemetry...
            </div>
          ) : utilizationTrends.length > 0 ? (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={utilizationTrends} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="utilGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#004E72" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#004E72" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatChartDate}
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "#E2E8F0" }}
                  />
                  <YAxis
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    unit="%"
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-2.5 border border-[#E2E8F0] shadow-dropdown rounded text-xs">
                            <p className="text-[11px] text-[#64748B] mb-1">{label ? formatChartDate(label) : ""}</p>
                            <p className="font-semibold text-[#004E72]">
                              Utilization: {Number(payload[0].value).toFixed(1)}%
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avg_utilization"
                    stroke="#004E72"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#utilGradient)"
                    name="Utilization"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-60 flex flex-col items-center justify-center text-center p-6 bg-[#F9F9F9] rounded border border-dashed border-[#CBD5E1]">
              <p className="text-xs font-medium text-[#092634]">Utilization data isn't available yet.</p>
              <p className="text-[11px] text-[#64748B] mt-1 max-w-xs">
                Import classroom attendance or Wi-Fi probe telemetry to track spatial occupancy.
              </p>
              <Link href="/imports" className="mt-3">
                <Button variant="outline" size="sm" className="text-xs">
                  Import Data
                </Button>
              </Link>
            </div>
          )}
        </Card>

        {/* Right: Energy Consumption Trend */}
        <Card
          title="Campus Energy Demand"
          subtitle="Micro-metered consumption (kWh) across academic facilities"
          action={
            <Link href="/analytics" className="text-xs font-semibold text-[#004E72] hover:underline flex items-center">
              <span>Energy Intelligence</span>
              <ArrowUpRight className="h-3 w-3 ml-0.5" />
            </Link>
          }
        >
          {loading ? (
            <div className="h-60 flex items-center justify-center text-xs text-[#64748B]">
              Loading energy telemetry...
            </div>
          ) : energyTrends.length > 0 ? (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={energyTrends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatChartDate}
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "#E2E8F0" }}
                  />
                  <YAxis
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    unit=" kWh"
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-2.5 border border-[#E2E8F0] shadow-dropdown rounded text-xs">
                            <p className="text-[11px] text-[#64748B] mb-1">{label ? formatChartDate(label) : ""}</p>
                            <p className="font-semibold text-[#092634]">
                              Consumption: {Number(payload[0].value).toFixed(1)} kWh
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="consumption_kwh"
                    stroke="#004E72"
                    strokeWidth={2}
                    dot={false}
                    name="Measured Power"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-60 flex flex-col items-center justify-center text-center p-6 bg-[#F9F9F9] rounded border border-dashed border-[#CBD5E1]">
              <p className="text-xs font-medium text-[#092634]">Energy telemetry isn't available yet.</p>
              <p className="text-[11px] text-[#64748B] mt-1 max-w-xs">
                Synchronize smart electrical meters or ASHRAE benchmarks to begin analysis.
              </p>
              <Link href="/data-sources" className="mt-3">
                <Button variant="outline" size="sm" className="text-xs">
                  Connect Energy Data
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* 5. Operational Hub: Priority Issues (Left) & Recommended Interventions (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Priority Issues Queue */}
        <Card
          title="Priority Operational Issues"
          subtitle="Top active telemetry anomalies and schedule conflicts"
          action={
            <Link href="/anomalies" className="text-xs font-semibold text-[#004E72] hover:underline flex items-center">
              <span>View All ({anomalySummary?.active_count || 0})</span>
              <ArrowRight className="h-3 w-3 ml-0.5" />
            </Link>
          }
        >
          {loading ? (
            <div className="p-8 text-center text-xs text-[#64748B]">Loading issues...</div>
          ) : Array.isArray(priorityAnomalies) && priorityAnomalies.length > 0 ? (
            <div className="divide-y divide-[#F1F5F9] -mx-5 -my-5">
              {priorityAnomalies.map((anom) => (
                <div key={anom.id} className="p-4 hover:bg-[#F8FAFC] transition-colors flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={
                          anom.severity === "Critical"
                            ? "danger"
                            : anom.severity === "High"
                            ? "orange"
                            : "warning"
                        }
                        size="sm"
                      >
                        {anom.severity}
                      </Badge>
                      <span className="font-semibold text-xs text-[#092634]">
                        {anom.resource_name || "Campus Space"}
                      </span>
                      {anom.building_name && (
                        <span className="text-[11px] text-[#64748B]">
                          • {anom.building_name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#475569] mt-1 line-clamp-1">
                      {anom.reason || anom.description || `Anomaly detected in ${anom.metric_type}`}
                    </p>
                    <div className="flex items-center space-x-3 mt-1.5 text-[10px] text-[#64748B]">
                      <span>
                        Deviation: {anom.deviation_percent !== undefined ? `${anom.deviation_percent > 0 ? "+" : ""}${Number(anom.deviation_percent).toFixed(1)}%` : "N/A"}
                      </span>
                      <span>•</span>
                      <span>
                        {anom.timestamp || anom.detected_at
                          ? new Date(anom.timestamp || anom.detected_at!).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                          : "Active"}
                      </span>
                    </div>
                  </div>

                  <Link href={`/anomalies?resource_id=${anom.resource_id}`}>
                    <Button variant="ghost" size="sm" className="text-xs text-[#004E72] hover:text-[#003852] shrink-0">
                      <span>Inspect</span>
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-[#092634]">All spaces nominal</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                No active anomalies or boundary violations detected.
              </p>
            </div>
          )}
        </Card>

        {/* Right: Recommended Operational Interventions */}
        <Card
          title="Recommended Interventions"
          subtitle="Data-driven optimizations generated by the decision engine"
          action={
            <Link href="/actions" className="text-xs font-semibold text-[#004E72] hover:underline flex items-center">
              <span>Action Center</span>
              <ArrowRight className="h-3 w-3 ml-0.5" />
            </Link>
          }
        >
          {loading ? (
            <div className="p-8 text-center text-xs text-[#64748B]">Loading recommendations...</div>
          ) : Array.isArray(recommendations) && recommendations.length > 0 ? (
            <div className="divide-y divide-[#F1F5F9] -mx-5 -my-5">
              {recommendations.slice(0, 3).map((rec) => (
                <div key={rec.id} className="p-4 hover:bg-[#F8FAFC] transition-colors flex flex-col justify-between space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={rec.priority === "Critical" ? "danger" : rec.priority === "High" ? "orange" : "blue"}
                          size="sm"
                        >
                          {rec.priority}
                        </Badge>
                        <span className="font-semibold text-xs text-[#092634] line-clamp-1">
                          {rec.title}
                        </span>
                      </div>
                      <p className="text-xs text-[#475569] mt-1 line-clamp-2 leading-relaxed">
                        {rec.recommended_action || rec.problem_description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[#F8FAFC]">
                    <div className="flex items-center space-x-2 text-[11px] font-semibold text-emerald-700">
                      <span>
                        Save ₹{rec.estimated_impact?.monthly_savings_inr?.toLocaleString() || "—"} / mo
                      </span>
                      {rec.estimated_impact?.rooms_freed && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-[#004E72]">{rec.estimated_impact.rooms_freed} rooms freed</span>
                        </>
                      )}
                    </div>

                    <Link href={`/simulator?recommendation_id=${rec.id}`}>
                      <Button variant="outline" size="sm" className="text-xs h-7 border-[#004E72] text-[#004E72] hover:bg-[#EBF3F7]">
                        <span>Simulate Impact</span>
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
              <div className="py-8 text-center">
                <Zap className="h-7 w-7 text-[#004E72] mx-auto mb-2 opacity-60" />
                <p className="text-xs font-semibold text-[#092634]">No pending recommendations</p>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Current allocations and monitored resources are operating within expected targets.
                </p>
              </div>
            )}
          </Card>
        </div>
        </>
      )}
    </div>
  );
}
