"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Role } from "@/lib/types";
import {
  LayoutDashboard,
  Building2,
  Layers,
  CalendarDays,
  UploadCloud,
  CheckCircle2,
  Database,
  BarChart3,
  AlertTriangle,
  TrendingUp,
  SlidersHorizontal,
  GitCompare,
  Zap,
  FileText,
  Bot,
  History,
  Settings,
  Cpu,
  Sparkles,
  Target,
} from "lucide-react";
import clsx from "clsx";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { name: "Home", href: "/dashboard", icon: LayoutDashboard, roles: ["Administrator", "Analyst", "Viewer"] },
    ],
  },
  {
    title: "Workspace",
    items: [
      { name: "Workspaces & Goals", href: "/workspace", icon: Target, roles: ["Administrator", "Analyst", "Viewer"] },
      { name: "Resources", href: "/resources", icon: Layers, roles: ["Administrator", "Analyst", "Viewer"] },
      { name: "Facilities & Zones", href: "/buildings", icon: Building2, roles: ["Administrator", "Analyst", "Viewer"] },
      { name: "Schedules & Shifts", href: "/schedules", icon: CalendarDays, roles: ["Administrator", "Analyst", "Viewer"] },
    ],
  },
  {
    title: "Data",
    items: [
      { name: "Data Sources", href: "/data-sources", icon: Database, roles: ["Administrator", "Analyst", "Viewer"] },
      { name: "Import Data", href: "/imports", icon: UploadCloud, roles: ["Administrator"] },
      { name: "Data Quality", href: "/data-quality", icon: CheckCircle2, roles: ["Administrator", "Analyst"] },
    ],
  },
  {
    title: "Insights",
    items: [
      { name: "Analytics", href: "/analytics", icon: BarChart3, roles: ["Administrator", "Analyst", "Viewer"] },
      { name: "Anomalies", href: "/anomalies", icon: AlertTriangle, roles: ["Administrator", "Analyst"] },
      { name: "Forecasts", href: "/predictions", icon: TrendingUp, roles: ["Administrator", "Analyst"] },
    ],
  },
  {
    title: "Decisions",
    items: [
      { name: "What-If Simulator", href: "/simulator", icon: SlidersHorizontal, roles: ["Administrator", "Analyst"] },
      { name: "Scenarios", href: "/scenarios", icon: GitCompare, roles: ["Administrator", "Analyst"] },
      { name: "Recommendations", href: "/recommendations", icon: Sparkles, roles: ["Administrator", "Analyst", "Viewer"] },
    ],
  },
  {
    title: "Actions",
    items: [
      { name: "Action Center", href: "/actions", icon: Zap, roles: ["Administrator", "Analyst"] },
      { name: "Activity Log", href: "/audit", icon: History, roles: ["Administrator", "Analyst"] },
    ],
  },
  {
    title: "Reports & Assistant",
    items: [
      { name: "Reports", href: "/reports", icon: FileText, roles: ["Administrator", "Analyst", "Viewer"] },
      { name: "NEXUS Assistant", href: "/assistant", icon: Bot, roles: ["Administrator", "Analyst", "Viewer"] },
    ],
  },
  {
    title: "Settings",
    items: [
      { name: "Settings", href: "/settings", icon: Settings, roles: ["Administrator", "Analyst", "Viewer"] },
    ],
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const pathname = usePathname();
  const { hasRole } = useAuth();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#092634]/60 backdrop-blur-xs md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={clsx(
          "fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#092634] text-slate-200 border-r border-[#18455C] flex flex-col transition-transform duration-200 ease-out md:translate-x-0 select-none",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-[#18455C] bg-[#071F2B]">
          <Link href="/dashboard" className="flex items-center space-x-2.5">
            <div className="h-7 w-7 rounded bg-[#004E72] border border-[#1B4E6B] flex items-center justify-center text-white font-bold text-sm shadow-xs">
              N
            </div>
            <div>
              <span className="font-bold text-base text-white tracking-tight">NEXUS</span>
              <span className="block text-[9px] uppercase font-mono text-[#FF6E42] font-semibold tracking-wider">
                Smart Automation
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5">
          {navSections.map((section) => {
            const visibleItems = section.items.filter((item) => hasRole(item.roles));
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title} className="space-y-0.5">
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  {section.title}
                </div>
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={clsx(
                        "flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors",
                        isActive
                          ? "bg-[#004E72] text-white font-semibold shadow-xs border-l-2 border-[#FF6E42]"
                          : "text-[#94A3B8] hover:text-white hover:bg-[#113A4F]"
                      )}
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        <Icon
                          className={clsx(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-[#FF6E42]" : "text-[#64748B]"
                          )}
                        />
                        <span className="truncate">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#092634] text-[#FF6E42] border border-[#18455C] font-semibold">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer Identifier */}
        <div className="p-3 border-t border-[#18455C] bg-[#071F2B] text-[10px] text-[#64748B] flex flex-col space-y-0.5">
          <div className="flex justify-between items-center text-[#94A3B8]">
            <span className="font-semibold">NEXUS Platform</span>
            <span className="font-mono text-[9px] text-[#004E72] font-bold bg-[#EBF3F7] px-1 py-0.2 rounded">
              v1.0.0
            </span>
          </div>
          <p className="text-[10px] text-[#64748B] leading-tight">
            Resource Intelligence & Decisions
          </p>
        </div>
      </aside>
    </>
  );
};

