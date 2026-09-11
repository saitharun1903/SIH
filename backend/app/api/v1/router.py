from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.organizations import router as org_router
from app.api.v1.buildings import router as buildings_router
from app.api.v1.resource_types import router as resource_types_router
from app.api.v1.resources import router as resources_router
from app.api.v1.schedules import router as schedules_router
from app.api.v1.imports import router as imports_router
from app.api.v1.data_quality import router as data_quality_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.anomalies import router as anomalies_router
from app.api.v1.predictions import router as predictions_router
from app.api.v1.optimization import router as optimization_router
from app.api.v1.scenarios import router as scenarios_router
from app.api.v1.actions import router as actions_router
from app.api.v1.assistant import router as assistant_router
from app.api.v1.reports import router as reports_router
from app.api.v1.data_sources import router as data_sources_router
from app.api.v1.seed import router as seed_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["System Health"])
api_router.include_router(auth_router, tags=["Authentication"])
api_router.include_router(org_router, tags=["Organizations"])
api_router.include_router(buildings_router, tags=["Buildings"])
api_router.include_router(resource_types_router, tags=["Resource Types"])
api_router.include_router(resources_router, tags=["Resources"])
api_router.include_router(schedules_router, tags=["Schedules"])
api_router.include_router(data_sources_router, tags=["Data Source Registry"])
api_router.include_router(imports_router, tags=["Data Ingestion"])
api_router.include_router(data_quality_router, tags=["Data Quality"])
api_router.include_router(analytics_router, tags=["Analytics Engine"])
api_router.include_router(anomalies_router, tags=["Anomaly Detection"])
api_router.include_router(predictions_router, tags=["Demand Forecasting"])
api_router.include_router(optimization_router, tags=["Optimization Engine"])
api_router.include_router(scenarios_router, tags=["What-If Simulator"])
api_router.include_router(actions_router, tags=["Action Center"])
api_router.include_router(assistant_router, tags=["AI Assistant"])
api_router.include_router(reports_router, tags=["Institutional Reports"])
api_router.include_router(seed_router, tags=["Development Seed"])
