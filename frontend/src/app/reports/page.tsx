"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Printer,
  Building2,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";

export default function ReportsPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getExecutiveSummaryReport();
      setReport(data);
    } catch (err: any) {
      setError(err.message || "Failed to compile executive audit report.");
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  function handleDownloadCsv(type: "utilization" | "anomalies" | "energy") {
    const token = typeof window !== "undefined" ? localStorage.getItem("nexus_access_token") : null;
    const url = api.getExportUrl(type);

    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Export failed with status ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `nexus_${type}_export.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((err) => alert("Failed to download CSV: " + err.message));
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <RefreshCw className="w-8 h-8 text-[#004E72] animate-spin" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Compiling Institutional Audit Dossier from Live Telemetry & CP-SAT Engine...
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-8 rounded-2xl bg-white border border-rose-200 shadow-subtle max-w-xl mx-auto my-12 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 mx-auto text-rose-500" />
        <h3 className="font-bold text-base text-[#092634]">Audit Compilation Failed</h3>
        <p className="text-xs text-slate-500">{error || "Unable to retrieve institutional metrics."}</p>
        <button
          onClick={loadReport}
          className="mt-2 px-4 py-2 bg-[#004E72] text-white text-xs font-semibold rounded-lg hover:bg-[#003d59] transition-colors"
        >
          Retry Compilation
        </button>
      </div>
    );
  }

  const { institution, infrastructure, utilization, energy, operational_health } = report;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Non-printable Action Controls Header */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#092634] flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-[#004E72]" />
            Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Executive and operational reports covering resource utilization, energy consumption, and health metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleDownloadCsv("utilization")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Utilization CSV
          </button>
          <button
            onClick={() => handleDownloadCsv("anomalies")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Anomalies CSV
          </button>
          <button
            onClick={() => handleDownloadCsv("energy")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Energy CSV
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#004E72] hover:bg-[#003d59] rounded-lg shadow-sm transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Export PDF
          </button>
        </div>
      </div>

      {/* Printable Institutional Dossier Document */}
      <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 shadow-sm space-y-10 print:border-none print:shadow-none print:p-0 text-[#092634]">
        {/* Formal Institutional Header */}
        <div className="border-b-2 border-[#004E72] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#004E72]">
                NEXUS Institutional Intelligence Platform
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#092634]">
              {institution.name}
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Facility Resource Optimization & Energy Sustainability Audit Report
            </p>
          </div>

          <div className="text-left md:text-right text-xs text-slate-500 space-y-1">
            <div>
              <span className="font-semibold text-slate-700">Reporting Period: </span>
              {institution.reporting_period}
            </div>
            <div>
              <span className="font-semibold text-slate-700">Generated: </span>
              {institution.generated_at}
            </div>
            <div>
              <span className="font-semibold text-slate-700">Compliance Standard: </span>
              {institution.compliance_standard}
            </div>
          </div>
        </div>

        {/* Section 1: Physical Assets & Operational Schedules */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Building2 className="w-5 h-5 text-[#004E72]" />
            <h3 className="text-sm font-bold text-[#092634] uppercase tracking-wider">
              1. Physical Assets &amp; Operational Schedules
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                Facility Units
              </span>
              <span className="text-2xl font-bold text-[#092634] mt-1 block">
                {infrastructure.total_buildings}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                Monitored Spaces
              </span>
              <span className="text-2xl font-bold text-[#092634] mt-1 block">
                {infrastructure.total_spaces}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                Total Seating Capacity
              </span>
              <span className="text-2xl font-bold text-[#092634] mt-1 block">
                {infrastructure.total_seat_capacity.toLocaleString()} seats
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                Weekly Class Sessions
              </span>
              <span className="text-2xl font-bold text-[#004E72] mt-1 block">
                {infrastructure.weekly_scheduled_sessions}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Space Utilization & Right-Sizing Analysis */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-[#092634] uppercase tracking-wider">
              2. Space Utilization & Right-Sizing Breakdown
            </h3>
          </div>

          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <span className="text-xs text-slate-500 uppercase block font-semibold">
                  Campus-Wide Seat Fill
                </span>
                <span className="text-3xl font-extrabold text-[#092634] mt-1 block">
                  {utilization.avg_seat_fill_percent}%
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">Average occupancy across sessions</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase block font-semibold">
                  Underutilized (&lt;40% Fill)
                </span>
                <span className="text-3xl font-extrabold text-amber-600 mt-1 block">
                  {utilization.underutilized_spaces_count}
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">Prime consolidation candidates</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase block font-semibold">
                  Overloaded (&gt;90% Fill)
                </span>
                <span className="text-3xl font-extrabold text-rose-600 mt-1 block">
                  {utilization.overloaded_spaces_count}
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">At capacity limit / overcrowding</span>
              </div>
            </div>

            {/* Distribution Bar */}
            <div className="pt-2">
              <div className="flex justify-between text-xs text-slate-600 mb-1.5 font-medium">
                <span>Facility Allocation Distribution</span>
                <span>{infrastructure.total_spaces} Total Spaces</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden flex bg-slate-200">
                <div
                  style={{
                    width: `${infrastructure.total_spaces ? (utilization.underutilized_spaces_count / infrastructure.total_spaces) * 100 : 0}%`,
                  }}
                  className="bg-amber-500"
                  title="Underutilized"
                />
                <div
                  style={{
                    width: `${infrastructure.total_spaces ? (utilization.optimal_spaces_count / infrastructure.total_spaces) * 100 : 0}%`,
                  }}
                  className="bg-emerald-600"
                  title="Optimal"
                />
                <div
                  style={{
                    width: `${infrastructure.total_spaces ? (utilization.overloaded_spaces_count / infrastructure.total_spaces) * 100 : 0}%`,
                  }}
                  className="bg-rose-500"
                  title="Overloaded"
                />
              </div>
              <div className="flex items-center gap-6 mt-2 text-[11px] text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Underutilized (&lt;40%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" /> Optimal (40% - 90%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Overloaded (&gt;90%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Energy Consumption & Commercial Tariff Costs */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-bold text-[#092634] uppercase tracking-wider">
              3. Energy Footprint & Commercial Power Costs
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                Total Energy Consumed
              </span>
              <span className="text-2xl font-bold text-[#092634] mt-1 block">
                {Math.round(energy.total_energy_consumed_kwh).toLocaleString()} kWh
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">Across campus facilities</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                Total Power Bill (INR)
              </span>
              <span className="text-2xl font-bold text-amber-600 mt-1 block">
                ₹{Math.round(energy.total_commercial_cost_inr).toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">@ ₹8.50 commercial tariff</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                Phantom Energy Losses
              </span>
              <span className="text-2xl font-bold text-rose-600 mt-1 block">
                ₹{Math.round(energy.phantom_financial_loss_inr).toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">
                {Math.round(energy.phantom_energy_waste_kwh).toLocaleString()} kWh unoccupied draw
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Operational Risk & Optimization ROI */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <ShieldCheck className="w-5 h-5 text-[#004E72]" />
            <h3 className="text-sm font-bold text-[#092634] uppercase tracking-wider">
              4. Operational Risk & Optimization ROI
            </h3>
          </div>

          <div className="p-6 rounded-xl bg-gradient-to-r from-blue-50/70 to-slate-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#004E72] block mb-1">
                Projected Annual Savings with Optimization Engine
              </span>
              <span className="text-3xl font-extrabold text-emerald-600 block">
                ₹{Math.round(operational_health.potential_annual_savings_inr).toLocaleString()} / year
              </span>
              <p className="text-xs text-slate-600 mt-2 max-w-lg leading-relaxed">
                By executing recommended optimized schedules, right-sizing resource allocations, and
                deactivating unoccupied assets during low-demand periods.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs space-y-2.5 min-w-[220px] shadow-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Detected Anomalies:</span>
                <span className="font-bold text-[#092634]">{operational_health.total_anomalies_detected}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Critical Incidents:</span>
                <span className="font-bold text-rose-600">{operational_health.critical_anomalies_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Active Work Orders:</span>
                <span className="font-bold text-[#004E72]">{operational_health.active_action_recommendations}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Formal Endorsements & Sign-off */}
        <div className="border-t-2 border-slate-200 pt-8 space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
            5. Governance, Endorsement & Review Signatures
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-4">
            <div className="space-y-10">
              <div className="h-10 border-b border-dashed border-slate-400" />
              <div>
                <p className="text-xs font-bold text-[#092634]">Director of Facilities & Physical Plant</p>
                <p className="text-[11px] text-slate-500">Facility Infrastructure Operations</p>
              </div>
            </div>

            <div className="space-y-10">
              <div className="h-10 border-b border-dashed border-slate-400" />
              <div>
                <p className="text-xs font-bold text-[#092634]">Head of Operations</p>
                <p className="text-[11px] text-slate-500">Resource & Capacity Planning</p>
              </div>
            </div>

            <div className="space-y-10">
              <div className="h-10 border-b border-dashed border-slate-400" />
              <div>
                <p className="text-xs font-bold text-[#092634]">Chief Sustainability Officer</p>
                <p className="text-[11px] text-slate-500">Energy & Environmental Compliance</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
