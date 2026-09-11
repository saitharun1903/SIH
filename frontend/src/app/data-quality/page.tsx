"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  CheckCircle2,
  AlertTriangle,
  Database,
  Calendar,
  Layers,
  Activity,
  Download,
  Clock,
  ShieldCheck,
  TrendingUp,
  FileSpreadsheet,
  Zap,
} from "lucide-react";
import clsx from "clsx";

interface ImportJob {
  id: number;
  dataset_id: number;
  dataset_name?: string;
  status: string;
  rows_processed: number;
  rows_imported: number;
  rows_rejected: number;
  started_at: string;
  completed_at?: string;
}

interface DataQualityData {
  total_datasets: number;
  total_rows_processed: number;
  total_rows_imported: number;
  total_rows_rejected: number;
  data_cleanliness_percent: number;
  total_resources: number;
  total_schedules: number;
  total_occupancy_records: number;
  total_energy_records: number;
  coverage_start?: string;
  coverage_end?: string;
  coverage_days: number;
  is_forecast_ready: boolean;
  forecast_readiness_message: string;
  recent_jobs: ImportJob[];
}

export default function DataQualityPage() {
  const [data, setData] = useState<DataQualityData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQualityMetrics = async () => {
    try {
      const res = await api.get<DataQualityData>("/data-quality/summary");
      setData(res);
    } catch (e) {
      console.error("Failed to load data quality metrics", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQualityMetrics();
  }, []);

  const downloadErrorCsv = (jobId: number) => {
    window.open(api.getImportJobErrorsUrl(jobId), "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#092634] flex items-center gap-2.5">
            <CheckCircle2 className="h-6 w-6 text-[#004E72]" />
            Data Quality & Observability
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Data integrity monitoring, row rejection audits, telemetry completeness, and forecasting sufficiency
          </p>
        </div>

        <Link href="/imports">
          <Button
            variant="primary"
            size="md"
            className="flex items-center gap-1.5 bg-[#004E72] hover:bg-[#003d59] text-white shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Ingest New Dataset</span>
          </Button>
        </Link>
      </div>

      {/* ML Forecast Readiness Guard Banner */}
      {data && (
        <div
          className={clsx(
            "p-5 rounded-2xl border flex items-start space-x-4 shadow-subtle",
            data.is_forecast_ready
              ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
              : "bg-amber-50/70 border-amber-200 text-amber-900"
          )}
        >
          {data.is_forecast_ready ? (
            <ShieldCheck className="h-6 w-6 text-emerald-600 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-amber-600 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <div className="flex items-center space-x-2.5">
              <span className="font-bold text-sm text-[#092634]">
                {data.is_forecast_ready
                  ? "Predictive ML Engine: Sufficient Telemetry Depth"
                  : "Predictive ML Pipeline Notice"}
              </span>
              <Badge variant={data.is_forecast_ready ? "success" : "warning"} size="sm">
                {data.coverage_days} Days Historical Window
              </Badge>
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {data.forecast_readiness_message}
            </p>
          </div>
        </div>
      )}

      {/* Key Quality KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-subtle p-5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cleanliness Rate</span>
          <div className="text-3xl font-extrabold text-[#092634] mt-1">
            {data ? `${data.data_cleanliness_percent}%` : "..."}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {data?.total_rows_imported?.toLocaleString() || 0} valid / {data?.total_rows_processed?.toLocaleString() || 0} processed
          </p>
        </Card>

        <Card className="bg-white border-slate-200 shadow-subtle p-5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Telemetry Span</span>
          <div className="text-3xl font-extrabold text-[#004E72] mt-1">
            {data?.coverage_days || 0} Days
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Continuous operational telemetry window
          </p>
        </Card>

        <Card className="bg-white border-slate-200 shadow-subtle p-5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Occupancy Records</span>
          <div className="text-3xl font-extrabold text-[#092634] mt-1">
            {data?.total_occupancy_records?.toLocaleString() || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Sensor & attendance headcount observations
          </p>
        </Card>

        <Card className="bg-white border-slate-200 shadow-subtle p-5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Energy Telemetry</span>
          <div className="text-3xl font-extrabold text-[#FF6E42] mt-1">
            {data?.total_energy_records?.toLocaleString() || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Submeter kWh power log readings
          </p>
        </Card>
      </div>

      {/* Temporal Coverage & Database Records Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white border-slate-200 shadow-subtle p-6">
          <div className="border-b border-slate-100 pb-3 mb-4">
            <h3 className="text-sm font-bold text-[#092634]">Database Records Inventory</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Current volume of institutional physical assets and transactional tables
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="flex items-center gap-2 text-slate-700 font-medium">
                <Layers className="h-4 w-4 text-[#004E72]" />
                Total Campus Spaces
              </span>
              <span className="font-bold text-[#092634] font-mono text-sm">{data?.total_resources || 0}</span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="flex items-center gap-2 text-slate-700 font-medium">
                <Calendar className="h-4 w-4 text-[#004E72]" />
                Active Class Schedules
              </span>
              <span className="font-bold text-[#092634] font-mono text-sm">{data?.total_schedules || 0}</span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="flex items-center gap-2 text-slate-700 font-medium">
                <Activity className="h-4 w-4 text-[#FF6E42]" />
                Ingestion Jobs Executed
              </span>
              <span className="font-bold text-[#092634] font-mono text-sm">{data?.total_datasets || 0}</span>
            </div>
          </div>
        </Card>

        <Card className="bg-white border-slate-200 shadow-subtle p-6">
          <div className="border-b border-slate-100 pb-3 mb-4">
            <h3 className="text-sm font-bold text-[#092634]">Telemetry Temporal Window</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Continuous date range bounding analytics, anomaly detection, and ML forecasting
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-[11px] text-slate-500 font-semibold uppercase">Telemetry Start Timestamp</div>
              <div className="text-xs font-mono font-bold text-[#092634]">
                {data?.coverage_start ? new Date(data.coverage_start).toLocaleString() : "No time-series data yet"}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-[11px] text-slate-500 font-semibold uppercase">Latest Ingested Reading</div>
              <div className="text-xs font-mono font-bold text-[#092634]">
                {data?.coverage_end ? new Date(data.coverage_end).toLocaleString() : "No time-series data yet"}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="text-slate-600 font-medium">Operational Status</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Sensor Ingestion Active
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Ingestion Jobs History Table */}
      <Card className="bg-white border-slate-200 shadow-subtle p-6">
        <div className="border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-sm font-bold text-[#092634]">Recent Ingestion Jobs & Audit Trail</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit history of batch uploads, accepted records, and quarantined errors
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Job ID</th>
                <th className="px-4 py-3">Dataset Name</th>
                <th className="px-4 py-3 text-right">Processed</th>
                <th className="px-4 py-3 text-right">Imported</th>
                <th className="px-4 py-3 text-right">Rejected</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Quarantine Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    <div className="inline-block h-5 w-5 border-2 border-[#004E72] border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading ingestion history...</div>
                  </td>
                </tr>
              ) : !data || !Array.isArray(data.recent_jobs) || data.recent_jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No external dataset ingestion jobs executed yet.
                  </td>
                </tr>
              ) : (
                data.recent_jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#004E72]">#{j.id}</td>
                    <td className="px-4 py-3 font-bold text-[#092634]">{j.dataset_name || `Job #${j.id}`}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium">{j.rows_processed?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                      {j.rows_imported?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                      {j.rows_rejected?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          j.status === "completed"
                            ? "success"
                            : j.status === "partial"
                            ? "warning"
                            : "danger"
                        }
                        size="sm"
                      >
                        {j.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {j.rows_rejected > 0 ? (
                        <button
                          onClick={() => downloadErrorCsv(j.id)}
                          className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-semibold"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Rejections CSV</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">0 quarantined</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
