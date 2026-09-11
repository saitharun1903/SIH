"use client";

import React, { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  ArrowRight,
  RefreshCw,
  Sliders,
  Table as TableIcon,
  XCircle,
  FileText,
} from "lucide-react";
import clsx from "clsx";
import { useImportJobsQuery } from "@/hooks/useNexusQueries";
import { TableSkeleton, EmptyState, SectionError } from "@/components/common/SectionSkeleton";

interface FieldDef {
  internal_field: string;
  label: string;
  required: boolean;
  suggested_column?: string;
  description: string;
}

interface InspectionResult {
  file_id: string;
  file_name: string;
  source_type: string;
  detected_dataset_type: string;
  detected_columns: string[];
  suggested_mappings: Record<string, string>;
  field_definitions: FieldDef[];
  preview_rows: Record<string, any>[];
  total_rows: number;
}

interface ImportSummary {
  dataset_id: number;
  job_id: number;
  dataset_name: string;
  dataset_type: string;
  rows_processed: number;
  rows_imported: number;
  rows_rejected: number;
  status: string;
  errors: { row_number: number; reason: string; raw_data: Record<string, any> }[];
  completed_at: string;
}

export default function ImportsPage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Query recent import jobs independently (does not block file upload)
  const { data: recentJobs, isLoading: jobsLoading, error: jobsError, refetch: refetchJobs } = useImportJobsQuery();

  // Workflow steps: 'upload' | 'inspect' | 'summary'
  const [step, setStep] = useState<"upload" | "inspect" | "summary">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Inspection & Mapping state
  const [inspection, setInspection] = useState<InspectionResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [datasetName, setDatasetName] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // Summary state
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadError(null);
    }
  };

  const handleUploadAndInspect = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const data = await api.inspectImportFile(selectedFile);
      setInspection(data);
      setColumnMapping(data.suggested_mappings || {});
      setDatasetName(data.file_name.replace(/\.[^/.]+$/, "") + "_Import");
      setStep("inspect");
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload and inspect dataset.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleMappingChange = (field: string, col: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [field]: col,
    }));
  };

  const handleConfirmImport = async () => {
    if (!inspection) return;
    setIsImporting(true);
    setUploadError(null);

    try {
      const res = await api.post<ImportSummary>("/imports/confirm", {
        file_id: inspection.file_id,
        dataset_type: inspection.detected_dataset_type,
        dataset_name: datasetName,
        column_mapping: columnMapping,
      });

      setSummary(res);
      refetchJobs();
      setStep("summary");
    } catch (err: any) {
      setUploadError(err.message || "Failed to confirm and persist import.");
    } finally {
      setIsImporting(false);
    }
  };

  const downloadErrorCsv = async () => {
    if (!summary) return;
    try {
      window.open(api.getImportJobErrorsUrl(summary.job_id), "_blank");
    } catch (e) {
      alert("Error downloading rejections report.");
    }
  };

  const downloadTemplate = (type: string) => {
    window.open(api.getImportTemplateUrl(type), "_blank");
  };

  const handleReset = () => {
    setStep("upload");
    setSelectedFile(null);
    setInspection(null);
    setSummary(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Header & Stepper */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#092634] flex items-center gap-2.5">
            <UploadCloud className="h-6 w-6 text-[#004E72]" />
            Dataset Ingestion & ETL Pipeline
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Automated file schema detection, fuzzy column mapping, validation quarantine, and database persistence
          </p>
        </div>

        {/* Progress Stepper */}
        <div className="flex items-center space-x-2 text-xs">
          <span
            className={clsx(
              "px-3 py-1 rounded-full font-semibold transition-colors",
              step === "upload"
                ? "bg-[#004E72] text-white"
                : "bg-slate-100 text-slate-600"
            )}
          >
            1. File Upload
          </span>
          <ArrowRight className="h-3 w-3 text-slate-400" />
          <span
            className={clsx(
              "px-3 py-1 rounded-full font-semibold transition-colors",
              step === "inspect"
                ? "bg-[#004E72] text-white"
                : "bg-slate-100 text-slate-600"
            )}
          >
            2. Map & Validate
          </span>
          <ArrowRight className="h-3 w-3 text-slate-400" />
          <span
            className={clsx(
              "px-3 py-1 rounded-full font-semibold transition-colors",
              step === "summary"
                ? "bg-[#004E72] text-white"
                : "bg-slate-100 text-slate-600"
            )}
          >
            3. Ingestion Audit
          </span>
        </div>
      </div>

      {/* Error alert if any */}
      {uploadError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2.5">
          <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-rose-600" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* STEP 1: FILE UPLOAD */}
      {step === "upload" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white border-slate-200 shadow-subtle p-8 text-center">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-[#004E72] rounded-2xl p-12 cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50 flex flex-col items-center justify-center space-y-3"
              >
                <div className="h-14 w-14 rounded-2xl bg-[#004E72]/10 border border-[#004E72]/20 flex items-center justify-center text-[#004E72]">
                  <FileSpreadsheet className="h-7 w-7" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#092634]">
                    {selectedFile ? selectedFile.name : "Select or drag institutional dataset to ingest"}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports .csv, .xlsx, or .xls files (Up to 25 MB)
                  </p>
                </div>
                {selectedFile && (
                  <Badge variant="success" size="sm">
                    {(selectedFile.size / 1024).toFixed(1)} KB Ready for Inspection
                  </Badge>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  variant="primary"
                  size="md"
                  disabled={!selectedFile}
                  isLoading={isUploading}
                  onClick={handleUploadAndInspect}
                  className="flex items-center gap-2 bg-[#004E72] hover:bg-[#003d59] text-white shadow-sm"
                >
                  <span>Inspect Columns & Detect Schema</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </div>

          {/* Sample Templates Download Side Card */}
          <div className="space-y-4">
            <Card className="bg-white border-slate-200 shadow-subtle p-5">
              <h3 className="text-sm font-bold text-[#092634]">Standard Institutional Templates</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Download pre-formatted CSV templates ready for batch data ingestion:
              </p>

              <div className="space-y-2.5 mt-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#092634]">Classrooms & Spaces</div>
                    <div className="text-[11px] text-slate-500">Name, Code, Capacity, Floor, Block</div>
                  </div>
                  <button
                    onClick={() => downloadTemplate("resources")}
                    className="p-1.5 text-[#004E72] hover:bg-slate-200/60 rounded-lg transition-colors"
                    title="Download template"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#092634]">Academic Schedules</div>
                    <div className="text-[11px] text-slate-500">Subject, Room, Day, Time Windows</div>
                  </div>
                  <button
                    onClick={() => downloadTemplate("schedules")}
                    className="p-1.5 text-[#004E72] hover:bg-slate-200/60 rounded-lg transition-colors"
                    title="Download template"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#092634]">Attendance & Headcounts</div>
                    <div className="text-[11px] text-slate-500">Room Code, Timestamp, Headcount</div>
                  </div>
                  <button
                    onClick={() => downloadTemplate("attendance")}
                    className="p-1.5 text-[#004E72] hover:bg-slate-200/60 rounded-lg transition-colors"
                    title="Download template"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#092634]">Submeter Energy Logs</div>
                    <div className="text-[11px] text-slate-500">Room Code, Timestamp, kWh, Voltage</div>
                  </div>
                  <button
                    onClick={() => downloadTemplate("energy")}
                    className="p-1.5 text-[#004E72] hover:bg-slate-200/60 rounded-lg transition-colors"
                    title="Download template"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Section: Recent Ingestion Activity & Jobs */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#092634]">Recent Ingestion Jobs</h3>
              <p className="text-xs text-[#64748B]">Batch dataset import executions and validation audit logs</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchJobs()}
              isLoading={jobsLoading}
              className="text-xs h-7 text-[#64748B]"
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Refresh
            </Button>
          </div>

          {jobsLoading ? (
            <TableSkeleton rows={3} cols={6} />
          ) : jobsError ? (
            <SectionError
              title="Recent Ingestion Jobs"
              message="Could not load dataset import history. Backend may be offline."
              onRetry={() => refetchJobs()}
            />
          ) : !recentJobs?.items || recentJobs.items.length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="No datasets imported yet"
              description="Upload a CSV or Excel spreadsheet using the area above to ingest your first dataset."
            />
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-subtle overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0] font-semibold">
                    <tr>
                      <th className="px-4 py-3">Job ID</th>
                      <th className="px-4 py-3">Dataset Name</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Processed</th>
                      <th className="px-4 py-3">Imported</th>
                      <th className="px-4 py-3">Rejected</th>
                      <th className="px-4 py-3">Started</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9] text-[#092634]">
                    {recentJobs.items.map((job: any) => (
                      <tr key={job.id} className="hover:bg-[#F8FAFC]/80 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-[#64748B]">#{job.id}</td>
                        <td className="px-4 py-3 font-semibold">{job.dataset_name || "Dataset"}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={job.status === "completed" ? "success" : job.status === "failed" ? "danger" : "warning"}
                            size="sm"
                          >
                            {job.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono">{job.rows_processed?.toLocaleString() ?? 0}</td>
                        <td className="px-4 py-3 font-mono text-emerald-700 font-semibold">{job.rows_imported?.toLocaleString() ?? 0}</td>
                        <td className="px-4 py-3 font-mono text-rose-600 font-semibold">{job.rows_rejected?.toLocaleString() ?? 0}</td>
                        <td className="px-4 py-3 text-[#64748B]">
                          {job.started_at ? new Date(job.started_at).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {job.rows_rejected > 0 && (
                            <a
                              href={api.getImportJobErrorsUrl(job.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-semibold text-[#004E72] hover:underline"
                            >
                              Download Rejections
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

      {/* STEP 2: SCHEMA DETECTION & COLUMN MAPPING */}
      {step === "inspect" && inspection && (
        <div className="space-y-6">
          {/* Metadata Banner */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-[#004E72]/10 border border-[#004E72]/20 flex items-center justify-center text-[#004E72]">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#092634]">{inspection.file_name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {inspection.total_rows} records detected • Format: {inspection.source_type}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-xs text-slate-500 font-medium">Target Schema:</span>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#004E72]/10 text-[#004E72] border border-[#004E72]/20">
                {inspection.detected_dataset_type.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Column Mapping Section */}
          <Card className="bg-white border-slate-200 shadow-subtle p-6">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-[#092634]">Configure Column Mappings</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                The schema matcher inferred the fields below. Review and adjust any non-standard headers before ingestion.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inspection.field_definitions.map((f) => (
                <div key={f.internal_field} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#092634]">
                      {f.label} {f.required && <span className="text-rose-500">*</span>}
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Database: {f.internal_field}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2.5">{f.description}</p>
                  <select
                    value={columnMapping[f.internal_field] || ""}
                    onChange={(e) => handleMappingChange(f.internal_field, e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-[#092634] focus:outline-none focus:ring-2 focus:ring-[#004E72]"
                  >
                    <option value="">-- Do Not Map --</option>
                    {inspection.detected_columns.map((col) => (
                      <option key={col} value={col}>
                        File Header: &quot;{col}&quot;
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel & Upload Another
              </Button>
              <Button
                variant="primary"
                size="md"
                isLoading={isImporting}
                onClick={handleConfirmImport}
                className="flex items-center gap-2 bg-[#004E72] hover:bg-[#003d59] text-white shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm & Import Valid Records</span>
              </Button>
            </div>
          </Card>

          {/* Preview Rows Table */}
          <Card className="bg-white border-slate-200 shadow-subtle p-6">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-[#092634]">Raw Ingestion Preview (First 5 Records)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify parsed row structure prior to database insertion
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
                  <tr>
                    {inspection.detected_columns.map((c) => (
                      <th key={c} className="px-3 py-2.5">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {inspection.preview_rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      {inspection.detected_columns.map((c) => (
                        <td key={c} className="px-3 py-2 whitespace-nowrap">
                          {String(row[c] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* STEP 3: SUMMARY & REJECTIONS */}
      {step === "summary" && summary && (
        <div className="space-y-6">
          <Card className="bg-white border-slate-200 shadow-subtle p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div
                  className={clsx(
                    "h-12 w-12 rounded-xl flex items-center justify-center",
                    summary.rows_rejected === 0
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                      : "bg-amber-50 text-amber-600 border border-amber-200"
                  )}
                >
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#092634]">
                    {summary.status === "completed"
                      ? "Ingestion Completed Successfully"
                      : "Ingestion Completed with Partial Rejections"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Dataset: {summary.dataset_name} ({summary.dataset_type.toUpperCase()})
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {summary.rows_rejected > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadErrorCsv}
                    className="flex items-center gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Quarantined CSV</span>
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleReset}
                  className="bg-[#004E72] hover:bg-[#003d59] text-white"
                >
                  Import Another Dataset
                </Button>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100 text-center">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 font-semibold uppercase">Total Rows Processed</span>
                <div className="text-2xl font-bold text-[#092634] mt-1">{summary.rows_processed}</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[11px] text-emerald-700 font-semibold uppercase">Valid Records Persisted</span>
                <div className="text-2xl font-bold text-emerald-600 mt-1">{summary.rows_imported}</div>
              </div>
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-[11px] text-rose-700 font-semibold uppercase">Quarantined / Rejected</span>
                <div className="text-2xl font-bold text-rose-600 mt-1">{summary.rows_rejected}</div>
              </div>
            </div>
          </Card>

          {/* Rejection Details Table */}
          {summary.errors && summary.errors.length > 0 && (
            <Card className="bg-white border-slate-200 shadow-subtle p-6">
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-sm font-bold text-[#092634]">Quarantined Records Audit Trail</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  The records below failed institutional integrity constraints and were quarantined without contaminating the database.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Row Number</th>
                      <th className="px-4 py-2.5">Reason for Quarantine</th>
                      <th className="px-4 py-2.5">Submitted Raw Payload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {summary.errors.map((err, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-rose-600 font-bold">
                          Line {err.row_number}
                        </td>
                        <td className="px-4 py-2.5 text-slate-800 font-medium">
                          {err.reason}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 max-w-md truncate">
                          {JSON.stringify(err.raw_data)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
