"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { Workspace } from "@/lib/types";
import { api } from "@/lib/api";
import { useAuth } from "./AuthContext";

export interface TerminologyConfig {
  resource: string;
  resourcePlural: string;
  group: string;
  unit: string;
  operator: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  terminology: TerminologyConfig;
  isEducationDomain: boolean;
  switchWorkspace: (workspaceId: number) => void;
  refreshWorkspaces: () => Promise<void>;
}

const DEFAULT_TERMINOLOGY: TerminologyConfig = {
  resource: "Resource",
  resourcePlural: "Resources",
  group: "Zone / Group",
  unit: "units",
  operator: "Staff",
};

const DOMAIN_TERMINOLOGIES: Record<string, TerminologyConfig> = {
  factory: {
    resource: "Machine",
    resourcePlural: "Machines & Lines",
    group: "Production Line",
    unit: "units",
    operator: "Operator",
  },
  hospital: {
    resource: "Facility Unit",
    resourcePlural: "Rooms & Beds",
    group: "Ward / Department",
    unit: "beds",
    operator: "Medical Staff",
  },
  warehouse: {
    resource: "Storage Unit",
    resourcePlural: "Bays & Docks",
    group: "Warehouse Zone",
    unit: "pallets",
    operator: "Worker",
  },
  office: {
    resource: "Workspace",
    resourcePlural: "Workspaces & Rooms",
    group: "Floor / Area",
    unit: "desks",
    operator: "Employee",
  },
  education: {
    resource: "Classroom / Lab",
    resourcePlural: "Rooms & Labs",
    group: "Building / Complex",
    unit: "seats",
    operator: "Faculty",
  },
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWorkspaces = async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setIsLoading(false);
      return;
    }

    try {
      const list = await api.getWorkspaces();
      setWorkspaces(list);

      if (list.length > 0) {
        const savedId = localStorage.getItem("nexus_workspace_id");
        const found = savedId ? list.find((w) => w.id === parseInt(savedId, 10)) : null;
        const selected = found || list[0];
        setCurrentWorkspace(selected);
        localStorage.setItem("nexus_workspace_id", selected.id.toString());
      }
    } catch (err) {
      console.error("Failed to load workspaces", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [user]);

  const switchWorkspace = (workspaceId: number) => {
    const selected = workspaces.find((w) => w.id === workspaceId);
    if (selected) {
      setCurrentWorkspace(selected);
      localStorage.setItem("nexus_workspace_id", selected.id.toString());
    }
  };

  const terminology = useMemo<TerminologyConfig>(() => {
    if (!currentWorkspace) return DEFAULT_TERMINOLOGY;
    const typeKey = (currentWorkspace.workspace_type || "").toLowerCase();
    return DOMAIN_TERMINOLOGIES[typeKey] || DEFAULT_TERMINOLOGY;
  }, [currentWorkspace]);

  const isEducationDomain = useMemo<boolean>(() => {
    if (!currentWorkspace) return false;
    return (currentWorkspace.workspace_type || "").toLowerCase() === "education";
  }, [currentWorkspace]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        isLoading,
        terminology,
        isEducationDomain,
        switchWorkspace,
        refreshWorkspaces: fetchWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
};
