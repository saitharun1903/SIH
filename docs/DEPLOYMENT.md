# NEXUS — Production Deployment Guide

## 1. System Architecture

```
                      GitHub (saitharun1903/SIH:main)
                                    |
                    +---------------+---------------+
                    |                               |
                    v                               v
            Vercel (Frontend)              Render (Backend Web Service)
            Next.js 14 App Router          FastAPI + Uvicorn
            https://lunor.co.in            https://api.lunor.co.in
            https://www.lunor.co.in                         |
                    |                                       |
                    +---------------+-----------------------+
                                    |
                                    v
                        Managed PostgreSQL Database
                                (Render Postgres)
```

---

## 2. Vercel Setup (Frontend: lunor.co.in)

1. Log into your [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** > **Project**.
3. Import the GitHub repository: `saitharun1903/SIH`.
4. Configure the project:
   - **Framework Preset**: Next.js
   - **Root Directory**: Click "Edit" and select `frontend`
   - **Build Command**: `npm run build` (or leave default)
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`
5. Set Environment Variables:
   | Variable | Value | Notes |
   |---|---|---|
   | `NEXT_PUBLIC_API_URL` | `https://api.lunor.co.in` | Root domain for production backend API |
6. Click **Deploy**. Vercel will build and deploy the Next.js frontend.

---

## 3. Render Setup (Backend: api.lunor.co.in)

You can deploy using either the **Render Blueprint** (`render.yaml`) or manual configuration.

### Option A: Declarative Blueprint (Recommended)
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Blueprint**.
3. Select `saitharun1903/SIH`.
4. Render detects `render.yaml` and will automatically create:
   - `nexus-db`: Managed PostgreSQL database
   - `nexus-backend`: Python Web Service with all environment variables pre-configured

### Option B: Manual Web Service Setup
If creating services manually:
1. Create a **PostgreSQL Database** in Render:
   - Name: `nexus-db`
   - Database: `nexus`
   - User: `nexus_user`
   - Copy the **Internal Database URL** (for Render-to-Render) or **External Database URL**.
2. Create a **Web Service**:
   - Name: `nexus-backend`
   - Root Directory: `backend`
   - Runtime: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

---

## 4. PostgreSQL Database Setup & Migrations

### Initial Provisioning
When the FastAPI backend boots up, its application lifecycle automatically provisions all 19 relational tables using SQLAlchemy (`Base.metadata.create_all`):
- `organizations`
- `users` (seeds default initial accounts: `admin@nexus.edu`, `analyst@nexus.edu`, `viewer@nexus.edu`)
- `buildings`
- `resource_types`
- `resources`
- `schedules`
- `occupancy_records`
- `resource_usage`
- `energy_usage`
- `datasets`
- `data_sources`
- `import_jobs`
- `predictions`
- `anomalies`
- `scenarios`
- `scenario_changes`
- `scenario_results`
- `recommendations`
- `audit_logs`

### Explicit Manual Migration / Seed Command
To manually run the table initialization from the Render shell:
```bash
python -m app.db.init_db
```

### Demonstration Seeding (Optional)
Production boots clean with real empty states. If you choose to seed demonstration data into production at any point, an Administrator can trigger:
```bash
curl -X POST https://api.lunor.co.in/api/v1/seed/demo \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```

---

## 5. Environment Variables Reference

### Backend (Render Web Service)
| Variable | Production Value / Description | Sensitive |
|---|---|---|
| `DATABASE_URL` | `postgresql://nexus_user:<PASSWORD>@<HOST>/nexus` | YES |
| `JWT_SECRET` | 32+ character random secret string | YES |
| `JWT_ALGORITHM` | `HS256` | NO |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` (24 hours) | NO |
| `APP_NAME` | `NEXUS` | NO |
| `APP_ENV` | `production` | NO |
| `DEBUG` | `False` | NO |
| `CORS_ORIGINS` | `https://lunor.co.in,https://www.lunor.co.in` | NO |
| `PYTHON_VERSION` | `3.11.9` | NO |
| `OPENAI_API_KEY` | *(Optional)* OpenAI API Key for natural language assistant | YES |

### Frontend (Vercel Project)
| Variable | Production Value | Sensitive |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.lunor.co.in` | NO (Public) |

---

## 6. Domain Setup & GoDaddy DNS Records

Your domain `lunor.co.in` is registered with GoDaddy. Configure the following DNS records in GoDaddy DNS Management.

> [!WARNING]
> **Preserve Existing Records**: Do NOT delete or modify MX, SPF, DKIM, or DMARC email records. Only create or update website and API records.

### Complete GoDaddy DNS Table

| Type | Name / Host | Value / Target | TTL | Destination Service |
|---|---|---|---|---|
| **A** | `@` | `76.76.21.21` | 1 Hour (3600s) | Vercel (Apex domain: `lunor.co.in`) |
| **CNAME** | `www` | `cname.vercel-dns.com` | 1 Hour (3600s) | Vercel (Subdomain: `www.lunor.co.in`) |
| **CNAME** | `api` | `<your-backend>.onrender.com` | 1 Hour (3600s) | Render (Backend API: `api.lunor.co.in`) |

### Adding Custom Domains in Dashboards

1. **In Render (`api.lunor.co.in`)**:
   - Open your `nexus-backend` service > **Settings** > **Custom Domains**.
   - Click **Add Custom Domain** > enter `api.lunor.co.in`.
   - Render will display the verification target (`<service-slug>.onrender.com`).
   - Enter that exact target into GoDaddy as the `api` CNAME value.

2. **In Vercel (`lunor.co.in` & `www.lunor.co.in`)**:
   - Open your Vercel project > **Settings** > **Domains**.
   - Add `lunor.co.in`.
   - Add `www.lunor.co.in` (select "Redirect to lunor.co.in").
   - Vercel will verify the A and CNAME records and issue SSL certificates automatically.

---

## 7. HTTPS & SSL Verification

Both Vercel and Render automatically provision and renew Let's Encrypt SSL/TLS certificates once DNS records propagate:
- `https://lunor.co.in` -> Valid Let's Encrypt TLS
- `https://www.lunor.co.in` -> Valid Let's Encrypt TLS (redirects to apex)
- `https://api.lunor.co.in` -> Valid Let's Encrypt TLS

Test HTTPS verification:
```bash
curl -I https://lunor.co.in
curl -I https://api.lunor.co.in/health
```

---

## 8. Troubleshooting & Common Issues

### 1. `CORS Missing Allow Origin`
- Symptom: Browser console displays `Access to fetch at 'https://api.lunor.co.in' from origin 'https://lunor.co.in' has been blocked by CORS policy`.
- Fix: Ensure `CORS_ORIGINS` on Render includes `https://lunor.co.in,https://www.lunor.co.in` with no trailing slashes.

### 2. `SQLAlchemy NoSuchModuleError: postgres`
- Symptom: Crash on boot with `Can't load plugin: sqlalchemy.dialects:postgres`.
- Fix: NEXUS automatically replaces `postgres://` with `postgresql://` in `backend/app/db/session.py`. If modifying manually, ensure the scheme is `postgresql://`.

### 3. `TypeError: buildings.map is not a function`
- Symptom: 500 boundary on dashboard.
- Fix: Solved in codebase. `api.getBuildingsList()` always returns an array `Building[]` even from paginated responses, and all mappings are protected with `Array.isArray` guards.

---

## 9. Rollback Procedures

### Vercel Frontend Rollback
1. Open Vercel Project > **Deployments**.
2. Locate the previous working deployment.
3. Click the three dots (`...`) > **Promote to Production**.
4. Rollback takes effect instantaneously worldwide without rebuild time.

### Render Backend Rollback
1. Open Render Dashboard > `nexus-backend` > **Events / Deploys**.
2. Click on the previous successful deploy.
3. Click **Rollback to this deploy**.

### Database Safety
- Database schema changes are non-destructive (`Base.metadata.create_all` only adds missing tables and never drops existing data).
