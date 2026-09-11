# NEXUS API Contract Documentation

## Overview
This document defines the strict, data-driven API contracts between the **FastAPI backend** (`http://127.0.0.1:8000/api/v1`) and the **Next.js frontend** (`http://localhost:3000`). All collection endpoints return real, verified database records from `nexus.db`.

---

## Standard Pagination Schema
All list endpoints (`/buildings`, `/resources`, `/schedules`, `/imports/jobs`) adhere to the standard `PaginatedResponse[T]` contract.

```json
{
  "items": [ ... ],
  "total": 55,
  "page": 1,
  "page_size": 20,
  "total_pages": 3
}
```

### TypeScript Definition
```typescript
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
```

Frontend consumption pattern:
- Full pagination: `const res = await api.getBuildings({ page: 1, page_size: 20 });`
- Safe list extraction: `const buildings = await api.getBuildingsList();` (always returns `Building[]`)

---

## Core Endpoints

### 1. Buildings (`/buildings`)
- **GET `/buildings`**: Retrieves paginated list of physical facilities.
  - Query Params: `search?: string`, `page?: number`, `page_size?: number`
  - Response: `PaginatedResponse<Building>`

```typescript
export interface Building {
  id: number;
  organization_id: number;
  name: string;
  code: string;
  location?: string;
  floor_count: number;
  resource_count?: number;
  created_at: string;
  updated_at: string;
}
```

---

### 2. Resources / Spaces (`/resources`)
- **GET `/resources`**: Retrieves paginated institutional spaces (classrooms, labs, auditoriums).
  - Query Params: `building_id?: number`, `resource_type_id?: number`, `status?: string`, `search?: string`, `page?: number`, `page_size?: number`
  - Response: `PaginatedResponse<Resource>`

```typescript
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
  building_name?: string;
  building_code?: string;
  resource_type_name?: string;
  created_at: string;
  updated_at: string;
}
```

---

### 3. Schedules & Timetable (`/schedules`)
- **GET `/schedules`**: Retrieves academic session timetable allocations.
  - Query Params: `day_of_week?: string`, `resource_id?: number`, `department?: string`, `page?: number`, `page_size?: number`
  - Response: `PaginatedResponse<Schedule>`

```typescript
export interface Schedule {
  id: number;
  organization_id: number;
  resource_id: number;
  subject_name: string;
  department: string;
  day_of_week: string;
  start_time: string; // "09:00"
  end_time: string;   // "10:00"
  expected_occupancy: number;
  actual_occupancy?: number;
  resource_name?: string;
  resource_code?: string;
  building_name?: string;
  created_at: string;
  updated_at: string;
}
```

---

### 4. Telemetry & Analytics (`/analytics`)

#### GET `/analytics/summary`
- Query Params: `building_id?: number`, `resource_id?: number`, `start_date?: string`, `end_date?: string`
- Response: `AnalyticsSummary`

```typescript
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
  date_range_start: string;
  date_range_end: string;
}
```

#### GET `/analytics/utilization-trends`
- Query Params: `building_id?: number`, `resource_id?: number`
- Response: `UtilizationTrendPoint[]`

```typescript
export interface UtilizationTrendPoint {
  timestamp: string;      // ISO 8601
  avg_utilization: number; // 0 - 100 percentage
  peak_utilization: number;
  avg_occupancy: number;
  total_capacity: number;
}
```

#### GET `/analytics/energy-trends`
- Query Params: `building_id?: number`, `resource_id?: number`
- Response: `EnergyTrendPoint[]`

```typescript
export interface EnergyTrendPoint {
  timestamp: string;             // ISO 8601
  consumption_kwh: number;       // Micro-metered power draw
  cost: number;                  // Commercial tariff in INR (@ ₹8.50/kWh)
  occupied_spaces_count: number;
}
```

---

### 5. Anomaly Telemetry (`/anomalies`)
- **GET `/anomalies`**: Paginated anomaly telemetry.
  - Query Params: `status?: string`, `severity?: string`, `metric_type?: string`, `building_id?: number`, `limit?: number`, `offset?: number`
  - Response: `{ items: Anomaly[], total: number, limit: number, offset: number }`

```typescript
export interface Anomaly {
  id: number;
  organization_id: number;
  resource_id: number;
  resource_name?: string;
  resource_code?: string;
  building_name?: string;
  metric_type: "energy" | "utilization" | "occupancy";
  anomaly_type: string;
  timestamp: string;
  expected_value: number;
  actual_value: number;
  deviation_percent: number;
  severity: "Critical" | "High" | "Medium" | "Low";
  reason: string;
  contributing_factors?: Array<{ factor: string; impact: string; detail: string }>;
  status: "Active" | "Acknowledged" | "Resolved" | "Dismissed";
  created_at: string;
}
```

---

### 6. Action Center & Recommendations (`/actions`)
- **GET `/actions/recommendations`**: Verifiable ROI recommendations generated by the optimization engine.
  - Query Params: `status?: string`, `priority?: string`
  - Response: `Recommendation[]`

```typescript
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
  };
  evidence?: Record<string, any>;
  status: "Active" | "Applied" | "Dismissed";
  created_at: string;
}
```
