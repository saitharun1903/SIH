# NEXUS Database Schema Reference

The database models are fully normalized in PostgreSQL with foreign keys, indexes, timestamps, and cascading rules.

## Core Entities
1. **organizations**: Multi-tenant institutional container (name, type, location, timezone).
2. **users**: RBAC accounts (`Administrator`, `Analyst`, `Viewer`), bcrypt password hash, status.
3. **buildings**: Campus buildings with code, floor count, location.
4. **resource_types**: Taxonomy of resources (Classrooms, Laboratories, Seminar Halls, Equipment).
5. **resources**: Physical spaces and equipment with capacity, floor, area, and operational status.
6. **schedules**: Timetable records with subject, department, day of week, start/end time, expected occupancy, and equipment requirements.
7. **resource_usage**: Utilization records linked to timestamp and utilization percentage.
8. **energy_usage**: Electricity consumption (kWh) and associated cost records.
9. **occupancy_records**: Sensor or attendance-logged actual headcount.
10. **constraints**: Operational rules (capacity limits, quiet hours, equipment prerequisites).
11. **datasets**: Tracked file uploads (CSV, XLSX) with schema versions.
12. **import_jobs**: Ingestion execution tracking rows processed, imported, and rejected.
13. **predictions**: Forecasted demand, occupancy, and energy values with confidence bounds.
14. **anomalies**: Isolation Forest flags with deviation percentage and severity (`Low`, `Medium`, `High`, `Critical`).
15. **scenarios**: What-if experiment definitions.
16. **scenario_changes**: Atomic parameter mutations (e.g. room deactivation).
17. **scenario_results**: Solver outputs (before vs after metrics, feasibility, objective score).
18. **recommendations**: Prioritized system actions with auditable evidence.
19. **audit_logs**: Immutable audit trail of administrative modifications.
