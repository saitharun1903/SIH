export type Role = "Administrator" | "Analyst" | "Viewer";

export interface User {
  id: number;
  organization_id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface Organization {
  id: number;
  name: string;
  organization_type: string;
  location: string;
  timezone: string;
  created_at: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
  organization?: Organization;
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "error";
  timestamp: string;
  app_name: string;
  environment: string;
  database: {
    status: string;
    dialect: string;
  };
  version: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Building {
  id: number;
  organization_id: number;
  name: string;
  code: string;
  location: string;
  floor_count: number;
  resource_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ResourceType {
  id: number;
  organization_id: number;
  name: string;
  category: string;
  unit: string;
  description?: string;
  config_json?: string;
  created_at: string;
  updated_at: string;
}

export interface Resource {
  id: number;
  organization_id: number;
  building_id?: number;
  resource_type_id: number;
  name: string;
  code: string;
  capacity: number;
  status: "Active" | "Inactive" | "Maintenance";
  floor: number;
  area: number;
  location: string;
  metadata_json?: string;
  building_name?: string;
  building_code?: string;
  resource_type_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: number;
  organization_id: number;
  resource_id: number;
  subject_name: string;
  department: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  expected_occupancy: number;
  actual_occupancy?: number;
  equipment_requirements?: string;
  resource_name?: string;
  resource_code?: string;
  building_name?: string;
  subject_code?: string;
  [key: string]: any;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsSummary {
  overall_utilization_percent: number;
  total_energy_kwh: number;
  total_energy_cost: number;
  average_daily_energy_kwh: number;
  energy_per_occupied_hour: number;
  energy_per_student: number;
  total_spaces_analyzed: number;
  underutilized_count: number;
  overloaded_count: number;
  optimal_count: number;
  underutilized_threshold: number;
  overloaded_threshold: number;
  total_scheduled_hours?: number;
  total_capacity_seats?: number;
  [key: string]: any;
  date_range_start: string;
  date_range_end: string;
}

export interface UtilizationTrendPoint {
  timestamp: string;
  avg_utilization: number;
  peak_utilization: number;
  avg_occupancy: number;
  total_capacity: number;
  utilization_percent?: number;
  occupied_spaces?: number;
  total_spaces?: number;
}

export interface EnergyTrendPoint {
  timestamp: string;
  consumption_kwh: number;
  cost: number;
  occupied_spaces_count: number;
  energy_kwh?: number;
  total_kwh?: number;
}

export interface ResourceUtilizationRank {
  resource_id: number;
  resource_name: string;
  resource_code: string;
  building_name: string;
  capacity: number;
  avg_utilization_percent: number;
  total_energy_kwh: number;
  status_category: "underutilized" | "overloaded" | "optimal";
}

export interface BuildingAnalytics {
  building_id: number;
  building_name: string;
  building_code: string;
  resource_count: number;
  avg_utilization_percent: number;
  total_energy_kwh: number;
  energy_per_sqm: number;
}

export interface PeakDemandPoint {
  hour_of_day: number;
  avg_utilization_percent: number;
  avg_energy_kwh: number;
}

export interface ContributingFactor {
  factor: string;
  impact: string;
  detail: string;
}

export interface Anomaly {
  id: number;
  organization_id: number;
  resource_id: number;
  resource_name?: string;
  resource_code?: string;
  building_name?: string;
  metric_type: string;
  anomaly_type: string;
  timestamp: string;
  detected_at?: string;
  expected_value: number;
  actual_value: number;
  deviation_percent: number;
  severity: "Critical" | "High" | "Medium" | "Low";
  reason: string;
  description?: string;
  contributing_factors?: ContributingFactor[];
  status: "Active" | "Acknowledged" | "Resolved" | "Dismissed";
  resolved_by?: number;
  resolution_notes?: string;
  resolved_at?: string;
  estimated_waste_cost?: number;
  financial_loss?: number;
  created_at: string;
}

export interface AnomalySummary {
  total_anomalies: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  active_count: number;
  acknowledged_count: number;
  resolved_count: number;
  dismissed_count: number;
  by_type: Record<string, number>;
  by_severity?: Record<string, number>;
  estimated_wasted_kwh: number;
  estimated_financial_loss: number;
  total_waste_cost_inr?: number;
}

export interface PredictionPoint {
  target_timestamp: string;
  timestamp?: string;
  predicted_value: number;
  lower_bound: number;
  upper_bound: number;
  [key: string]: any;
}

export interface HistoricalPoint {
  timestamp: string;
  actual_value: number;
}

export interface ModelMetrics {
  mape: number;
  rmse: number;
  mae: number;
  r2: number;
  samples_trained: number;
  data_coverage_days: number;
  model_name: string;
  predicted_avg?: number;
  predicted_peak?: number;
  confidence_bounds?: {
    lower?: number;
    upper?: number;
  };
  [key: string]: any;
}

export interface ForecastResponse {
  resource_id?: number;
  resource_name?: string;
  resource_code?: string;
  building_name?: string;
  metric_name: "utilization" | "occupancy" | "energy";
  horizon: "1d" | "7d" | "30d";
  generated_at: string;
  metrics: ModelMetrics;
  historical: HistoricalPoint[];
  forecast: PredictionPoint[];
}

export interface ForecastOverview {
  total_spaces_forecasted: number;
  avg_forecasted_utilization: number;
  peak_forecasted_utilization: number;
  projected_energy_kwh: number;
  projected_energy_cost: number;
  high_demand_spaces_count: number;
  data_sufficiency_status: "SUFFICIENT" | "INSUFFICIENT";
  historical_days_available: number;
  peak_utilization_surge?: number;
  [key: string]: any;
}

// Phase 7 & 8: Optimization & What-If Simulation
export interface OptimizationWeights {
  energy_weight: number;
  utilization_weight: number;
  stability_weight: number;
}

export interface OptimizationRequest {
  building_id?: number;
  day_of_week?: string;
  excluded_days?: string[];
  deactivated_resource_ids?: number[];
  enrollment_multiplier?: number;
  weights?: OptimizationWeights;
  max_solve_seconds?: number;
}

export interface ReallocatedEvent {
  schedule_id: number;
  subject_name: string;
  department: string;
  day_of_week: string;
  time_slot: string;
  expected_occupancy: number;
  original_resource_id: number;
  original_resource_name: string;
  original_capacity: number;
  optimized_resource_id: number;
  optimized_resource_name: string;
  optimized_capacity: number;
  was_moved: boolean;
  reason: string;
}

export interface OptimizationMetrics {
  total_events: number;
  displaced_events_count: number;
  active_rooms_before: number;
  active_rooms_after: number;
  rooms_freed_count: number;
  avg_utilization_before: number;
  avg_utilization_after: number;
  weekly_energy_kwh_before: number;
  weekly_energy_kwh_after: number;
  weekly_energy_savings_kwh: number;
  weekly_cost_savings_inr: number;
}

export interface OptimizationResponse {
  solver_status: string;
  feasibility: "FEASIBLE" | "NOT FEASIBLE";
  solve_duration_ms: number;
  objective_score: number;
  metrics: OptimizationMetrics;
  reallocations: ReallocatedEvent[];
  violations: string[];
  algorithmic_decisions: string[];
}

export interface ScenarioChangeCreate {
  change_type: string;
  target_resource_id?: number;
  parameters?: Record<string, any>;
}

export interface ScenarioCreate {
  name: string;
  description?: string;
  base_period?: string;
  changes?: ScenarioChangeCreate[];
}

export interface ScenarioChange {
  id: number;
  change_type: string;
  target_resource_id?: number;
  parameters: Record<string, any>;
  created_at: string;
}

export interface ScenarioResult {
  id: number;
  scenario_id: number;
  status: string;
  feasibility: "FEASIBLE" | "NOT FEASIBLE";
  objective_score: number;
  solve_duration_ms?: number;
  before_metrics: Record<string, any>;
  after_metrics: Record<string, any>;
  delta_metrics: {
    rooms_freed: number;
    rooms_before?: number;
    rooms_after?: number;
    utilization_delta_percent: number;
    utilization_before?: number;
    utilization_after?: number;
    weekly_energy_savings_kwh: number;
    weekly_cost_savings_inr?: number;
    displaced_events_count?: number;
    total_events?: number;
  };
  reallocations?: ReallocatedEvent[];
  violations?: string[];
  recommendations?: string[];
  created_at: string;
}

export interface Scenario {
  id: number;
  organization_id: number;
  name: string;
  description?: string;
  base_period: string;
  status: "draft" | "simulated" | "applied";
  created_by: number;
  created_at: string;
  changes: ScenarioChange[];
  results: ScenarioResult[];
}

export interface ScenarioTemplate {
  template_id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  default_changes: ScenarioChangeCreate[];
}

// Phase 10: Action Center & Audit Trail
export interface Recommendation {
  id: number;
  organization_id: number;
  resource_id?: number;
  resource?: {
    id: number;
    name: string;
    code: string;
    building_name?: string;
    capacity: number;
  };
  recommendation_type: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  title: string;
  problem_description: string;
  recommended_action: string;
  estimated_impact: {
    monthly_savings_inr?: number;
    weekly_energy_savings_kwh?: number;
    rooms_freed?: number;
    co2_reduction_kg?: number;
    confidence_score?: number;
    [key: string]: any;
  };
  evidence?: Record<string, any>;
  status: "Active" | "Applied" | "Dismissed";
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  user_id?: number;
  user_email?: string;
  action: string;
  entity_type: string;
  entity_id?: number;
  metadata?: Record<string, any>;
  metadata_json?: string;
  [key: string]: any;
  created_at: string;
}

export interface DataSource {
  id: number;
  name: string;
  provider: string;
  dataset_url: string;
  version: string;
  license: string;
  description?: string;
  downloaded_at?: string;
  last_synced_at?: string;
  file_name?: string;
  row_count: number;
  record_count?: number;
  schema_hash?: string;
  status: "Registered" | "Downloaded" | "Imported" | "Failed";
  coverage_start?: string;
  coverage_end?: string;
  created_at: string;
  updated_at: string;
}

export interface ProfilingReport {
  dataset_name: string;
  provider: string;
  profiled_at: string;
  total_rows: number;
  duplicate_records: number;
  date_coverage: {
    start: string;
    end: string;
    duration_days: number;
  };
  unique_buildings_count: number;
  primary_use_distribution: Record<string, number>;
  columns: Record<string, { dtype: string; null_count: number; null_percentage: number }>;
  meter_reading_stats: {
    mean: number;
    std: number;
    min: number;
    p25: number;
    median: number;
    p75: number;
    max: number;
  };
  outlier_analysis: {
    iqr_upper_bound: number;
    outlier_count: number;
    outlier_percentage: number;
  };
    weather_summary: {
    air_temperature_celsius?: {
      mean: number;
      min: number;
      max: number;
    };
  };
  energy_distribution?: any;
  [key: string]: any;
}

export interface IngestionResult {
  status: string;
  data_source_id: number;
  dataset_name: string;
  records_ingested: number;
  rows_ingested?: number;
  buildings_count: number;
  buildings_processed?: number;
  date_range: string;
  profiling_report: ProfilingReport;
}

export interface ConfusionMatrix {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export interface DetectorMetrics {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number;
  recall: number;
  f1_score: number;
  false_positive_rate: number;
  accuracy: number;
}

export interface DetectorBenchmarkResult {
  name: string;
  confusion_matrix: ConfusionMatrix;
  metrics: DetectorMetrics;
}

export interface TypologyBenchmarkStats {
  total_ground_truth: number;
  detected_by_isolation_forest: number;
  detected_by_hybrid: number;
  recall_rate: number;
  recall?: number;
}

export interface SensitivityPoint {
  contamination: number;
  precision: number;
  recall: number;
  f1_score: number;
  false_positive_rate: number;
}

export interface BenchmarkEvaluationReport {
  benchmark_name: string;
  evaluated_at: string;
  total_records: number;
  total_ground_truth_anomalies: number;
  ground_truth_prevalence: number;
  evaluation_parameters: {
    selected_contamination: number;
    algorithms_evaluated: string[];
  };
  detectors: {
    isolation_forest: DetectorBenchmarkResult;
    physical_rules: DetectorBenchmarkResult;
    nexus_hybrid: DetectorBenchmarkResult;
  };
  typology_breakdown: Record<string, TypologyBenchmarkStats>;
  sensitivity_analysis: SensitivityPoint[];
}

export interface DiurnalMacroPoint {
  hour: number;
  avg_grid_load_mw: number;
  avg_grid_index: number;
  avg_temperature_c: number;
  avg_cdd: number;
  peak_probability: number;
}

export interface MacroGridProfile {
  dataset_name: string;
  profiled_at: string;
  total_records: number;
  statistics: {
    mean_grid_load_mw: number;
    min_grid_load_mw: number;
    max_grid_load_mw: number;
    p85_grid_load_mw: number;
    mean_temperature_c: number;
    temperature_range_c: {
      min: number;
      max: number;
    };
    total_cdd: number;
    total_hdd: number;
  };
  correlations: {
    temperature_vs_grid_load: number;
    cdd_vs_grid_load: number;
    hvac_cooling_driver: string;
  };
  grid_peak_hours: number[];
  diurnal_profile: DiurnalMacroPoint[];
  noaa_station?: string;
  [key: string]: any;
}

export interface MultiSourceStreamInfo {
  source: string;
  record_count: number;
  status: string;
}

export interface MultiSourceDataAvailability {
  is_sufficient: boolean;
  data_sufficiency_status: "SUFFICIENT" | "INSUFFICIENT_DATA";
  missing_streams: string[];
  streams: Record<string, MultiSourceStreamInfo>;
}

export interface CrossSourceMatrixRow {
  key: string;
  label: string;
  values: number[];
}

export interface CrossSourceCorrelationMatrix {
  status: string;
  calculation_timestamp: string;
  sample_size: number;
  data_sources: string[];
  feature_labels: string[];
  feature_keys: string[];
  matrix: CrossSourceMatrixRow[];
  key_insights: string[];
}

export interface DiurnalMultiLayerPoint {
  hour: number;
  hour_label: string;
  scheduled_enrollment: number;
  campus_power_kwh: number;
  wifi_headcount: number;
  air_temperature_c: number;
  regional_grid_mw: number;
  grid_load_index: number;
  cooling_degree_days: number;
  is_grid_peak: boolean;
  composite_stress_index: number;
}

export interface TimetableStressCollision {
  collision_id: number;
  subject_name: string;
  department: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  current_room: {
    id: number;
    name: string;
    code: string;
    capacity: number;
    floor: number;
    building_name: string;
  };
  expected_occupancy: number;
  current_utilization_percent: number;
  cssi: number;
  stress_drivers: {
    grid_stress_index: number;
    thermal_stress_index: number;
    spatial_mismatch_index: number;
    is_peak_grid_hour: boolean;
  };
  recommended_action: string;
  candidate_room: {
    id: number;
    name: string;
    code: string;
    capacity: number;
    floor: number;
    building_id: number;
  } | null;
  estimated_savings: {
    energy_reduction_kwh: number;
    tariff_savings_inr: number;
  };
}

export interface MultiSourceIntelligenceResponse {
  data_availability: MultiSourceDataAvailability;
  cross_source_correlation: CrossSourceCorrelationMatrix | null;
  diurnal_multi_layer_profile: DiurnalMultiLayerPoint[];
  timetable_stress_collisions: TimetableStressCollision[];
  metadata: {
    calculation_timestamp: string;
    algorithm: string;
    weights: {
      grid_stress: number;
      thermal_stress: number;
      spatial_mismatch: number;
    };
    data_sources: string[];
  };
}

export interface Workspace {
  id: number;
  organization_id: number;
  name: string;
  code: string;
  workspace_type: string; // factory, hospital, warehouse, office, education, custom
  description?: string;
  location: string;
  timezone: string;
  is_active: boolean;
  is_demo: boolean;
  settings_json?: string;
  created_at: string;
  updated_at: string;
  resource_count?: number;
  active_issue_count?: number;
  goal_count?: number;
}

export interface WorkspaceTemplate {
  template_id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  suggested_resource_types: string[];
  suggested_metrics: string[];
  suggested_capabilities: string[];
  default_goals: string[];
}

export interface Goal {
  id: number;
  organization_id: number;
  workspace_id?: number;
  title: string;
  goal_type: string;
  target_value: number;
  unit: string;
  baseline_value?: number;
  current_value?: number;
  timeframe: string;
  status: string;
  priority: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface SearchResultItem {
  resources: Array<{ id: number; name: string; code: string; type: string; location: string }>;
  anomalies: Array<{ id: number; reason: string; severity: string; metric: string; status: string }>;
  scenarios: Array<{ id: number; name: string; status: string; base_period?: string }>;
  actions: Array<{ id: number; title: string; status: string; action_type: string }>;
  goals: Array<{ id: number; title: string; target_value: number; unit: string; status: string }>;
}


