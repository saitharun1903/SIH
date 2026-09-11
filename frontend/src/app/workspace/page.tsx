"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Workspace, Goal, ResourceType, Resource } from "@/lib/types";
import { useWorkspace } from "@/context/WorkspaceContext";
import { OnboardingWizard } from "@/components/workspace/OnboardingWizard";
import {
  Layers,
  Target,
  Plus,
  CheckCircle2,
  Clock,
  Sparkles,
  Building2,
  Factory,
  HeartPulse,
  Warehouse,
  Briefcase,
  GraduationCap,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Zap,
  Check,
  Loader2,
} from "lucide-react";

export default function WorkspacePage() {
  const { workspaces, currentWorkspace, switchWorkspace, terminology, refreshWorkspaces } = useWorkspace();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);

  // New Goal Form
  const [goalTitle, setGoalTitle] = useState("");
  const [goalType, setGoalType] = useState("improve_utilization");
  const [targetValue, setTargetValue] = useState<number>(80);
  const [targetUnit, setTargetUnit] = useState("%");
  const [goalTimeframe, setGoalTimeframe] = useState("Q4 2026");
  const [creatingGoal, setCreatingGoal] = useState(false);

  const loadWorkspaceData = async () => {
    setLoading(true);
    try {
      const [goalsRes, typesRes, resRes] = await Promise.all([
        api.getGoals(currentWorkspace?.id),
        api.getResourceTypes(),
        api.getResourcesList(),
      ]);
      setGoals(goalsRes);
      setResourceTypes(typesRes);
      setResources(resRes);

    } catch (err) {
      console.error("Failed to load workspace data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, [currentWorkspace?.id]);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;

    setCreatingGoal(true);
    try {
      await api.createGoal({
        workspace_id: currentWorkspace?.id,
        title: goalTitle,
        goal_type: goalType,
        target_value: targetValue,
        unit: targetUnit,
        baseline_value: 0,
        current_value: 0,
        timeframe: goalTimeframe,
        status: "In Progress",
        priority: "High",
      });
      setShowGoalModal(false);
      setGoalTitle("");
      await loadWorkspaceData();
    } catch (err) {
      console.error("Failed to create goal", err);
    } finally {
      setCreatingGoal(false);
    }
  };

  const getWorkspaceIcon = (type?: string) => {
    switch ((type || "").toLowerCase()) {
      case "factory":
        return <Factory className="h-5 w-5 text-blue-600" />;
      case "hospital":
        return <HeartPulse className="h-5 w-5 text-rose-500" />;
      case "warehouse":
        return <Warehouse className="h-5 w-5 text-amber-600" />;
      case "education":
        return <GraduationCap className="h-5 w-5 text-indigo-600" />;
      case "office":
        return <Briefcase className="h-5 w-5 text-emerald-600" />;
      default:
        return <Building2 className="h-5 w-5 text-[#004E72]" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Workspace Header Banner */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="p-3.5 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD]">
            {getWorkspaceIcon(currentWorkspace?.workspace_type)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-[#092634]">
                {currentWorkspace?.name || "Active Workspace"}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] border border-[#CBD5E1] text-[11px] font-mono font-semibold text-[#092634]">
                {currentWorkspace?.code || "PRM-01"}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#E0F2FE] text-[11px] font-semibold text-[#0369A1] capitalize">
                {currentWorkspace?.workspace_type || "general"} domain
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-1 max-w-2xl">
              {currentWorkspace?.description ||
                "Central operations, resource capacity governance, and decision intelligence."}
            </p>
            <div className="flex items-center space-x-4 text-[11px] text-[#64748B] mt-2">
              <span>Location: <strong className="text-[#092634]">{currentWorkspace?.location || "Main Site"}</strong></span>
              <span>•</span>
              <span>Timezone: <strong className="text-[#092634]">{currentWorkspace?.timezone || "Asia/Kolkata"}</strong></span>
              <span>•</span>
              <span>Resources: <strong className="text-[#092634]">{resources.length} active</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setShowGoalModal(true)}
            className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#092634] flex items-center space-x-1.5 transition-colors shadow-2xs"
          >
            <Target className="h-3.5 w-3.5 text-[#004E72]" />
            <span>Add Goal</span>
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="px-4 py-2 rounded-lg bg-[#004E72] hover:bg-[#003B57] text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#FF6E42]" />
            <span>Launch Guided Setup (10s)</span>
          </button>
        </div>
      </div>

      {/* Operational Goals Section */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-[#092634] uppercase tracking-wider flex items-center space-x-2">
              <Target className="h-4 w-4 text-[#004E72]" />
              <span>Active Operational Goals ({goals.length})</span>
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Target KPIs steering automated anomaly thresholds, solver objective weights, and recommendation engines.
            </p>
          </div>
          <button
            onClick={() => setShowGoalModal(true)}
            className="text-xs font-semibold text-[#004E72] hover:underline flex items-center space-x-1"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Target</span>
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[#64748B]">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#004E72] mb-2" />
            <p className="text-xs">Loading operational goals...</p>
          </div>
        ) : goals.length === 0 ? (
          <div className="py-8 text-center text-[#64748B] border border-dashed border-[#CBD5E1] rounded-xl">
            <Target className="h-8 w-8 mx-auto text-[#CBD5E1] mb-2" />
            <p className="text-xs font-semibold text-[#092634]">No operational goals defined yet</p>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Add target utilization, power reduction, or capacity constraints to steer decision automation.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((g) => {
              const current = g.current_value ?? g.baseline_value ?? 0;
              const target = g.target_value || 100;
              const pct = Math.min(100, Math.max(0, Math.round((current / target) * 100)));
              const isAchieved = g.status === "Achieved" || current >= target;

              return (
                <div
                  key={g.id}
                  className="p-4 rounded-xl border border-[#E2E8F0] hover:border-[#CBD5E1] bg-[#FAFAFA] transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          g.priority === "Critical"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {g.priority} Priority
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isAchieved
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {g.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-xs text-[#092634] leading-snug mb-1">{g.title}</h3>
                    {g.description && (
                      <p className="text-[11px] text-[#64748B] line-clamp-2 mb-3">{g.description}</p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E2E8F0]">
                    <div className="flex justify-between text-xs font-semibold text-[#092634] mb-1.5">
                      <span>
                        Current: <strong className="font-mono">{current} {g.unit}</strong>
                      </span>
                      <span className="text-[#64748B]">
                        Target: <strong className="text-[#004E72] font-mono">{target} {g.unit}</strong>
                      </span>
                    </div>
                    <div className="h-2 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isAchieved ? "bg-emerald-500" : "bg-[#004E72]"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-[#64748B] mt-2">
                      <span>Timeframe: {g.timeframe}</span>
                      <span className="font-mono font-medium">{pct}% Progress</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Multi-Domain Workspaces Switcher Grid */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-[#092634] uppercase tracking-wider flex items-center space-x-2">
              <Layers className="h-4 w-4 text-[#004E72]" />
              <span>Available Organization Workspaces ({workspaces.length})</span>
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Switch between facility domains to monitor independent resource inventories and decision spaces.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {workspaces.map((ws) => {
            const isSelected = currentWorkspace?.id === ws.id;
            return (
              <div
                key={ws.id}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                  isSelected
                    ? "border-[#004E72] bg-[#F0F9FF] shadow-xs"
                    : "border-[#E2E8F0] hover:border-[#CBD5E1] bg-white"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-white border border-[#E2E8F0] shadow-2xs">
                      {getWorkspaceIcon(ws.workspace_type)}
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#E2E8F0] text-[#475569]">
                      {ws.code}
                    </span>
                  </div>
                  <h3 className="font-bold text-xs text-[#092634] line-clamp-1">{ws.name}</h3>
                  <span className="text-[10px] uppercase font-semibold text-[#64748B] tracking-wider block mt-0.5">
                    {ws.workspace_type} Domain
                  </span>
                  <p className="text-[11px] text-[#64748B] mt-2 line-clamp-2">
                    {ws.description || "Operational workspace for capacity optimization."}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
                  <span className="text-[11px] text-[#64748B]">
                    <strong>{ws.resource_count || 0}</strong> resources
                  </span>
                  {isSelected ? (
                    <span className="inline-flex items-center space-x-1 text-xs font-bold text-[#004E72]">
                      <Check className="h-3.5 w-3.5" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => switchWorkspace(ws.id)}
                      className="px-2.5 py-1 rounded-md border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#092634] transition-colors"
                    >
                      Select
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Onboarding Wizard Modal */}
      <OnboardingWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onSuccess={() => {
          refreshWorkspaces();
          loadWorkspaceData();
        }}
      />

      {/* Add Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
              <h3 className="text-sm font-bold text-[#092634]">Add Operational Goal</h3>
              <button
                onClick={() => setShowGoalModal(false)}
                className="text-[#64748B] hover:text-[#092634] text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
            <form onSubmit={handleCreateGoal} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#092634] mb-1">
                  Goal Title *
                </label>
                <input
                  type="text"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder="e.g. Reduce off-hours energy draw by 15%"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs font-medium text-[#092634] focus:outline-none focus:ring-1 focus:ring-[#004E72]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#092634] mb-1">
                    Goal Type
                  </label>
                  <select
                    value={goalType}
                    onChange={(e) => setGoalType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs font-medium text-[#092634] focus:outline-none focus:ring-1 focus:ring-[#004E72]"
                  >
                    <option value="improve_utilization">Improve Utilization</option>
                    <option value="reduce_cost">Reduce Cost / Energy</option>
                    <option value="increase_capacity">Increase Capacity</option>
                    <option value="avoid_shortage">Avoid Bottleneck</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#092634] mb-1">
                    Target Value *
                  </label>
                  <div className="flex space-x-1">
                    <input
                      type="number"
                      step="0.1"
                      value={targetValue}
                      onChange={(e) => setTargetValue(parseFloat(e.target.value))}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs font-medium text-[#092634] focus:outline-none focus:ring-1 focus:ring-[#004E72]"
                    />
                    <input
                      type="text"
                      value={targetUnit}
                      onChange={(e) => setTargetUnit(e.target.value)}
                      placeholder="%"
                      className="w-14 px-2 py-2 rounded-lg border border-[#CBD5E1] text-xs font-medium text-center text-[#092634]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#092634] mb-1">
                  Timeframe
                </label>
                <input
                  type="text"
                  value={goalTimeframe}
                  onChange={(e) => setGoalTimeframe(e.target.value)}
                  placeholder="e.g. Q4 2026 or Immediate"
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs font-medium text-[#092634] focus:outline-none focus:ring-1 focus:ring-[#004E72]"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#CBD5E1] text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingGoal || !goalTitle.trim()}
                  className="px-5 py-2 rounded-lg bg-[#004E72] hover:bg-[#003B57] disabled:opacity-50 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
                >
                  {creatingGoal ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Create Goal</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
