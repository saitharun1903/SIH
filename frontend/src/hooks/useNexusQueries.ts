"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Workspace,
  Building,
  ResourceType,
  Resource,
  PaginatedResponse,
  AnalyticsSummary,
  UtilizationTrendPoint,
  EnergyTrendPoint,
  AnomalySummary,
  Anomaly,
  ForecastOverview,
  Recommendation,
  Scenario,
  ScenarioTemplate,
  Goal,
} from "@/lib/types";

// ==========================================
// WORKSPACE & METADATA QUERIES (5 min TTL)
// ==========================================

export function useWorkspacesQuery(enabled = true) {
  return useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: () => api.getWorkspaces(),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useBuildingsQuery(enabled = true) {
  return useQuery<Building[]>({
    queryKey: ["buildings"],
    queryFn: () => api.getBuildingsList(),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useResourceTypesQuery(enabled = true) {
  return useQuery<ResourceType[]>({
    queryKey: ["resource-types"],
    queryFn: () => api.getResourceTypes(),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

// ==========================================
// RESOURCE QUERIES (1 min TTL)
// ==========================================

export function useResourcesQuery(params: {
  search?: string;
  building_id?: number;
  resource_type_id?: number;
  status?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery<PaginatedResponse<Resource>>({
    queryKey: ["resources", params],
    queryFn: () => api.getResources(params),
    staleTime: 60 * 1000,
  });
}

// ==========================================
// ANALYTICS & TELEMETRY (30s TTL)
// ==========================================

export function useAnalyticsSummaryQuery(buildingId?: number) {
  return useQuery<AnalyticsSummary | null>({
    queryKey: ["analytics-summary", buildingId],
    queryFn: () => api.getAnalyticsSummary({ building_id: buildingId }).catch(() => null),
    staleTime: 30 * 1000,
  });
}

export function useUtilizationTrendsQuery(buildingId?: number) {
  return useQuery<UtilizationTrendPoint[]>({
    queryKey: ["utilization-trends", buildingId],
    queryFn: () => api.getUtilizationTrends({ building_id: buildingId }).catch(() => []),
    staleTime: 30 * 1000,
  });
}

export function useEnergyTrendsQuery(buildingId?: number) {
  return useQuery<EnergyTrendPoint[]>({
    queryKey: ["energy-trends", buildingId],
    queryFn: () => api.getEnergyTrends({ building_id: buildingId }).catch(() => []),
    staleTime: 30 * 1000,
  });
}

// ==========================================
// ANOMALIES & PREDICTIONS
// ==========================================

export function useAnomalySummaryQuery() {
  return useQuery<AnomalySummary | null>({
    queryKey: ["anomaly-summary"],
    queryFn: () => api.getAnomalySummary().catch(() => null),
    staleTime: 30 * 1000,
  });
}

export function useAnomaliesQuery(params: { status?: string; limit?: number; offset?: number } = {}) {
  return useQuery<{ items: Anomaly[]; total: number; limit: number; offset: number }>({
    queryKey: ["anomalies", params],
    queryFn: () => api.getAnomalies({ status: params.status || "Active", limit: params.limit || 10, offset: params.offset || 0 }),
    staleTime: 30 * 1000,
  });
}

export function useForecastOverviewQuery() {
  return useQuery<ForecastOverview | null>({
    queryKey: ["forecast-overview"],
    queryFn: () => api.getForecastOverview().catch(() => null),
    staleTime: 60 * 1000,
  });
}

export function useRecommendationsQuery() {
  return useQuery<Recommendation[]>({
    queryKey: ["recommendations"],
    queryFn: () => api.getRecommendations().catch(() => []),
    staleTime: 60 * 1000,
  });
}

// ==========================================
// IMPORT JOBS (15s TTL)
// ==========================================

export function useImportJobsQuery(page = 1, pageSize = 10) {
  return useQuery<PaginatedResponse<any>>({
    queryKey: ["import-jobs", page, pageSize],
    queryFn: () => api.getImportJobs(page, pageSize).catch(() => ({
      items: [],
      total: 0,
      page: 1,
      page_size: pageSize,
      total_pages: 1,
    })),
    staleTime: 15 * 1000,
  });
}

// ==========================================
// SCENARIOS & WHAT-IF (60s TTL)
// ==========================================

export function useScenariosQuery() {
  return useQuery<Scenario[]>({
    queryKey: ["scenarios"],
    queryFn: () => api.getScenarios().catch(() => []),
    staleTime: 60 * 1000,
  });
}

export function useScenarioTemplatesQuery() {
  return useQuery<ScenarioTemplate[]>({
    queryKey: ["scenario-templates"],
    queryFn: () => api.getScenarioTemplates().catch(() => []),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGoalsQuery() {
  return useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: () => api.getGoals().catch(() => []),
    staleTime: 60 * 1000,
  });
}
