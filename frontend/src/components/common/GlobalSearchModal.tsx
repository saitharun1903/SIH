"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { SearchResultItem } from "@/lib/types";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  Search,
  X,
  Layers,
  AlertTriangle,
  SlidersHorizontal,
  Zap,
  Target,
  ArrowRight,
  Command,
  Loader2,
} from "lucide-react";

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults(null);
    }
  }, [isOpen]);

  // Debounced search query
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const handler = setTimeout(async () => {
      try {
        const res = await api.search(trimmed, currentWorkspace?.id);
        setResults(res);
      } catch (e) {
        console.error("Universal search error", e);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(handler);
  }, [query, currentWorkspace?.id]);

  if (!isOpen) return null;

  const navigateTo = (path: string) => {
    onClose();
    router.push(path);
  };

  const hasAnyResults =
    results &&
    (results.resources.length > 0 ||
      results.anomalies.length > 0 ||
      results.scenarios.length > 0 ||
      results.actions.length > 0 ||
      results.goals.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-[#E2E8F0] overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#E2E8F0] bg-[#FAFAFA]">
          <Search className="h-5 w-5 text-[#64748B] mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search resources, anomalies, scenarios, actions, goals across organization..."
            className="flex-1 bg-transparent text-sm text-[#092634] placeholder-[#94A3B8] outline-none font-medium"
          />
          {loading ? (
            <Loader2 className="h-4 w-4 text-[#004E72] animate-spin mr-2" />
          ) : query ? (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded hover:bg-[#E2E8F0] text-[#64748B] mr-2"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <div className="flex items-center space-x-1 text-[11px] font-mono text-[#64748B] bg-white px-2 py-0.5 rounded border border-[#CBD5E1]">
            <kbd>ESC</kbd>
          </div>
        </div>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!query.trim() && (
            <div className="py-8 text-center text-[#64748B]">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">
                Quick Navigation
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto mt-3">
                <button
                  onClick={() => navigateTo("/resources")}
                  className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-xs font-medium text-[#092634] flex items-center space-x-1.5"
                >
                  <Layers className="h-3.5 w-3.5 text-[#004E72]" />
                  <span>All Resources</span>
                </button>
                <button
                  onClick={() => navigateTo("/simulator")}
                  className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-xs font-medium text-[#092634] flex items-center space-x-1.5"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-[#FF6E42]" />
                  <span>What-If Simulator</span>
                </button>
                <button
                  onClick={() => navigateTo("/anomalies")}
                  className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-xs font-medium text-[#092634] flex items-center space-x-1.5"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  <span>Anomalies</span>
                </button>
                <button
                  onClick={() => navigateTo("/actions")}
                  className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-xs font-medium text-[#092634] flex items-center space-x-1.5"
                >
                  <Zap className="h-3.5 w-3.5 text-[#004E72]" />
                  <span>Action Center</span>
                </button>
              </div>
            </div>
          )}

          {query.trim() && !loading && !hasAnyResults && (
            <div className="py-12 text-center text-[#64748B]">
              <Search className="h-8 w-8 mx-auto text-[#CBD5E1] mb-2" />
              <p className="text-sm font-semibold text-[#092634]">No matching records found</p>
              <p className="text-xs text-[#64748B] mt-1">
                No active resources, anomalies, scenarios, or goals matched &ldquo;{query}&rdquo;.
              </p>
            </div>
          )}

          {/* Resources Group */}
          {results && results.resources.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-[#64748B] mb-2">
                <Layers className="h-3.5 w-3.5 text-[#004E72]" />
                <span className="uppercase tracking-wider">Resources ({results.resources.length})</span>
              </div>
              <div className="space-y-1">
                {results.resources.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => navigateTo(`/resources`)}
                    className="p-2.5 rounded-lg hover:bg-[#F1F5F9] cursor-pointer flex items-center justify-between transition-colors border border-transparent hover:border-[#E2E8F0]"
                  >
                    <div>
                      <span className="font-semibold text-xs text-[#092634]">{r.name}</span>
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-[#E2E8F0] text-[10px] font-mono text-[#475569]">
                        {r.code}
                      </span>
                      <p className="text-[11px] text-[#64748B] mt-0.5">{r.location || r.type}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#94A3B8]" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anomalies Group */}
          {results && results.anomalies.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-amber-700 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span className="uppercase tracking-wider">Active Anomalies ({results.anomalies.length})</span>
              </div>
              <div className="space-y-1">
                {results.anomalies.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => navigateTo("/anomalies")}
                    className="p-2.5 rounded-lg hover:bg-amber-50/50 cursor-pointer flex items-center justify-between transition-colors border border-transparent hover:border-amber-200"
                  >
                    <div>
                      <span className="font-semibold text-xs text-[#092634]">{a.reason}</span>
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-[10px] font-semibold text-amber-800">
                        {a.severity}
                      </span>
                      <p className="text-[11px] text-[#64748B] mt-0.5">Metric: {a.metric}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#94A3B8]" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scenarios Group */}
          {results && results.scenarios.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-[#004E72] mb-2">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="uppercase tracking-wider">Scenarios ({results.scenarios.length})</span>
              </div>
              <div className="space-y-1">
                {results.scenarios.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => navigateTo("/simulator")}
                    className="p-2.5 rounded-lg hover:bg-[#F1F5F9] cursor-pointer flex items-center justify-between transition-colors border border-transparent hover:border-[#E2E8F0]"
                  >
                    <div>
                      <span className="font-semibold text-xs text-[#092634]">{s.name}</span>
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-[#E0F2FE] text-[10px] font-semibold text-[#0369A1]">
                        {s.status}
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#94A3B8]" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Goals Group */}
          {results && results.goals.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-700 mb-2">
                <Target className="h-3.5 w-3.5 text-emerald-600" />
                <span className="uppercase tracking-wider">Goals ({results.goals.length})</span>
              </div>
              <div className="space-y-1">
                {results.goals.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => navigateTo("/workspace")}
                    className="p-2.5 rounded-lg hover:bg-emerald-50/50 cursor-pointer flex items-center justify-between transition-colors border border-transparent hover:border-emerald-200"
                  >
                    <div>
                      <span className="font-semibold text-xs text-[#092634]">{g.title}</span>
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-100 text-[10px] font-semibold text-emerald-800">
                        Target: {g.target_value} {g.unit}
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#94A3B8]" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-[11px] text-[#64748B]">
          <span className="flex items-center space-x-1">
            <span>Searching in:</span>
            <strong className="text-[#092634]">{currentWorkspace?.name || "All Workspaces"}</strong>
          </span>
          <span className="text-[10px] text-[#94A3B8]">Press ESC to close</span>
        </div>
      </div>
    </div>
  );
};
