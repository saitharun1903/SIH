import {
  AuthTokenResponse,
  SystemHealth,
  User,
  AnalyticsSummary,
  UtilizationTrendPoint,
  EnergyTrendPoint,
  ResourceUtilizationRank,
  BuildingAnalytics,
  PeakDemandPoint,
  Anomaly,
  AnomalySummary,
  ForecastResponse,
  ForecastOverview,
  OptimizationRequest,
  OptimizationResponse,
  Scenario,
  ScenarioTemplate,
  ScenarioCreate,
  ScenarioResult,
  Building,
  Resource,
  Schedule,
  PaginatedResponse,
  Recommendation,
  AuditLogEntry,
  DataSource,
  ProfilingReport,
  IngestionResult,
  BenchmarkEvaluationReport,
  MacroGridProfile,
  MultiSourceIntelligenceResponse,
} from "./types";

const rawBase = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const API_BASE = rawBase.endsWith("/api/v1")
  ? rawBase
  : `${rawBase.replace(/\/+$/, "")}/api/v1`;

class ApiClient {
  public getToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nexus_access_token");
    }
    return null;
  }

  public getApiUrl(path: string): string {
    const clean = path.startsWith("/api/v1") ? path.substring(7) : path;
    const normalized = clean.startsWith("/") ? clean : `/${clean}`;
    return `${API_BASE}${normalized}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let cleanEndpoint = endpoint;
    if (cleanEndpoint.startsWith("/api/v1")) {
      cleanEndpoint = cleanEndpoint.substring(7);
    }
    if (!cleanEndpoint.startsWith("/") && !endpoint.startsWith("http")) {
      cleanEndpoint = `/${cleanEndpoint}`;
    }

    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${cleanEndpoint}`;

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        localStorage.removeItem("nexus_access_token");
        localStorage.removeItem("nexus_user");
        window.location.href = "/login?expired=1";
      }
    }

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.error?.message || data?.detail || `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  // Auth Helpers
  async login(email: string, password: string): Promise<AuthTokenResponse> {
    return this.post<AuthTokenResponse>("/auth/login", { email, password });
  }

  async getProfile(): Promise<User> {
    return this.get<User>("/auth/me");
  }

  async getHealth(): Promise<SystemHealth> {
    return this.get<SystemHealth>("/health");
  }

  // Analytics Helpers
  async getAnalyticsSummary(params?: {
    building_id?: number;
    resource_type_id?: number;
    resource_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<AnalyticsSummary> {
    const q = new URLSearchParams();
    if (params?.building_id) q.set("building_id", params.building_id.toString());
    if (params?.resource_type_id) q.set("resource_type_id", params.resource_type_id.toString());
    if (params?.resource_id) q.set("resource_id", params.resource_id.toString());
    if (params?.start_date) q.set("start_date", params.start_date);
    if (params?.end_date) q.set("end_date", params.end_date);
    const qs = q.toString();
    return this.get<AnalyticsSummary>(`/analytics/summary${qs ? `?${qs}` : ""}`);
  }

  async getUtilizationTrends(params?: {
    building_id?: number;
    resource_type_id?: number;
    resource_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<UtilizationTrendPoint[]> {
    const q = new URLSearchParams();
    if (params?.building_id) q.set("building_id", params.building_id.toString());
    if (params?.resource_type_id) q.set("resource_type_id", params.resource_type_id.toString());
    if (params?.resource_id) q.set("resource_id", params.resource_id.toString());
    if (params?.start_date) q.set("start_date", params.start_date);
    if (params?.end_date) q.set("end_date", params.end_date);
    const qs = q.toString();
    return this.get<UtilizationTrendPoint[]>(`/analytics/utilization-trends${qs ? `?${qs}` : ""}`);
  }

  async getEnergyTrends(params?: {
    building_id?: number;
    resource_type_id?: number;
    resource_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<EnergyTrendPoint[]> {
    const q = new URLSearchParams();
    if (params?.building_id) q.set("building_id", params.building_id.toString());
    if (params?.resource_type_id) q.set("resource_type_id", params.resource_type_id.toString());
    if (params?.resource_id) q.set("resource_id", params.resource_id.toString());
    if (params?.start_date) q.set("start_date", params.start_date);
    if (params?.end_date) q.set("end_date", params.end_date);
    const qs = q.toString();
    return this.get<EnergyTrendPoint[]>(`/analytics/energy-trends${qs ? `?${qs}` : ""}`);
  }

  async getResourceRankings(params?: {
    category?: "underutilized" | "overloaded" | "optimal";
    building_id?: number;
    resource_type_id?: number;
    limit?: number;
  }): Promise<ResourceUtilizationRank[]> {
    const q = new URLSearchParams();
    if (params?.category) q.set("category", params.category);
    if (params?.building_id) q.set("building_id", params.building_id.toString());
    if (params?.resource_type_id) q.set("resource_type_id", params.resource_type_id.toString());
    if (params?.limit) q.set("limit", params.limit.toString());
    const qs = q.toString();
    return this.get<ResourceUtilizationRank[]>(`/analytics/resource-rankings${qs ? `?${qs}` : ""}`);
  }

  async getBuildingComparison(): Promise<BuildingAnalytics[]> {
    return this.get<BuildingAnalytics[]>("/analytics/building-comparison");
  }

  async getPeakDemand(): Promise<PeakDemandPoint[]> {
    return this.get<PeakDemandPoint[]>("/analytics/peak-demand");
  }

  // Anomaly Helpers
  async getAnomalySummary(): Promise<AnomalySummary> {
    return this.get<AnomalySummary>("/anomalies/summary");
  }

  async getAnomalies(params?: {
    status?: string;
    severity?: string;
    metric_type?: string;
    anomaly_type?: string;
    building_id?: number;
    resource_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Anomaly[]; total: number; limit: number; offset: number }> {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.severity) q.set("severity", params.severity);
    if (params?.metric_type) q.set("metric_type", params.metric_type);
    if (params?.anomaly_type) q.set("anomaly_type", params.anomaly_type);
    if (params?.building_id) q.set("building_id", params.building_id.toString());
    if (params?.resource_id) q.set("resource_id", params.resource_id.toString());
    if (params?.limit) q.set("limit", params.limit.toString());
    if (params?.offset !== undefined) q.set("offset", params.offset.toString());
    const qs = q.toString();
    return this.get<{ items: Anomaly[]; total: number; limit: number; offset: number }>(
      `/anomalies${qs ? `?${qs}` : ""}`
    );
  }

  async triggerAnomalyDetection(params?: {
    contamination?: number;
    resource_id?: number;
    building_id?: number;
  }): Promise<{ success: boolean; message: string; count: number }> {
    return this.post<{ success: boolean; message: string; count: number }>(
      "/anomalies/detect",
      params || {}
    );
  }

  async updateAnomalyStatus(
    anomalyId: number,
    status: "Active" | "Acknowledged" | "Resolved" | "Dismissed",
    resolutionNotes?: string
  ): Promise<Anomaly> {
    return this.request<Anomaly>(`/anomalies/${anomalyId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, resolution_notes: resolutionNotes }),
    });
  }

  // Phase 3: LEAD Anomaly Ground-Truth Benchmark
  async getAnomalyBenchmarkReport(): Promise<BenchmarkEvaluationReport> {
    return this.get<BenchmarkEvaluationReport>("/anomalies/benchmark/report");
  }

  async runAnomalyBenchmark(contamination: number = 0.05): Promise<BenchmarkEvaluationReport> {
    return this.post<BenchmarkEvaluationReport>(
      `/anomalies/benchmark/evaluate?contamination=${contamination}`,
      {}
    );
  }

  // Forecasting Helpers
  async getForecastOverview(): Promise<ForecastOverview> {
    return this.get<ForecastOverview>("/predictions/overview");
  }

  async getForecast(params?: {
    resource_id?: number;
    building_id?: number;
    metric_name?: "utilization" | "occupancy" | "energy";
    horizon?: "1d" | "7d" | "30d";
  }): Promise<ForecastResponse> {
    return this.post<ForecastResponse>("/predictions/forecast", params || {});
  }

  // Optimization Engine (Google OR-Tools CP-SAT)
  async solveOptimization(payload: OptimizationRequest): Promise<OptimizationResponse> {
    return this.post<OptimizationResponse>("/optimization/solve", payload);
  }

  // Resources & Buildings
  async getBuildings(params?: {
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<Building>> {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.page) q.set("page", params.page.toString());
    if (params?.page_size) q.set("page_size", params.page_size.toString());
    const qs = q.toString();
    const res = await this.get<PaginatedResponse<Building>>(`/buildings${qs ? `?${qs}` : ""}`);
    if (!res || !Array.isArray(res.items)) {
      throw new Error("Invalid buildings response: expected items array");
    }
    return res;
  }

  async getBuildingsList(params?: { search?: string }): Promise<Building[]> {
    const res = await this.getBuildings({ search: params?.search, page_size: 100 });
    return res.items || [];
  }

  async getResources(params?: {
    search?: string;
    building_id?: number;
    resource_type_id?: number;
    status?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<Resource>> {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.building_id) q.set("building_id", params.building_id.toString());
    if (params?.resource_type_id) q.set("resource_type_id", params.resource_type_id.toString());
    if (params?.status) q.set("status", params.status);
    if (params?.page) q.set("page", params.page.toString());
    if (params?.page_size) q.set("page_size", params.page_size.toString());
    const qs = q.toString();
    const res = await this.get<PaginatedResponse<Resource>>(`/resources${qs ? `?${qs}` : ""}`);
    if (!res || !Array.isArray(res.items)) {
      throw new Error("Invalid resources response: expected items array");
    }
    return res;
  }

  async getResourcesList(params?: { building_id?: number }): Promise<Resource[]> {
    const res = await this.getResources({ building_id: params?.building_id, page_size: 100 });
    return res.items || [];
  }

  async getSchedules(params?: {
    day_of_week?: string;
    resource_id?: number;
    department?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<Schedule>> {
    const q = new URLSearchParams();
    if (params?.day_of_week) q.set("day_of_week", params.day_of_week);
    if (params?.resource_id) q.set("resource_id", params.resource_id.toString());
    if (params?.department) q.set("department", params.department);
    if (params?.page) q.set("page", params.page.toString());
    if (params?.page_size) q.set("page_size", params.page_size.toString());
    const qs = q.toString();
    const res = await this.get<PaginatedResponse<Schedule>>(`/schedules${qs ? `?${qs}` : ""}`);
    if (!res || !Array.isArray(res.items)) {
      throw new Error("Invalid schedules response: expected items array");
    }
    return res;
  }

  // What-If Scenario Simulation
  async getScenarioTemplates(): Promise<ScenarioTemplate[]> {
    return this.get<ScenarioTemplate[]>("/scenarios/templates");
  }

  async getScenarios(): Promise<Scenario[]> {
    return this.get<Scenario[]>("/scenarios");
  }

  async getScenario(scenarioId: number): Promise<Scenario> {
    return this.get<Scenario>(`/scenarios/${scenarioId}`);
  }

  async createScenario(payload: ScenarioCreate): Promise<Scenario> {
    return this.post<Scenario>("/scenarios", payload);
  }

  async deleteScenario(scenarioId: number): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/scenarios/${scenarioId}`, {
      method: "DELETE",
    });
  }

  async simulateScenario(
    scenarioId: number,
    dayOfWeek?: string
  ): Promise<ScenarioResult> {
    const qs = dayOfWeek && dayOfWeek.toLowerCase() !== "all" ? `?day_of_week=${encodeURIComponent(dayOfWeek)}` : "";
    return this.post<ScenarioResult>(`/scenarios/${scenarioId}/simulate${qs}`, {});
  }

  // Phase 10: Action Center & Audit Trail
  async getRecommendations(params?: {
    status?: string;
    priority?: string;
  }): Promise<Recommendation[]> {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.priority) q.set("priority", params.priority);
    const qs = q.toString();
    return this.get<Recommendation[]>(`/actions/recommendations${qs ? `?${qs}` : ""}`);
  }

  async generateRecommendations(): Promise<Recommendation[]> {
    return this.post<Recommendation[]>("/actions/recommendations/generate", {});
  }

  async applyRecommendation(
    recommendationId: number,
    notes?: string
  ): Promise<{ success: boolean; recommendation_id: number; new_status: string }> {
    return this.post<{ success: boolean; recommendation_id: number; new_status: string }>(
      `/actions/recommendations/${recommendationId}/apply`,
      { notes }
    );
  }

  async dismissRecommendation(
    recommendationId: number,
    notes?: string
  ): Promise<{ success: boolean; recommendation_id: number; new_status: string }> {
    return this.post<{ success: boolean; recommendation_id: number; new_status: string }>(
      `/actions/recommendations/${recommendationId}/dismiss`,
      { notes }
    );
  }

  async simulateRecommendation(
    recommendationId: number
  ): Promise<{ recommendation_id: number; scenario_id: number; simulation: ScenarioResult }> {
    return this.post<{ recommendation_id: number; scenario_id: number; simulation: ScenarioResult }>(
      `/actions/recommendations/${recommendationId}/simulate`,
      {}
    );
  }

  async getAuditLogs(limit: number = 50): Promise<AuditLogEntry[]> {
    return this.get<AuditLogEntry[]>(`/actions/audit-log?limit=${limit}`);
  }

  // Phase 11: Pluggable AI Assistant
  async getAssistantSuggestedPrompts(): Promise<string[]> {
    return this.get<string[]>("/assistant/suggested-prompts");
  }

  async askAssistant(prompt: string): Promise<{
    answer: string;
    category: string;
    metrics: Record<string, any>;
    data_table?: any[];
    suggested_actions?: Array<{ label: string; href: string }>;
  }> {
    return this.post("/assistant/chat", { prompt });
  }

  // Phase 12: Institutional Reports & Export
  async getExecutiveSummaryReport(): Promise<any> {
    return this.get<any>("/reports/executive-summary");
  }

  getExportUrl(type: "utilization" | "anomalies" | "energy"): string {
    const token = this.getToken();
    return `${API_BASE}/reports/export/${type}-csv${token ? `?token=${token}` : ""}`;
  }

  async inspectImportFile(file: File): Promise<any> {
    const token = this.getToken();
    const formData = new FormData();
    formData.append("file", file);
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}/imports/inspect`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Inspection failed with status ${res.status}`);
    }
    return res.json();
  }

  getImportJobErrorsUrl(jobId: number): string {
    const token = this.getToken();
    return `${API_BASE}/imports/jobs/${jobId}/errors${token ? `?token=${token}` : ""}`;
  }

  getImportTemplateUrl(type: string): string {
    return `${API_BASE}/imports/templates/${type}`;
  }

  // Phase 1 & 2: Data Source Registry & Kaggle Ingestion
  async getDataSources(provider?: string): Promise<DataSource[]> {
    const qs = provider ? `?provider=${encodeURIComponent(provider)}` : "";
    return this.get<DataSource[]>(`/data-sources${qs}`);
  }

  async getProfilingReport(): Promise<ProfilingReport> {
    return this.get<ProfilingReport>("/data-sources/profiling-report");
  }

  async ingestAshrae(limitBuildings: number = 5, daysLimit: number = 30): Promise<IngestionResult> {
    return this.post<IngestionResult>(
      `/data-sources/ingest-ashrae?limit_buildings=${limitBuildings}&days_limit=${daysLimit}`,
      {}
    );
  }

  async runKaggleIngestion(limitBuildings: number = 5, daysLimit: number = 30): Promise<IngestionResult> {
    return this.ingestAshrae(limitBuildings, daysLimit);
  }

  async ingestLeadDataset(): Promise<any> {
    return this.post<any>("/data-sources/ingest-lead", {});
  }

  // Phase 4: Macro-Energy & Weather Covariates
  async getMacroGridTrends(): Promise<MacroGridProfile> {
    return this.get<MacroGridProfile>("/analytics/macro-grid-trends");
  }

  async ingestPjmDataset(): Promise<any> {
    return this.post<any>("/data-sources/ingest-pjm", {});
  }

  // Phase 5: Multi-Source Hybrid Intelligence & Co-Optimization
  async getMultiSourceIntelligence(threshold: number = 0.50): Promise<MultiSourceIntelligenceResponse> {
    return this.get<MultiSourceIntelligenceResponse>(`/analytics/multi-source-intelligence?threshold=${threshold}`);
  }

  async dispatchMultiSourceRecommendations(collisionIds?: number[]): Promise<{ status: string; dispatched_count: number; recommendations: string[] }> {
    return this.post("/analytics/multi-source/dispatch", { collision_ids: collisionIds });
  }
}

export const api = new ApiClient();
