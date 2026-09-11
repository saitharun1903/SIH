"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  Factory,
  HeartPulse,
  Warehouse,
  Briefcase,
  GraduationCap,
  Store,
  Layers,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Zap,
  TrendingUp,
  Clock,
  Building2,
  Cpu,
  Users,
  Package,
  CheckCircle2,
  X,
} from "lucide-react";

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: () => void;
  onSuccess?: () => void;
}

const DOMAIN_OPTIONS = [
  {
    id: "manufacturing",
    title: "Manufacturing & Factory",
    description: "Machines, CNC tools, assembly lines, and production throughput.",
    icon: Factory,
  },
  {
    id: "healthcare",
    title: "Hospital & Healthcare",
    description: "Inpatient beds, surgical theaters, wards, and clinical staff.",
    icon: HeartPulse,
  },
  {
    id: "warehouse",
    title: "Warehouse & Logistics",
    description: "Storage bays, docks, cold storage, pallets, and forklift fleet.",
    icon: Warehouse,
  },
  {
    id: "office",
    title: "Corporate Office",
    description: "Meeting rooms, open workstations, executive desks, and floors.",
    icon: Briefcase,
  },
  {
    id: "retail",
    title: "Retail & Stores",
    description: "Checkout counters, sales aisles, stockrooms, and staff shifts.",
    icon: Store,
  },
  {
    id: "education",
    title: "Education & Campus",
    description: "Classrooms, computer laboratories, lecture halls, and timetables.",
    icon: GraduationCap,
  },
  {
    id: "custom",
    title: "Custom Organization",
    description: "Define custom resources, metrics, and physical constraints.",
    icon: Layers,
  },
];

const RESOURCE_FOCUS_OPTIONS = [
  { id: "equipment", label: "Equipment & Machines", icon: Cpu },
  { id: "spaces", label: "Rooms & Physical Spaces", icon: Building2 },
  { id: "energy", label: "Energy & Sub-Meters", icon: Zap },
  { id: "people", label: "Staff & Shifts", icon: Users },
  { id: "inventory", label: "Inventory & Storage", icon: Package },
];

