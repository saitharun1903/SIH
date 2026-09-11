# NEXUS
### AI-Powered Resource Intelligence, Optimization & Decision Automation Platform
**Smart India Hackathon 2026 — Problem Statement SIH26202**

---

## 1. Project Overview
NEXUS is an enterprise-grade resource intelligence and decision-automation platform built for educational institutions and multi-resource organizations. It answers four core operational questions:
1. **What is happening?** (Real-time occupancy, schedule execution, energy metrics)
2. **What is going wrong?** (Underutilized spaces, overloaded rooms, anomalies, bottlenecks)
3. **What is likely to happen next?** (Predictive demand and consumption forecasting)
4. **What should we do about it?** (Constraint-satisfied OR-Tools optimization and actionable recommendations)

---

## 2. Problem Statement Mapping (SIH26202)
- **Category**: Software
- **Theme**: Smart Automation
- **Focus**: Intelligent resource utilization using AI to explore multi-source institutional data and automate high-value operational decisions.

---

## 3. Technology Stack
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide Icons, Recharts
- **Backend**: Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic
- **Database**: PostgreSQL 16 (with zero-friction local SQLite fallback)
- **Data & ML**: pandas, NumPy, scikit-learn (Isolation Forest for Anomaly Detection), Google OR-Tools (Constraint Programming & Optimization)
- **Authentication**: JWT (JSON Web Tokens), bcrypt password hashing, Role-Based Access Control (`Administrator`, `Analyst`, `Viewer`)

---

## 4. Architecture

```
/frontend          Next.js application & responsive enterprise UI
/backend           FastAPI REST API, authentication, database models, services
/ml                ML feature engineering, anomaly detection, forecasting
/database          Schema migrations, seed generators
/docs              System architecture, optimization, and API documentation
docker-compose.yml Production multi-container orchestration
README.md          Project guide and documentation
.env.example       Environment variable template
```

---

## 5. Local Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+ (tested with v24)
- npm or pnpm

### Quick Start (Native Local Run)

#### 1. Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python -m app.db.init_db
uvicorn app.main:app --reload --port 8000
```
Backend API and OpenAPI docs will be available at: `http://localhost:8000/docs`

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Access the application at: `http://localhost:3000`

### Docker Compose
```bash
docker-compose up --build
```

---

## 6. Default Demo Credentials
- **Administrator**: `admin@nexus.edu` / `Admin@123`
- **Analyst**: `analyst@nexus.edu` / `Analyst@123`
- **Viewer**: `viewer@nexus.edu` / `Viewer@123`

---

## 7. Development Phases
- [x] **PHASE 1 — FOUNDATION**: Monorepo structure, database models, FastAPI backend, JWT auth & RBAC, Next.js layout & login, Docker Compose.
- [ ] **PHASE 2 — RESOURCE MANAGEMENT**: Buildings, Resource Types, Resources, Schedules CRUD & realistic seed data.
- [ ] **PHASE 3 — DATA INGESTION**: CSV/XLSX schema detection, column mapping UI, validation, and error reporting.
- [ ] **PHASE 4 — ANALYTICS ENGINE**: Aggregated utilization, energy efficiency, threshold classification.
- [ ] **PHASE 5 — ANOMALY DETECTION**: Isolation Forest model, severity rating, factor breakdown.
- [ ] **PHASE 6 — PREDICTION SYSTEM**: Demand forecasting with confidence intervals and data sufficiency guards.
- [ ] **PHASE 7 — OPTIMIZATION ENGINE**: OR-Tools constraint satisfaction for room allocation.
- [ ] **PHASE 8 — WHAT-IF SIMULATOR**: In-memory scenario engine, deactivation tests, before/after metrics.
- [ ] **PHASE 9 — SCENARIO COMPARISON**: Multi-scenario comparison matrix.
- [ ] **PHASE 10 — ACTION CENTER**: Prioritized recommendations with traceable evidence.
- [ ] **PHASE 11 — AI ASSISTANT**: Structured-context AI explainer with deterministic fallback.
- [ ] **PHASE 12 — REPORTS**: Executive summaries and exportable audits.
- [ ] **PHASE 13 — POLISH**: Accessible, responsive enterprise UX.
- [ ] **PHASE 14 — HARDENING**: Automated tests and verification.
