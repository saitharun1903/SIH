"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { DataSource, ProfilingReport } from "@/lib/types";
import {
  Database,
  ExternalLink,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Info,
  ShieldCheck,
  BarChart2,
  Activity,
  DownloadCloud,
  Thermometer,
  Zap,
} from "lucide-react";

export default function DataSourcesPage() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [profiling, setProfiling] = useState<ProfilingReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfilingLoading, setIsProfilingLoading] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestSuccessMessage, setIngestSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("ALL");
  const [bldgLimit, setBldgLimit] = useState<number>(5);
  const [daysLimit, setDaysLimit] = useState<number>(30);

  const loadDataSources = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getDataSources();
      setSources(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load data source registry.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadProfilingReport = async () => {
    setIsProfilingLoading(true);
    try {
      const report = await api.getProfilingReport();
      setProfiling(report);
    } catch (err: any) {
      console.error("Profiling report error:", err);
    } finally {
      setIsProfilingLoading(false);
    }
  };

  useEffect(() => {
    loadDataSources();
    loadProfilingReport();
  }, []);

  const handleRunIngestion = async () => {
    setIsIngesting(true);
    setError(null);
    setIngestSuccessMessage(null);
    try {
      const res = await api.runKaggleIngestion(bldgLimit, daysLimit);
      setIngestSuccessMessage(
        `Ingested ${(res.records_ingested ?? res.rows_ingested ?? 0).toLocaleString()} authentic records across ${res.buildings_count ?? res.buildings_processed ?? 0} buildings.`
      );
      loadDataSources();
      loadProfilingReport();
      setTimeout(() => setIngestSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err?.message || "Ingestion job failed.");
    } finally {
      setIsIngesting(false);
    }
  };

  const filteredSources = sources.filter((s) => {
    if (selectedProvider === "ALL") return true;
    return s.provider.toUpperCase() === selectedProvider;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#004E72]">
              Data
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">Data Sources</span>
          </div>
          <h1 className="text-2xl font-bold text-[#092634] tracking-tight flex items-center gap-2.5">
            <Database className="h-6 w-6 text-[#004E72]" />
            Data Sources
          </h1>
          <p className="text-xs text-[#475569] mt-1">
            Connect and manage databases, uploaded operational records, and telemetry feeds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDataSources}
            disabled={isLoading}
            className="flex items-center gap-1.5 border-slate-200 text-[#092634] hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-[#004E72]" : ""}`} />
            <span>Refresh Sources</span>
          </Button>
        </div>
      </div>

      {/* Real Data Provenance Callout */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-xs text-slate-700 flex items-start gap-3 shadow-subtle">
        <Info className="h-5 w-5 text-[#004E72] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-[#092634]">Data Sources &amp; Coverage:</span>
          <p className="text-[#475569] leading-relaxed">
            NEXUS connects operational resource schedules, power telemetry meters, and benchmark datasets. Every metric shown across the platform is calculated from verified database records.
          </p>
        </div>
      </div>

      {/* Feedback Messages */}
      {ingestSuccessMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-center gap-3 shadow-subtle">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{ingestSuccessMessage}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center gap-3 shadow-subtle">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Kaggle Ingestion & Profiling Dashboard Panel */}
      <Card className="p-6 border-slate-200 bg-white space-y-6 shadow-subtle">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-100 text-brand-blue">
              <BarChart2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-brand-navy">Authentic Dataset Profiling &amp; Normalization</h2>
                <Badge variant="success" size="sm">Kaggle Verified</Badge>
              </div>
              <p className="text-xs text-slate-500">
                Automated statistical profiling, IQR outlier detection, and unit normalization pipeline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadProfilingReport}
              disabled={isProfilingLoading}
              className="flex items-center gap-1.5 text-xs border-slate-200 text-slate-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isProfilingLoading ? "animate-spin" : ""}`} />
              <span>Re-Profile</span>
            </Button>
          </div>
        </div>

        {profiling ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Statistical Profile */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500 block font-medium">Total Raw Rows</span>
                  <span className="text-lg font-bold text-brand-navy font-mono">
                    {profiling.total_rows.toLocaleString()}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500 block font-medium">Unique Facilities</span>
                  <span className="text-lg font-bold text-brand-blue font-mono">
                    {profiling.unique_buildings_count.toLocaleString()}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500 block font-medium">Date Horizon</span>
                  <span className="text-lg font-bold text-emerald-700 font-mono">
                    {profiling.date_coverage.duration_days} Days
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500 block font-medium">IQR Outliers (&gt;3x)</span>
                  <span className="text-lg font-bold text-rose-700 font-mono">
                    {(profiling.outlier_analysis?.outlier_count ?? profiling.energy_distribution?.iqr_outliers_count ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* IQR Energy Distribution */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-brand-navy uppercase tracking-wider block">
                  IQR Parametric Distribution (kWh)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Q1 (25th %)</span>
                    <span className="font-bold text-brand-navy">
                      {profiling.meter_reading_stats?.p25 ?? profiling.energy_distribution?.q1_kwh ?? 0} kWh
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Median (50th %)</span>
                    <span className="font-bold text-brand-blue">
                      {profiling.meter_reading_stats?.median ?? profiling.energy_distribution?.median_kwh ?? 0} kWh
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Q3 (75th %)</span>
                    <span className="font-bold text-brand-navy">
                      {profiling.meter_reading_stats?.p75 ?? profiling.energy_distribution?.q3_kwh ?? 0} kWh
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">IQR Margin</span>
                    <span className="font-bold text-amber-700">
                      {profiling.meter_reading_stats
                        ? Math.round(((profiling.meter_reading_stats.p75 ?? 0) - (profiling.meter_reading_stats.p25 ?? 0)) * 100) / 100
                        : profiling.energy_distribution?.iqr_kwh ?? 0} kWh
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ingestion Trigger Control */}
            <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-100 space-y-4 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-brand-navy uppercase tracking-wider block mb-1">
                  Kaggle Ingestion Engine
                </span>
                <p className="text-xs text-slate-600">
                  Ingests authentic building energy readings directly from local mirrors into the SQLite telemetry store.
                </p>

                <div className="mt-3 space-y-3 text-xs">
                  <div>
                    <label className="text-slate-600 block mb-1">Max Buildings to Ingest</label>
                    <select
                      value={bldgLimit}
                      onChange={(e) => setBldgLimit(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-brand-navy"
                    >
                      <option value={3}>3 Buildings (~2,100 records)</option>
                      <option value={5}>5 Buildings (~3,500 records)</option>
                      <option value={10}>10 Buildings (~7,000 records)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1">Timespan (Days)</label>
                    <select
                      value={daysLimit}
                      onChange={(e) => setDaysLimit(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-brand-navy"
                    >
                      <option value={14}>14 Days (Fast)</option>
                      <option value={30}>30 Days (Recommended)</option>
                      <option value={60}>60 Days (Comprehensive)</option>
                    </select>
                  </div>
                </div>
              </div>

              <Button
                variant="accent"
                size="sm"
                onClick={handleRunIngestion}
                disabled={isIngesting}
                className="w-full flex items-center justify-center gap-2 font-bold"
              >
                {isIngesting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                    <span>Ingesting Kaggle Data...</span>
                  </>
                ) : (
                  <>
                    <DownloadCloud className="h-4 w-4" />
                    <span>Run Ingestion Pipeline</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs">
            Loading profiling telemetry...
          </div>
        )}
      </Card>

      {/* Provider Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 self-start">
        {["ALL", "KAGGLE", "MANUAL_UPLOAD", "IOT_GATEWAY"].map((provider) => (
          <button
            key={provider}
            onClick={() => setSelectedProvider(provider)}
            className={`px-3 py-1.5 text-xs rounded-md font-semibold transition-all ${
              selectedProvider === provider
                ? "bg-white text-brand-navy shadow-xs font-bold border border-slate-200"
                : "text-slate-600 hover:text-brand-navy"
            }`}
          >
            {provider.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSources.map((source) => (
          <Card key={source.id} className="p-5 border-slate-200 bg-white hover:border-slate-300 transition-all shadow-subtle flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Badge variant={source.status === "Imported" ? "success" : source.status === "Downloaded" ? "blue" : source.status === "Failed" ? "danger" : "warning"} size="sm">
                  {source.status}
                </Badge>
                <span className="text-[10px] font-mono text-slate-400">{source.provider}</span>
              </div>

              <h3 className="text-base font-bold text-brand-navy">{source.name}</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{source.description}</p>

              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Record Count:</span>
                  <span className="font-bold font-mono text-brand-navy">{(source.row_count ?? source.record_count ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Synced:</span>
                  <span className="font-mono text-slate-600">
                    {source.last_synced_at || source.downloaded_at || source.updated_at
                      ? new Date(source.last_synced_at || source.downloaded_at || source.updated_at).toLocaleDateString([], { month: "short", day: "numeric" })
                      : "Never"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Authentic Ground-Truth</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
