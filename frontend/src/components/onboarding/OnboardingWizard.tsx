"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { WorkspaceTemplate } from "@/lib/types";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  Building2,
  Cpu,
  Zap,
  Users,
  Package,
  GraduationCap,
  Layers,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Target,
  Sparkles,
  Loader2,
} from "lucide-react";

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ isOpen, onClose, onSuccess }) => {
  const { refreshWorkspaces, switchWorkspace } = useWorkspace();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("space_facilities");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceCode, setWorkspaceCode] = useState("");
  const [workspaceLocation, setWorkspaceLocation] = useState("Main Facility");
  const [description, setDescription] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api
        .getWorkspaceTemplates()
        .then((tpls) => {
          setTemplates(tpls);
          if (tpls.length > 0) {
            const first = tpls[0];
            setSelectedTemplateId(first.template_id);
            setWorkspaceName(first.name);
            setWorkspaceCode(`WS-${Math.floor(100 + Math.random() * 900)}`);
            setSelectedGoals(first.default_goals || []);
          }
        })
        .catch((err) => {
          console.error("Failed to load templates", err);
          setError("Failed to load domain templates.");
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentTemplate = templates.find((t) => t.template_id === selectedTemplateId) || templates[0];

  const handleTemplateSelect = (t: WorkspaceTemplate) => {
    setSelectedTemplateId(t.template_id);
    setWorkspaceName(`${t.name} Operational Hub`);
    setWorkspaceCode(`${t.template_id.substring(0, 3).toUpperCase()}-01`);
    setSelectedGoals(t.default_goals || []);
  };

  const toggleGoal = (goal: string) => {
    if (selectedGoals.includes(goal)) {
      setSelectedGoals(selectedGoals.filter((g) => g !== goal));
    } else {
      setSelectedGoals([...selectedGoals, goal]);
    }
  };

  const getTemplateIcon = (iconName: string) => {
    switch (iconName) {
      case "Building2":
        return <Building2 className="h-5 w-5 text-[#004E72]" />;
      case "Cpu":
        return <Cpu className="h-5 w-5 text-blue-600" />;
      case "Zap":
        return <Zap className="h-5 w-5 text-amber-500" />;
      case "Users":
        return <Users className="h-5 w-5 text-indigo-600" />;
      case "Package":
        return <Package className="h-5 w-5 text-emerald-600" />;
      case "GraduationCap":
        return <GraduationCap className="h-5 w-5 text-purple-600" />;
      default:
        return <Layers className="h-5 w-5 text-[#004E72]" />;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const typeMap: Record<string, string> = {
        space_facilities: "office",
        equipment_assets: "factory",
        energy_utilities: "factory",
        workforce_capacity: "office",
        inventory_operations: "warehouse",
        education_campus: "education",
        custom: "custom",
      };

      const newWs = await api.createWorkspace({
        name: workspaceName,
        code: workspaceCode,
        workspace_type: typeMap[selectedTemplateId] || "custom",
        description: description || currentTemplate?.description,
        location: workspaceLocation,
        primary_goals: selectedGoals,
        template_types: [selectedTemplateId],
      });

      await refreshWorkspaces();
      switchWorkspace(newWs.id);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create workspace. Please check the code format.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div>
            <div className="flex items-center space-x-2">
              <span className="h-6 w-6 rounded-md bg-[#004E72] text-white flex items-center justify-center text-xs font-bold">
                {step}
              </span>
              <h2 className="text-base font-bold text-[#092634]">
                {step === 1 && "Choose Your Domain Template"}
                {step === 2 && "Configure Workspace & Assets"}
                {step === 3 && "Set Baseline Operational Goals"}
              </h2>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5 ml-8">
              {step === 1 && "Select the operational domain that best describes your organization"}
              {step === 2 && "Define facility identifiers, locations, and resource types"}
              {step === 3 && "Calibrate target metrics to steer anomaly detection and CP-SAT solvers"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#092634] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Indicator Tabs */}
        <div className="flex border-b border-[#E2E8F0] bg-white">
          <div
            className={`flex-1 py-2 text-center text-xs font-semibold border-b-2 transition-colors ${
              step === 1 ? "border-[#004E72] text-[#004E72]" : "border-transparent text-[#64748B]"
            }`}
          >
            1. Domain Template
          </div>
          <div
            className={`flex-1 py-2 text-center text-xs font-semibold border-b-2 transition-colors ${
              step === 2 ? "border-[#004E72] text-[#004E72]" : "border-transparent text-[#64748B]"
            }`}
          >
            2. Workspace Config
          </div>
          <div
            className={`flex-1 py-2 text-center text-xs font-semibold border-b-2 transition-colors ${
              step === 3 ? "border-[#004E72] text-[#004E72]" : "border-transparent text-[#64748B]"
            }`}
          >
            3. Operational Goals
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-20 text-center text-[#64748B]">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#004E72] mb-3" />
              <p className="text-sm font-medium">Loading domain templates...</p>
            </div>
          ) : (
            <>
              {/* STEP 1: Domain Template Selection */}
              {step === 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templates.map((tpl) => {
                    const isSelected = selectedTemplateId === tpl.template_id;
                    return (
                      <div
                        key={tpl.template_id}
                        onClick={() => handleTemplateSelect(tpl)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? "border-[#004E72] bg-[#F0F9FF] shadow-sm"
                            : "border-[#E2E8F0] hover:border-[#CBD5E1] bg-white hover:bg-[#F8FAFC]"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="p-2 rounded-lg bg-white border border-[#E2E8F0] shadow-2xs">
                            {getTemplateIcon(tpl.icon)}
                          </div>
                          {isSelected && <CheckCircle2 className="h-5 w-5 text-[#004E72]" />}
                        </div>
                        <h4 className="font-bold text-sm text-[#092634]">{tpl.name}</h4>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                          {tpl.category}
                        </span>
                        <p className="text-xs text-[#475569] mt-2 leading-relaxed line-clamp-2">
                          {tpl.description}
                        </p>
                        <div className="mt-3 pt-2.5 border-t border-[#E2E8F0]/60 flex flex-wrap gap-1">
                          {tpl.suggested_resource_types.slice(0, 3).map((rt) => (
                            <span
                              key={rt}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-white text-[#475569] border border-[#CBD5E1]"
                            >
                              {rt}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* STEP 2: Workspace Config */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center space-x-3 mb-4">
                    <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0]">
                      {getTemplateIcon(currentTemplate?.icon || "")}
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                        Selected Template
                      </span>
                      <h4 className="font-bold text-sm text-[#092634]">{currentTemplate?.name}</h4>
                      <p className="text-xs text-[#64748B]">{currentTemplate?.description}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#092634] mb-1">
                      Workspace Name *
                    </label>
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="e.g. Precision Fab-1 Assembly Hub"
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs font-medium text-[#092634] focus:outline-none focus:ring-1 focus:ring-[#004E72]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#092634] mb-1">
                        Workspace Code *
                      </label>
                      <input
                        type="text"
                        value={workspaceCode}
                        onChange={(e) => setWorkspaceCode(e.target.value.toUpperCase())}
                        placeholder="e.g. MFG-01"
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs font-mono font-medium text-[#092634] focus:outline-none focus:ring-1 focus:ring-[#004E72]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#092634] mb-1">
                        Location / Site
                      </label>
                      <input
                        type="text"
                        value={workspaceLocation}
                        onChange={(e) => setWorkspaceLocation(e.target.value)}
                        placeholder="e.g. Sector 4 East Wing"
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs font-medium text-[#092634] focus:outline-none focus:ring-1 focus:ring-[#004E72]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#092634] mb-1">
                      Operational Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="Brief summary of operations, shifts, or facility constraints..."
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs font-medium text-[#092634] focus:outline-none focus:ring-1 focus:ring-[#004E72]"
                    />
                  </div>

                  <div>
                    <span className="block text-xs font-semibold text-[#092634] mb-1.5">
                      Provisioned Resource Types (Auto-Generated)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {currentTemplate?.suggested_resource_types.map((rt) => (
                        <span
                          key={rt}
                          className="px-2 py-1 rounded bg-[#F1F5F9] border border-[#CBD5E1] text-xs text-[#092634] font-medium"
                        >
                          {rt}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Operational Goals */}
              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-xs text-[#475569]">
                    Select the target optimization goals to benchmark your facility against. You can
                    modify or add more goals at any time in the Workspace dashboard.
                  </p>

                  <div className="space-y-2.5">
                    {currentTemplate?.default_goals.map((g) => {
                      const isChecked = selectedGoals.includes(g);
                      return (
                        <div
                          key={g}
                          onClick={() => toggleGoal(g)}
                          className={`p-3.5 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-colors ${
                            isChecked
                              ? "border-[#004E72] bg-[#F0F9FF]"
                              : "border-[#E2E8F0] hover:border-[#CBD5E1] bg-white"
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Target className={`h-4 w-4 ${isChecked ? "text-[#004E72]" : "text-[#64748B]"}`} />
                            <span className="text-xs font-medium text-[#092634]">{g}</span>
                          </div>
                          <div
                            className={`h-5 w-5 rounded border flex items-center justify-center ${
                              isChecked
                                ? "bg-[#004E72] border-[#004E72] text-white"
                                : "border-[#CBD5E1] bg-white"
                            }`}
                          >
                            {isChecked && <CheckCircle2 className="h-4 w-4" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as any)}
              className="px-4 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#092634] flex items-center space-x-1.5 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#64748B] transition-colors"
            >
              Cancel
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as any)}
              className="px-5 py-2 rounded-lg bg-[#004E72] hover:bg-[#003B57] text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-colors"
            >
              <span>Continue</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !workspaceName.trim() || !workspaceCode.trim()}
              className="px-6 py-2 rounded-lg bg-[#FF6E42] hover:bg-[#e65c32] disabled:opacity-50 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Provisioning...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Launch Workspace</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
