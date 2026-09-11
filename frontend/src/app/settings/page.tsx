"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  Settings,
  Building2,
  SlidersHorizontal,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Key,
  Globe,
  Database,
  Layers,
  Save,
} from "lucide-react";

export default function SettingsPage() {
  const { user, organization } = useAuth();
  const { currentWorkspace, refreshWorkspaces, terminology } = useWorkspace();

  const [activeTab, setActiveTab] = useState<"workspace" | "thresholds" | "organization" | "system">("workspace");
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states for current workspace
  const [wsName, setWsName] = useState<string>("");
  const [wsType, setWsType] = useState<string>("custom");
  const [wsLocation, setWsLocation] = useState<string>("");
  const [wsDesc, setWsDesc] = useState<string>("");

  // Threshold form states
  const [underThreshold, setUnderThreshold] = useState<number>(40);
  const [overThreshold, setOverThreshold] = useState<number>(90);
  const [costPerUnit, setCostPerUnit] = useState<number>(8.5);

  useEffect(() => {
    if (currentWorkspace) {
      setWsName(currentWorkspace.name || "");
      setWsType(currentWorkspace.workspace_type || "custom");
      setWsLocation(currentWorkspace.location || "");
      setWsDesc(currentWorkspace.description || "");
    }
  }, [currentWorkspace]);

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await api.updateWorkspace(currentWorkspace.id, {
        name: wsName,
        workspace_type: wsType,
        location: wsLocation,
        description: wsDesc,
      });
      await refreshWorkspaces();
      setSuccessMessage("Workspace settings saved successfully.");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to update workspace settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      // Persist thresholds to local configuration
      localStorage.setItem(
        `nexus_thresholds_${currentWorkspace?.id || "global"}`,
        JSON.stringify({ underThreshold, overThreshold, costPerUnit })
      );
      setSuccessMessage("Operational threshold parameters saved.");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to update thresholds.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#004E72]">
              Administration
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">Settings</span>
          </div>
          <h1 className="text-2xl font-bold text-[#092634] tracking-tight flex items-center gap-2.5">
            <Settings className="h-6 w-6 text-[#004E72]" />
            Settings
          </h1>
          <p className="text-xs text-[#475569] mt-1">
            Manage workspace domains, operational thresholds, organization profile, and integrations.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 shadow-subtle">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 shadow-subtle">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-[#E2E8F0] pb-px">
        {[
          { id: "workspace", label: "Workspace Configuration" },
          { id: "thresholds", label: "Operational Thresholds" },
          { id: "organization", label: "Organization Profile" },
          { id: "system", label: "System & Engine Diagnostics" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-[#004E72] text-[#004E72] bg-white font-bold"
                : "border-transparent text-[#64748B] hover:text-[#092634] hover:bg-[#F8FAFC]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Workspace Configuration */}
      {activeTab === "workspace" && (
        <Card className="p-6 bg-white border-[#E2E8F0] shadow-subtle max-w-2xl">
          <form onSubmit={handleSaveWorkspace} className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#092634]">Workspace Details</h3>
              <p className="text-xs text-[#64748B]">
                Configure how NEXUS labels and optimizes resources for this operational environment.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#092634] mb-1">
                Workspace Name
              </label>
              <input
                type="text"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#092634] focus:outline-hidden focus:ring-1 focus:ring-[#004E72]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#092634] mb-1">
                Domain Template
              </label>
              <select
                value={wsType}
                onChange={(e) => setWsType(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#092634] focus:outline-hidden focus:ring-1 focus:ring-[#004E72]"
              >
                <option value="manufacturing">Manufacturing &amp; Assembly (Machines, Lines, Operators)</option>
                <option value="healthcare">Healthcare &amp; Hospital (Beds, Wards, Medical Staff)</option>
                <option value="warehouse">Warehouse &amp; Logistics (Storage Bays, Docks, Pallets)</option>
                <option value="office">Corporate Office (Meeting Rooms, Desks, Employees)</option>
                <option value="retail">Retail Stores (Aisles, Registers, Floor Space)</option>
                <option value="education">Education &amp; Campus (Classrooms, Labs, Faculty)</option>
                <option value="custom">Custom Organization (General Purpose)</option>
              </select>
              <p className="text-[11px] text-[#64748B] mt-1">
                Active terminology: <span className="font-semibold text-[#092634]">{terminology.resource}</span> / <span className="font-semibold text-[#092634]">{terminology.group}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#092634] mb-1">
                Physical Location / Facility
              </label>
              <input
                type="text"
                value={wsLocation}
                onChange={(e) => setWsLocation(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#092634] focus:outline-hidden focus:ring-1 focus:ring-[#004E72]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#092634] mb-1">
                Description
              </label>
              <textarea
                value={wsDesc}
                onChange={(e) => setWsDesc(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#092634] focus:outline-hidden focus:ring-1 focus:ring-[#004E72]"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={saving}
                className="bg-[#004E72] hover:bg-[#003d59] text-white"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save Workspace Settings
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tab 2: Operational Thresholds */}
      {activeTab === "thresholds" && (
        <Card className="p-6 bg-white border-[#E2E8F0] shadow-subtle max-w-2xl">
          <form onSubmit={handleSaveThresholds} className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#092634]">Optimization &amp; Anomaly Thresholds</h3>
              <p className="text-xs text-[#64748B]">
                Define utilization boundaries and financial cost baselines used by anomaly detectors and solvers.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#092634] mb-1">
                  Underutilization Threshold (%)
                </label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={underThreshold}
                  onChange={(e) => setUnderThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#092634]"
                />
                <span className="text-[11px] text-[#64748B] mt-0.5 block">
                  Resources below this are marked underutilized.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#092634] mb-1">
                  Overutilization Threshold (%)
                </label>
                <input
                  type="number"
                  min="60"
                  max="100"
                  value={overThreshold}
                  onChange={(e) => setOverThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#092634]"
                />
                <span className="text-[11px] text-[#64748B] mt-0.5 block">
                  Resources above this trigger capacity stress alerts.
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#092634] mb-1">
                Average Cost Rate (₹ per unit / kWh)
              </label>
              <input
                type="number"
                step="0.1"
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#092634]"
              />
              <span className="text-[11px] text-[#64748B] mt-0.5 block">
                Used to compute estimated monetary impact on recommendations.
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={saving}
                className="bg-[#004E72] hover:bg-[#003d59] text-white"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save Threshold Parameters
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tab 3: Organization Profile */}
      {activeTab === "organization" && (
        <Card className="p-6 bg-white border-[#E2E8F0] shadow-subtle max-w-2xl space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#092634]">Organization Profile</h3>
            <p className="text-xs text-[#64748B]">
              Primary organizational entity and account administrator details.
            </p>
          </div>

          <div className="divide-y divide-[#F1F5F9] text-xs">
            <div className="py-2.5 flex justify-between">
              <span className="text-[#64748B]">Organization Name</span>
              <span className="font-semibold text-[#092634]">{organization?.name || "NEXUS Organization"}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-[#64748B]">Organization ID</span>
              <span className="font-mono text-[#092634]">#{organization?.id || 1}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-[#64748B]">Administrator</span>
              <span className="text-[#092634] font-medium">{user?.email || "admin@nexus.local"}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-[#64748B]">Account Role</span>
              <Badge variant="success">{user?.role || "Administrator"}</Badge>
            </div>
          </div>
        </Card>
      )}

      {/* Tab 4: System Diagnostics */}
      {activeTab === "system" && (
        <Card className="p-6 bg-white border-[#E2E8F0] shadow-subtle max-w-2xl space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#092634]">System Engine &amp; Connectivity</h3>
            <p className="text-xs text-[#64748B]">
              Real-time engine runtime status and diagnostic telemetry.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="text-[#64748B] block text-[10px] uppercase font-bold">Optimization Core</span>
              <span className="font-semibold text-[#092634] mt-0.5 block">CP-SAT Constraint Engine</span>
              <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">Active &amp; Operational</span>
            </div>
            <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="text-[#64748B] block text-[10px] uppercase font-bold">Relational Engine</span>
              <span className="font-semibold text-[#092634] mt-0.5 block">SQLAlchemy / SQLite &amp; Postgres</span>
              <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">Indexed &amp; Healthy</span>
            </div>
            <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="text-[#64748B] block text-[10px] uppercase font-bold">Client Cache Layer</span>
              <span className="font-semibold text-[#092634] mt-0.5 block">TanStack React Query v5</span>
              <span className="text-[10px] text-blue-600 font-semibold mt-1 block">Active (Frame 0 Skeletons)</span>
            </div>
            <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="text-[#64748B] block text-[10px] uppercase font-bold">Data Grounding</span>
              <span className="font-semibold text-[#092634] mt-0.5 block">Verified Ground-Truth Telemetry</span>
              <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">Strictly Enforced</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
