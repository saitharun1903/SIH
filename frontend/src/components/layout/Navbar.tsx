"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { GlobalSearchModal } from "@/components/common/GlobalSearchModal";
import {
  Menu,
  ChevronDown,
  Bell,
  HelpCircle,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Activity,
  Layers,
  Building2,
  ExternalLink,
  Shield,
  Zap,
  Search,
  Factory,
  HeartPulse,
  Warehouse,
  Briefcase,
  GraduationCap,
  Plus,
  Check,
} from "lucide-react";

interface NavbarProps {
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, isSidebarCollapsed }) => {
  const { user, organization, logout } = useAuth();
  const { workspaces, currentWorkspace, switchWorkspace, terminology } = useWorkspace();

  // Health telemetry
  const [healthStatus, setHealthStatus] = useState<"healthy" | "degraded" | "checking">("checking");
  const [healthDetails, setHealthDetails] = useState<any>(null);
  const [showHealthMenu, setShowHealthMenu] = useState(false);

  // Dropdown states
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Live notification data from actual anomalies & recommendations
  const [alerts, setAlerts] = useState<Array<{ id: number; title: string; severity: string; time: string; link: string }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const helpMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const healthMenuRef = useRef<HTMLDivElement>(null);

  // Ctrl+K keyboard shortcut listener for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch real engine health
  useEffect(() => {
    let isMounted = true;
    const checkHealth = () => {
      api
        .getHealth()
        .then((res) => {
          if (isMounted) {
            setHealthDetails(res);
            setHealthStatus(res.status === "healthy" ? "healthy" : "degraded");
          }
        })
        .catch(() => {
          if (isMounted) {
            setHealthStatus("degraded");
          }
        });
    };
    checkHealth();
    const timer = setInterval(checkHealth, 60000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  // Fetch real alerts from active anomalies
  useEffect(() => {
    let isMounted = true;
    if (user) {
      api
        .getAnomalies({ status: "Active", limit: 5 })
        .then((res) => {
          if (isMounted && res && res.items) {
            const mapped = res.items.slice(0, 4).map((item: any) => ({
              id: item.id,
              title: `${item.resource_name || "Resource"} — ${item.anomaly_type?.replace("_", " ")}`,
              severity: item.severity || "Medium",
              time: item.detected_at ? new Date(item.detected_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Active",
              link: "/anomalies",
            }));
            setAlerts(mapped);
            setUnreadCount(res.total || mapped.length);
          }
        })
        .catch(() => {
          // Graceful fallback
        });
    }
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Click outside listener for all dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(e.target as Node)) {
        setShowWorkspaceMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (helpMenuRef.current && !helpMenuRef.current.contains(e.target as Node)) {
        setShowHelpMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (healthMenuRef.current && !healthMenuRef.current.contains(e.target as Node)) {
        setShowHealthMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getWorkspaceIcon = (type?: string) => {
    switch ((type || "").toLowerCase()) {
      case "factory":
        return <Factory className="h-3.5 w-3.5 text-blue-600 shrink-0" />;
      case "hospital":
        return <HeartPulse className="h-3.5 w-3.5 text-rose-500 shrink-0" />;
      case "warehouse":
        return <Warehouse className="h-3.5 w-3.5 text-amber-600 shrink-0" />;
      case "education":
        return <GraduationCap className="h-3.5 w-3.5 text-indigo-600 shrink-0" />;
      case "office":
        return <Briefcase className="h-3.5 w-3.5 text-emerald-600 shrink-0" />;
      default:
        return <Building2 className="h-3.5 w-3.5 text-[#004E72] shrink-0" />;
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "NX";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-14 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-4 sm:px-6 shadow-subtle select-none">
        {/* Left: Brand Identity + Workspace Switcher */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 rounded-md text-[#475569] hover:text-[#092634] hover:bg-[#F1F5F9] transition-colors focus:outline-none focus:ring-1 focus:ring-[#004E72]"
              aria-label="Toggle Navigation"
              title="Toggle Navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          {/* Brand Logomark */}
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="h-7 w-7 rounded bg-[#004E72] flex items-center justify-center text-white font-bold text-sm shadow-sm">
              N
            </div>
            <span className="font-bold text-base tracking-tight text-[#092634] hidden sm:inline">
              NEXUS
            </span>
          </Link>

          {/* Divider */}
          <div className="h-4 w-[1px] bg-[#E2E8F0] hidden sm:block" />

          {/* Workspace Switcher Dropdown */}
          <div className="relative" ref={workspaceMenuRef}>
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#092634] hover:bg-[#F1F5F9] border border-[#E2E8F0] hover:border-[#CBD5E1] transition-colors shadow-2xs"
            >
              {getWorkspaceIcon(currentWorkspace?.workspace_type)}
              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                {currentWorkspace?.name || organization?.name || "Primary Workspace"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-[#64748B]" />
            </button>

            {showWorkspaceMenu && (
              <div className="absolute left-0 mt-1.5 w-80 bg-white rounded-xl border border-[#E2E8F0] shadow-dropdown py-2 z-50 animate-fade-in text-xs">
                <div className="px-3.5 py-2 border-b border-[#F1F5F9]">
                  <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                    Workspaces &amp; Domains
                  </p>
                  <p className="text-[#64748B] text-[11px] mt-0.5">
                    Organization: <strong className="text-[#092634]">{organization?.name || "Active Org"}</strong>
                  </p>
                </div>

                <div className="max-h-64 overflow-y-auto py-1">
                  {workspaces.map((ws) => {
                    const isSelected = currentWorkspace?.id === ws.id;
                    return (
                      <button
                        key={ws.id}
                        onClick={() => {
                          switchWorkspace(ws.id);
                          setShowWorkspaceMenu(false);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between transition-colors ${
                          isSelected ? "bg-[#F0F9FF] text-[#004E72]" : "hover:bg-[#F8FAFC] text-[#092634]"
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          {getWorkspaceIcon(ws.workspace_type)}
                          <div className="min-w-0">
                            <p className="font-semibold text-xs truncate">{ws.name}</p>
                            <p className="text-[10px] text-[#64748B] uppercase font-mono tracking-wider mt-0.5">
                              {ws.code} • {ws.workspace_type}
                            </p>
                          </div>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-[#004E72] shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-[#F1F5F9] px-3.5 py-2 bg-[#F8FAFC]">
                  <Link
                    href="/workspace"
                    onClick={() => setShowWorkspaceMenu(false)}
                    className="flex items-center justify-center space-x-1.5 w-full py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-semibold text-[#004E72] hover:bg-[#F1F5F9] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Manage &amp; Add Workspaces</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Grounded Global Search (Ctrl+K) */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
          <button
            onClick={() => setShowSearchModal(true)}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#092634] text-xs transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Search className="h-3.5 w-3.5 text-[#94A3B8]" />
              <span>Search resources, anomalies, scenarios...</span>
            </div>
            <kbd className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-white text-[#64748B] border border-[#CBD5E1]">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right: Engine Status + Alerts + Help + User Menu */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Mobile Search Button */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="p-1.5 rounded-md text-[#475569] hover:bg-[#F1F5F9] md:hidden"
            title="Search"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Real-Time Engine Health Status */}
          <div className="relative" ref={healthMenuRef}>
            <button
              onClick={() => setShowHealthMenu(!showHealthMenu)}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
              title="System Engine Telemetry"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  healthStatus === "healthy"
                    ? "bg-emerald-500"
                    : healthStatus === "checking"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-rose-500"
                }`}
              />
              <span className="text-[#092634] text-xs font-medium hidden md:inline">
                {healthStatus === "healthy" ? "Connected" : healthStatus === "checking" ? "Checking" : "Offline"}
              </span>
            </button>

            {showHealthMenu && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-lg border border-[#E2E8F0] shadow-dropdown p-3 z-50 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
                  <span className="font-semibold text-[#092634]">System Status</span>
                  <Badge variant={healthStatus === "healthy" ? "success" : "warning"} size="sm">
                    {healthStatus.toUpperCase()}
                  </Badge>
                </div>
                <div className="mt-2 space-y-1.5 text-[11px] text-[#475569]">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Core Version:</span>
                    <span className="font-mono font-medium">{healthDetails?.version || "2.1.0"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Database:</span>
                    <span className="font-medium text-emerald-700">
                      {healthDetails?.database?.dialect || "Database"} (Live)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Constraint Solver:</span>
                    <span className="font-medium text-[#004E72]">OR-Tools CP-SAT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Anomaly Detector:</span>
                    <span className="font-medium text-emerald-700">Isolation Forest</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live Notification Bell */}
          <div className="relative" ref={notifMenuRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-1.5 rounded-md text-[#475569] hover:text-[#092634] hover:bg-[#F1F5F9] transition-colors focus:outline-none"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#FF6E42] ring-2 ring-white" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-1.5 w-80 bg-white rounded-lg border border-[#E2E8F0] shadow-dropdown py-2 z-50 text-xs animate-fade-in">
                <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-[#F1F5F9]">
                  <span className="font-bold text-[#092634]">Actionable Alerts</span>
                  <Badge variant={unreadCount > 0 ? "orange" : "neutral"} size="sm">
                    {unreadCount} Active
                  </Badge>
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-[#F1F5F9]">
                  {alerts.length === 0 ? (
                    <div className="px-3.5 py-6 text-center text-[#64748B]">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
                      <p className="font-medium text-[#092634]">All Systems Nominal</p>
                      <p className="text-[11px]">No critical resource anomalies detected</p>
                    </div>
                  ) : (
                    alerts.map((alt) => (
                      <Link
                        key={alt.id}
                        href={alt.link}
                        onClick={() => setShowNotifications(false)}
                        className="block px-3.5 py-2.5 hover:bg-[#F8FAFC] transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-semibold text-[#092634] leading-tight">
                            {alt.title}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ml-2 uppercase shrink-0 ${
                              alt.severity === "Critical"
                                ? "bg-rose-100 text-rose-800"
                                : alt.severity === "High"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {alt.severity}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#64748B] mt-1 block">
                          Active anomaly • {alt.time}
                        </span>
                      </Link>
                    ))
                  )}
                </div>

                <div className="border-t border-[#F1F5F9] px-3.5 py-1.5 text-center">
                  <Link
                    href="/anomalies"
                    onClick={() => setShowNotifications(false)}
                    className="text-[11px] font-semibold text-[#004E72] hover:underline"
                  >
                    View All Anomalies &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Help & Documentation Menu */}
          <div className="relative" ref={helpMenuRef}>
            <button
              onClick={() => setShowHelpMenu(!showHelpMenu)}
              className="p-1.5 rounded-md text-[#475569] hover:text-[#092634] hover:bg-[#F1F5F9] transition-colors focus:outline-none"
              aria-label="Help and Documentation"
              title="Documentation & Guidance"
            >
              <HelpCircle className="h-5 w-5" />
            </button>

            {showHelpMenu && (
              <div className="absolute right-0 mt-1.5 w-72 bg-white rounded-lg border border-[#E2E8F0] shadow-dropdown py-2 z-50 text-xs animate-fade-in">
                <div className="px-3.5 py-1.5 border-b border-[#F1F5F9]">
                  <p className="font-bold text-[#092634]">NEXUS Platform</p>
                  <p className="text-[#64748B] text-[11px]">Resource Intelligence &amp; Decisions</p>
                </div>
                <div className="py-1">
                  <Link
                    href="/reports"
                    onClick={() => setShowHelpMenu(false)}
                    className="flex items-center px-3.5 py-2 text-[#475569] hover:bg-[#F8FAFC] hover:text-[#092634] transition-colors"
                  >
                    <FileText className="h-4 w-4 mr-2 text-[#004E72]" />
                    <div>
                      <p className="font-medium">Reports</p>
                      <p className="text-[10px] text-[#64748B]">Resource utilization and health reports</p>
                    </div>
                  </Link>
                  <Link
                    href="/simulator"
                    onClick={() => setShowHelpMenu(false)}
                    className="flex items-center px-3.5 py-2 text-[#475569] hover:bg-[#F8FAFC] hover:text-[#092634] transition-colors"
                  >
                    <Zap className="h-4 w-4 mr-2 text-[#FF6E42]" />
                    <div>
                      <p className="font-medium">What-If Simulator Guide</p>
                      <p className="text-[10px] text-[#64748B]">Test operational changes before applying</p>
                    </div>
                  </Link>
                  <Link
                    href="/assistant"
                    onClick={() => setShowHelpMenu(false)}
                    className="flex items-center px-3.5 py-2 text-[#475569] hover:bg-[#F8FAFC] hover:text-[#092634] transition-colors"
                  >
                    <Shield className="h-4 w-4 mr-2 text-emerald-600" />
                    <div>
                      <p className="font-medium">NEXUS Assistant</p>
                      <p className="text-[10px] text-[#64748B]">Ask questions about your resources</p>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Menu */}
          {user && (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 pl-1 pr-1.5 py-1 rounded-md hover:bg-[#F1F5F9] transition-colors focus:outline-none"
              >
                <div className="h-7 w-7 rounded-full bg-[#092634] text-white flex items-center justify-center font-bold text-xs">
                  {getInitials(user.name)}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-semibold text-[#092634] leading-none">
                    {user.name}
                  </span>
                  <span className="text-[10px] text-[#64748B] mt-0.5 leading-none">
                    {user.role}
                  </span>
                </div>
                <ChevronDown className="h-3 w-3 text-[#64748B]" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-lg border border-[#E2E8F0] shadow-dropdown py-1.5 z-50 text-xs animate-fade-in">
                  <div className="px-3.5 py-2 border-b border-[#F1F5F9]">
                    <p className="font-semibold text-[#092634]">{user.name}</p>
                    <p className="text-[11px] text-[#64748B] truncate">{user.email}</p>
                    <div className="mt-1.5">
                      <Badge variant="blue" size="sm">
                        {user.role}
                      </Badge>
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/workspace"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center px-3.5 py-2 text-[#475569] hover:bg-[#F8FAFC] hover:text-[#092634] transition-colors"
                    >
                      <Layers className="h-3.5 w-3.5 mr-2 text-[#64748B]" />
                      <span>Workspaces &amp; Goals</span>
                    </Link>
                    <Link
                      href="/reports"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center px-3.5 py-2 text-[#475569] hover:bg-[#F8FAFC] hover:text-[#092634] transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5 mr-2 text-[#64748B]" />
                      <span>Executive Reports</span>
                    </Link>
                  </div>

                  <div className="border-t border-[#F1F5F9] pt-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="w-full flex items-center px-3.5 py-2 text-rose-600 hover:bg-rose-50 transition-colors font-medium text-left"
                    >
                      <LogOut className="h-3.5 w-3.5 mr-2 text-rose-600" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Grounded Global Search Modal */}
      <GlobalSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
      />
    </>
  );
};
