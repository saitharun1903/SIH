"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TableRowSkeleton } from "@/components/common/SectionSkeleton";
import { api } from "@/lib/api";
import { AuditLogEntry } from "@/lib/types";
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  SlidersHorizontal,
  FileText,
  CheckCircle2,
  AlertCircle,
  Eye,
  Calendar,
} from "lucide-react";

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [entityFilter, setEntityFilter] = useState<string>("ALL");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAuditLogs(100);
      setLogs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load audit history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesAction =
        actionFilter === "ALL" ||
        log.action.toUpperCase() === actionFilter.toUpperCase();
      const matchesEntity =
        entityFilter === "ALL" ||
        log.entity_type.toUpperCase() === entityFilter.toUpperCase();
      const matchesSearch =
        !searchQuery ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.user_name && log.user_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.metadata_json && log.metadata_json.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesAction && matchesEntity && matchesSearch;
    });
  }, [logs, actionFilter, entityFilter, searchQuery]);

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return `${d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      return ts;
    }
  };

  const getActionBadge = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes("CREATE") || act.includes("INGEST") || act.includes("APPLY")) {
      return <Badge variant="success">{action}</Badge>;
    }
    if (act.includes("DELETE") || act.includes("CANCEL") || act.includes("DISMISS")) {
      return <Badge variant="danger">{action}</Badge>;
    }
    if (act.includes("SIMULATE") || act.includes("OPTIMIZE")) {
      return <Badge variant="info">{action}</Badge>;
    }
    return <Badge variant="neutral">{action}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#004E72]">
              Actions &amp; Compliance
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">Activity Log</span>
          </div>
          <h1 className="text-2xl font-bold text-[#092634] tracking-tight flex items-center gap-2.5">
            <History className="h-6 w-6 text-[#004E72]" />
            Activity Log
          </h1>
          <p className="text-xs text-[#475569] mt-1">
            Chronological record of configuration changes, simulations, imports, and operator decisions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadLogs}
            disabled={loading}
            className="text-xs h-8 text-[#475569] hover:text-[#092634]"
          >
            <RefreshCw className={`h-3 w-3 mr-1.5 ${loading ? "animate-spin text-[#004E72]" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-subtle">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search by user, action, or metadata..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#092634] placeholder-[#94A3B8] focus:outline-hidden focus:ring-1 focus:ring-[#004E72]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Action Filter */}
          <div className="flex items-center space-x-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1 text-xs">
            <Filter className="h-3.5 w-3.5 text-[#64748B]" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-transparent border-none text-[#092634] font-medium focus:ring-0 cursor-pointer pr-4 text-xs"
              aria-label="Filter by action"
            >
              <option value="ALL">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="SIMULATE">Simulate</option>
              <option value="APPLY">Apply</option>
              <option value="DISMISS">Dismiss</option>
            </select>
          </div>

          {/* Entity Filter */}
          <div className="flex items-center space-x-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1 text-xs">
            <FileText className="h-3.5 w-3.5 text-[#64748B]" />
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="bg-transparent border-none text-[#092634] font-medium focus:ring-0 cursor-pointer pr-4 text-xs"
              aria-label="Filter by entity"
            >
              <option value="ALL">All Entities</option>
              <option value="RESOURCE">Resource</option>
              <option value="WORKSPACE">Workspace</option>
              <option value="SCENARIO">Scenario</option>
              <option value="RECOMMENDATION">Recommendation</option>
              <option value="DATASET">Dataset</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <Card className="p-0 overflow-hidden border-[#E2E8F0] shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] text-xs">
              {loading ? (
                <TableRowSkeleton rows={6} cols={6} />
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#64748B]">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Clock className="h-8 w-8 mx-auto text-[#CBD5E1]" />
                      <p className="font-semibold text-[#092634]">No activity logs found</p>
                      <p className="text-xs text-[#64748B]">
                        Operational actions, simulations, and updates will be recorded here automatically.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 px-4 text-[#475569] font-mono text-[11px] whitespace-nowrap">
                      {formatTimestamp(log.created_at)}
                    </td>
                    <td className="py-3 px-4 text-[#092634] font-medium">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-[#64748B]" />
                        <span>{log.user_name || "System Automation"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">{getActionBadge(log.action)}</td>
                    <td className="py-3 px-4 text-[#475569]">
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#F1F5F9] border border-[#E2E8F0]">
                        {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ""}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#475569] max-w-xs truncate">
                      {log.metadata_json || "Standard change"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="text-xs h-7 text-[#004E72] hover:text-[#003d59]"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Inspect Modal */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title={`Audit Log Record #${selectedLog.id}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div>
                <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider block">
                  Action
                </span>
                <span className="font-semibold text-[#092634] mt-0.5 block">
                  {selectedLog.action}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider block">
                  Entity
                </span>
                <span className="font-semibold text-[#092634] mt-0.5 block">
                  {selectedLog.entity_type} {selectedLog.entity_id ? `#${selectedLog.entity_id}` : ""}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider block">
                  Performed By
                </span>
                <span className="font-semibold text-[#092634] mt-0.5 block">
                  {selectedLog.user_name || "System Automation"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider block">
                  Timestamp
                </span>
                <span className="font-mono text-[#092634] mt-0.5 block">
                  {formatTimestamp(selectedLog.created_at)}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider block mb-1">
                Metadata &amp; Parameters
              </span>
              <pre className="p-3 rounded-lg bg-[#092634] text-slate-100 font-mono text-[11px] overflow-x-auto max-h-60 leading-relaxed">
                {selectedLog.metadata_json
                  ? (() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedLog.metadata_json), null, 2);
                      } catch {
                        return selectedLog.metadata_json;
                      }
                    })()
                  : "No additional metadata recorded."}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