const GOAL_OPTIONS = [
  {
    id: "improve_utilization",
    title: "Improve Resource Utilization",
    description: "Eliminate idle capacity and balance operational loads (Target: 75%).",
    target: 75.0,
    unit: "%",
  },
  {
    id: "reduce_cost",
    title: "Reduce Operating & Energy Cost",
    description: "Identify phantom loads, peak grid tariffs, and waste (Target: -15%).",
    target: 15.0,
    unit: "%",
  },
  {
    id: "reduce_downtime",
    title: "Minimize Downtime & Delays",
    description: "Prevent machine outages and maintenance bottlenecks.",
    target: 20.0,
    unit: "%",
  },
  {
    id: "increase_capacity",
    title: "Maximize Capacity & Headroom",
    description: "Eliminate scheduling conflicts and absorb demand surges.",
    target: 0.0,
    unit: "conflicts",
  },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onClose,
  onCompleted,
  onSuccess,
}) => {
  const router = useRouter();
  const { currentWorkspace, refreshWorkspaces, switchWorkspace } = useWorkspace();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedDomain, setSelectedDomain] = useState<string>("manufacturing");
  const [selectedFocus, setSelectedFocus] = useState<string[]>(["equipment", "spaces"]);
  const [selectedGoal, setSelectedGoal] = useState<string>("improve_utilization");
  const [workspaceName, setWorkspaceName] = useState<string>("");
  const [initialResourceName, setInitialResourceName] = useState<string>("");
  const [initialResourceCode, setInitialResourceCode] = useState<string>("");
  const [initialCapacity, setInitialCapacity] = useState<number>(60);
  const [seedDemoData, setSeedDemoData] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleFocus = (id: string) => {
    setSelectedFocus((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const chosenDomainObj = DOMAIN_OPTIONS.find((d) => d.id === selectedDomain);
      const chosenGoalObj = GOAL_OPTIONS.find((g) => g.id === selectedGoal);

      const nameToUse =
        workspaceName.trim() ||
        `${chosenDomainObj?.title.split("&")[0].trim() || "Operational"} Workspace`;

      // 1. Create or update workspace
      const wsCode = `${selectedDomain.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      const newWs = await api.createWorkspace({
        name: nameToUse,
        code: wsCode,
        workspace_type: selectedDomain,
        description: `Operational workspace configured for ${chosenDomainObj?.title}. Focus: ${selectedFocus.join(", ")}.`,
        location: "Main Facility",
      });

      // 2. Add goal to workspace
      if (chosenGoalObj) {
        await api.createGoal({
          workspace_id: newWs.id,
          title: chosenGoalObj.title,
          goal_type: chosenGoalObj.id,
          target_value: chosenGoalObj.target,
          unit: chosenGoalObj.unit,
          description: chosenGoalObj.description,
          priority: "High",
        });
      }

      // 3. If user provided a specific initial resource
      if (initialResourceName.trim()) {
        const types = await api.getResourceTypes();
        const typeId = types.length > 0 ? types[0].id : 1;

        await api.createResource({
          workspace_id: newWs.id,
          resource_type_id: typeId,
          name: initialResourceName.trim(),
          code: initialResourceCode.trim() || `RES-${Math.floor(10 + Math.random() * 90)}`,
          capacity: initialCapacity,
          status: "Active",
          location: "Zone A",
        });
      }

      await refreshWorkspaces();
      switchWorkspace(newWs.id);

      setCurrentStep(5); // Success step
    } catch (err: any) {
      setError(err?.message || "Failed to finalize workspace setup.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#092634]/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E2E8F0] w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center space-x-2.5">
            <div className="h-7 w-7 rounded bg-[#004E72] text-white flex items-center justify-center font-bold text-xs">
              N
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#092634]">NEXUS Guided Setup</h2>
              <p className="text-[11px] text-[#64748B]">
                Configure resources, operational goals, and domain parameters
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#092634] hover:bg-[#E2E8F0] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748B] mb-2">
            <span>Step {currentStep} of 4</span>
            <span className="text-[#004E72]">
              {currentStep === 1 && "Organization Domain"}
              {currentStep === 2 && "Resource Focus"}
              {currentStep === 3 && "Primary Operational Goal"}
              {currentStep === 4 && "Initial Data & Launch"}
              {currentStep === 5 && "Setup Complete"}
            </span>
          </div>
          <div className="h-1.5 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#004E72] rounded-full transition-all duration-300"
              style={{ width: `${(Math.min(currentStep, 4) / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          )}

          {/* STEP 1: Organization Type */}
          {currentStep === 1 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-[#092634]">What type of organization are you configuring?</h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Controls resource terminology, default metrics, and solver constraints.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {DOMAIN_OPTIONS.map((d) => {
                  const Icon = d.icon;
                  const isSelected = selectedDomain === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedDomain(d.id)}
                      className={`text-left p-3 rounded-xl border transition-all flex items-start space-x-3 ${
                        isSelected
                          ? "border-[#004E72] bg-blue-50/50 shadow-xs"
                          : "border-[#E2E8F0] hover:border-[#CBD5E1] bg-white"
                      }`}
                    >
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          isSelected ? "bg-[#004E72] text-white" : "bg-[#F1F5F9] text-[#64748B]"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-[#092634] block truncate">
                          {d.title}
                        </span>
                        <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
                          {d.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Resource Focus */}
          {currentStep === 2 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-[#092634]">What resources will this workspace manage?</h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Select all that apply. You can add or modify resource types later.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {RESOURCE_FOCUS_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isChecked = selectedFocus.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleFocus(opt.id)}
                      className={`text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                        isChecked
                          ? "border-[#004E72] bg-blue-50/40 text-[#004E72]"
                          : "border-[#E2E8F0] hover:border-[#CBD5E1] bg-white text-[#475569]"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`h-4 w-4 ${isChecked ? "text-[#004E72]" : "text-[#64748B]"}`} />
                        <span className="font-semibold text-xs text-[#092634]">{opt.label}</span>
                      </div>
                      <div
                        className={`h-4 w-4 rounded border flex items-center justify-center text-xs ${
                          isChecked
                            ? "bg-[#004E72] border-[#004E72] text-white"
                            : "border-[#CBD5E1] bg-white"
                        }`}
                      >
                        {isChecked && <Check className="h-3 w-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2">
                <label className="block text-xs font-semibold text-[#092634] mb-1">
                  Workspace Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Assembly Line 1, Central Hospital, Main Logistics Hub"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#092634] focus:outline-hidden focus:ring-1 focus:ring-[#004E72]"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Operational Goal */}
          {currentStep === 3 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-[#092634]">What is your primary operational objective?</h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  NEXUS will align anomaly thresholds, recommendations, and simulations toward this target.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                {GOAL_OPTIONS.map((g) => {
                  const isSelected = selectedGoal === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGoal(g.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start justify-between ${
                        isSelected
                          ? "border-[#004E72] bg-blue-50/50 shadow-xs"
                          : "border-[#E2E8F0] hover:border-[#CBD5E1] bg-white"
                      }`}
                    >
                      <div>
                        <span className="font-bold text-xs text-[#092634] block">{g.title}</span>
                        <p className="text-[11px] text-[#64748B] mt-0.5">{g.description}</p>
                      </div>
                      {isSelected && (
                        <div className="h-5 w-5 rounded-full bg-[#004E72] text-white flex items-center justify-center shrink-0 ml-3">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Initial Data & Confirmation */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#092634]">Add your first resource or load sample data</h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  You can register a primary asset right now or explore using authentic domain benchmarks.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-3">
                <span className="font-bold text-xs text-[#092634] block">
                  Quick-Register Resource (Optional)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#64748B] mb-1 font-medium">
                      Resource Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CNC Unit 1 or Room 201"
                      value={initialResourceName}
                      onChange={(e) => setInitialResourceName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#CBD5E1] rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#64748B] mb-1 font-medium">
                      Capacity Rating
                    </label>
                    <input
                      type="number"
                      value={initialCapacity}
                      onChange={(e) => setInitialCapacity(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#CBD5E1] rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 flex items-start space-x-3">
                <Sparkles className="h-4 w-4 text-[#004E72] shrink-0 mt-0.5" />
                <div className="text-xs text-[#475569]">
                  <strong className="text-[#092634] block">Ready to Provision</strong>
                  NEXUS will initialize your domain template with calibrated anomaly detectors, solver weights, and metric definitions.
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Success Screen */}
          {currentStep === 5 && (
            <div className="py-8 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-[#092634]">Workspace Configured &amp; Active</h3>
              <p className="text-xs text-[#64748B] max-w-md mx-auto">
                Your operational environment has been created. Resource labels, metrics, and decision engines are now calibrated.
              </p>
              <div className="pt-4 flex justify-center gap-3">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    onClose();
                    if (onCompleted) onCompleted();
                    if (onSuccess) onSuccess();
                    router.push("/dashboard");
                  }}
                  className="bg-[#004E72] text-white"
                >
                  Open Dashboard
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    onClose();
                    if (onCompleted) onCompleted();
                    if (onSuccess) onSuccess();
                    router.push("/resources");
                  }}
                >
                  View Resources
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {currentStep < 5 && (
          <div className="px-6 py-3.5 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
            {currentStep > 1 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {currentStep < 4 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="text-xs bg-[#004E72] text-white"
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleFinish}
                isLoading={isSubmitting}
                className="text-xs bg-[#004E72] hover:bg-[#003d59] text-white shadow-sm"
              >
                <span>Complete Setup &amp; Launch</span>
                <Check className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
