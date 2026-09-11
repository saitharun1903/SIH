import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from app.models import (
    Workspace,
    Goal,
    MetricDefinition,
    ResourceType,
    Resource,
    Anomaly,
    Scenario,
    Action,
    Building,
    Organization,
)
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate, WorkspaceTemplate
from app.schemas.goal import GoalCreate, GoalUpdate
from app.core.logging import logger


DOMAIN_TEMPLATES: List[Dict[str, Any]] = [
    {
        "template_id": "space_facilities",
        "name": "Space & Facilities",
        "category": "Facilities Management",
        "description": "Optimize physical room, hall, and building capacity, occupancy rates, and space availability.",
        "icon": "Building2",
        "suggested_resource_types": ["Room", "Conference Room", "Auditorium", "Building", "Floor Zone"],
        "suggested_metrics": ["Occupancy (%)", "Spatial Utilization (%)", "Availability (hrs)", "Density (headcount)"],
        "suggested_capabilities": ["Spatial Scheduling", "Capacity Optimization", "Occupancy Sensing", "Underutilization Alerts"],
        "default_goals": [
            "Maintain average space utilization between 60% and 85%",
            "Eliminate overlapping room reservation conflicts",
            "Curtail off-hours unoccupied heating/cooling consumption",
        ],
    },
    {
        "template_id": "equipment_assets",
        "name": "Equipment & Assets",
        "category": "Asset Operations",
        "description": "Monitor machine utilization, power ratings, operational downtime, and scheduled maintenance windows.",
        "icon": "Cpu",
        "suggested_resource_types": ["CNC Machine", "Production Line", "Industrial Generator", "Diagnostic Scanner", "Server Rack"],
        "suggested_metrics": ["Operating Hours", "Downtime (hrs)", "Throughput (units)", "Power Load (kW)"],
        "suggested_capabilities": ["Equipment Scheduling", "Downtime Anomaly Detection", "Maintenance Tracking", "Bottleneck Prediction"],
        "default_goals": [
            "Reduce unplanned machine downtime by 20%",
            "Ensure critical equipment availability exceeds 95%",
            "Balance workload evenly across production lines",
        ],
    },
    {
        "template_id": "energy_utilities",
        "name": "Energy & Utilities",
        "category": "Sustainability & Cost",
        "description": "Track electrical, thermal, and sub-metered power loads to detect leaks and optimize operational tariffs.",
        "icon": "Zap",
        "suggested_resource_types": ["Power Substation", "HVAC Chiller", "Solar Array", "Smart Meter", "Pumping Unit"],
        "suggested_metrics": ["Consumption (kWh)", "Peak Demand (kW)", "Power Cost (INR)", "Carbon Intensity (kg CO2)"],
        "suggested_capabilities": ["Tariff Optimization", "Phantom Energy Detection", "Peak Shaving Simulation", "Forecasted Load"],
        "default_goals": [
            "Reduce monthly energy expenditures by 15%",
            "Eliminate phantom baseline power consumption during non-operational hours",
            "Flatten peak demand surges through load shifting",
        ],
    },
    {
        "template_id": "workforce_capacity",
        "name": "Workforce & Capacity",
        "category": "Human Operations",
        "description": "Balance shifts, staff allocations, and operational headcount against forecasted demand.",
        "icon": "Users",
        "suggested_resource_types": ["Shift Crew", "Technical Specialist", "Medical Staff Team", "Support Station", "Delivery Agent"],
        "suggested_metrics": ["Shift Allocation (%)", "Headcount Capacity", "Active Hours", "Coverage Ratio"],
        "suggested_capabilities": ["Shift Scheduling", "Capacity Shortage Prediction", "Workload Reallocation", "Overtime Prevention"],
        "default_goals": [
            "Prevent staff burnout by capping overtime shifts",
            "Maintain 100% coverage during peak operating intervals",
            "Align workforce scheduling with real demand forecasts",
        ],
    },
    {
        "template_id": "inventory_operations",
        "name": "Inventory & Logistics",
        "category": "Supply Chain",
        "description": "Manage warehouse zones, loading docks, forklifts, delivery fleets, and inventory throughput.",
        "icon": "Package",
        "suggested_resource_types": ["Storage Bay", "Cold Storage Zone", "Forklift", "Loading Dock", "Delivery Fleet Van"],
        "suggested_metrics": ["Storage Fill Rate (%)", "Dock Turnaround (min)", "Payload Capacity", "Vehicle Fuel/Battery (%)"],
        "suggested_capabilities": ["Dock Allocation", "Fleet Routing Simulation", "Surge Capacity Planning", "Storage Reallocation"],
        "default_goals": [
            "Achieve 85% pallet storage density without aisle congestion",
            "Minimize loading dock idling time to under 15 minutes",
            "Improve delivery vehicle payload utilization",
        ],
    },
    {
        "template_id": "education_campus",
        "name": "Education & Academic Campus",
        "category": "Higher Education",
        "description": "Manage classrooms, science laboratories, seminar halls, lecture timetables, and student attendance.",
        "icon": "GraduationCap",
        "suggested_resource_types": ["Lecture Hall", "Computer Lab", "Seminar Hall", "Workshop Space", "Classroom"],
        "suggested_metrics": ["Seat Occupancy (%)", "Timetable Utilization (%)", "Active Energy (kWh)", "Room Conflicts"],
        "suggested_capabilities": ["Timetable Optimization", "Room Capacity Verification", "Remote Day Simulation", "Audit Logging"],
        "default_goals": [
            "Eliminate room overcapacity where students exceed seating",
            "Maintain 70%+ academic facility utilization during instruction hours",
            "Consolidate off-peak laboratory sections to save power",
        ],
    },
    {
        "template_id": "custom",
        "name": "Custom Organization",
        "category": "Flexible Model",
        "description": "Define custom resources, metrics, thresholds, and operational constraints for any domain.",
        "icon": "Layers",
        "suggested_resource_types": ["General Resource", "Primary Unit", "Secondary Unit"],
        "suggested_metrics": ["Utilization (%)", "Operational Value", "Cost"],
        "suggested_capabilities": ["Generic What-If Simulation", "Threshold Anomaly Alerts", "Resource Inventory", "Exportable Reports"],
        "default_goals": [
            "Improve resource utilization and visibility",
            "Eliminate operational bottlenecks",
        ],
    },
]


def get_available_templates() -> List[Dict[str, Any]]:
    """Returns all supported domain configuration templates."""
    return DOMAIN_TEMPLATES


def list_workspaces(db: Session, org_id: int) -> List[Workspace]:
    """Lists all workspaces under the organization."""
    return db.query(Workspace).filter(Workspace.organization_id == org_id).order_by(Workspace.created_at.asc()).all()


def get_workspace(db: Session, workspace_id: int, org_id: int) -> Optional[Workspace]:
    """Gets single workspace by ID."""
    return db.query(Workspace).filter(Workspace.id == workspace_id, Workspace.organization_id == org_id).first()


def ensure_default_workspace(db: Session, org_id: int) -> Workspace:
    """Ensures at least one active workspace exists for the organization."""
    ws = db.query(Workspace).filter(Workspace.organization_id == org_id, Workspace.is_active == True).first()
    if ws:
        return ws

    org = db.query(Organization).filter(Organization.id == org_id).first()
    org_name = org.name if org else "Primary Organization"
    ws_type = "education" if org and "institution" in (org.organization_type or "").lower() else "custom"

    ws = Workspace(
        organization_id=org_id,
        name=f"{org_name} - Primary Workspace",
        code="PRM-01",
        workspace_type=ws_type,
        description="Default operational workspace.",
        location=org.location if org else "Main Campus",
        timezone=org.timezone if org else "Asia/Kolkata",
        is_active=True,
        is_demo=False,
        settings_json=json.dumps({
            "templates": ["education_campus" if ws_type == "education" else "custom"],
            "capabilities": ["monitoring", "simulation", "optimization", "anomaly_detection", "reporting"],
            "terminology": {
                "resource": "Room" if ws_type == "education" else "Resource",
                "resource_plural": "Rooms" if ws_type == "education" else "Resources",
                "unit": "seats" if ws_type == "education" else "units",
            },
        }),
    )
    db.add(ws)
    db.commit()
    db.refresh(ws)

    # Attach existing orphaned resources to this workspace
    db.query(Resource).filter(Resource.organization_id == org_id, Resource.workspace_id == None).update(
        {"workspace_id": ws.id}, synchronize_session=False
    )
    db.commit()

    # Add default baseline goals
    create_default_goals_for_workspace(db, org_id, ws.id, ws_type)

    # Provision multi-domain demo workspaces (Factory, Hospital, Warehouse)
    try:
        seed_multidomain_workspaces(db, org_id)
    except Exception as e:
        logger.warning(f"Failed to seed demo workspaces: {e}")

    return ws



def create_default_goals_for_workspace(db: Session, org_id: int, workspace_id: int, ws_type: str):
    """Initializes standard baseline organizational goals."""
    existing = db.query(Goal).filter(Goal.organization_id == org_id, Goal.workspace_id == workspace_id).count()
    if existing > 0:
        return

    goals = [
        Goal(
            organization_id=org_id,
            workspace_id=workspace_id,
            title="Maintain Operational Utilization Between 65% - 85%",
            goal_type="improve_utilization",
            target_value=75.0,
            unit="%",
            baseline_value=54.0,
            current_value=68.5,
            timeframe="Q4 2026",
            status="In Progress",
            priority="High",
            description="Balance workload across available resources to avoid idle capacity or overloading.",
        ),
        Goal(
            organization_id=org_id,
            workspace_id=workspace_id,
            title="Curtail Off-Hours Energy & Power Draw",
            goal_type="reduce_cost",
            target_value=15.0,
            unit="%",
            baseline_value=0.0,
            current_value=8.2,
            timeframe="Q4 2026",
            status="In Progress",
            priority="High",
            description="Identify phantom energy leaks and unassigned running equipment to save operational budget.",
        ),
        Goal(
            organization_id=org_id,
            workspace_id=workspace_id,
            title="Zero Resource Allocation & Capacity Violations",
            goal_type="increase_capacity",
            target_value=0.0,
            unit="violations",
            baseline_value=5.0,
            current_value=0.0,
            timeframe="Immediate",
            status="Achieved",
            priority="Critical",
            description="Strict hard constraint enforcing that assigned demand never exceeds available resource capacity.",
        ),
    ]
    db.add_all(goals)
    db.commit()


def create_workspace(db: Session, org_id: int, workspace_in: WorkspaceCreate) -> Workspace:
    """Creates a new workspace with template-defined resource types, metric definitions, and goals."""
    settings_dict = {
        "templates": workspace_in.template_types or [workspace_in.workspace_type],
        "capabilities": ["monitoring", "simulation", "optimization", "anomaly_detection", "reporting"],
        "terminology": get_terminology_for_type(workspace_in.workspace_type),
    }

    ws = Workspace(
        organization_id=org_id,
        name=workspace_in.name,
        code=workspace_in.code.upper().strip(),
        workspace_type=workspace_in.workspace_type,
        description=workspace_in.description,
        location=workspace_in.location,
        timezone=workspace_in.timezone,
        is_active=workspace_in.is_active,
        is_demo=workspace_in.is_demo,
        settings_json=json.dumps(settings_dict),
    )
    db.add(ws)
    db.commit()
    db.refresh(ws)

    # Initialize Resource Types based on template
    init_resource_types_for_workspace(db, org_id, ws.id, workspace_in.workspace_type)

    # Create selected or default goals
    if workspace_in.primary_goals:
        for g_title in workspace_in.primary_goals:
            goal = Goal(
                organization_id=org_id,
                workspace_id=ws.id,
                title=g_title,
                goal_type="custom",
                target_value=80.0,
                unit="%",
                current_value=None,
                timeframe="Q4 2026",
                status="In Progress",
                priority="High",
            )
            db.add(goal)
        db.commit()
    else:
        create_default_goals_for_workspace(db, org_id, ws.id, workspace_in.workspace_type)

    return ws


def get_terminology_for_type(ws_type: str) -> Dict[str, str]:
    """Maps workspace type to natural domain terminology."""
    mapping = {
        "factory": {"resource": "Machine", "resource_plural": "Machines", "group": "Production Line", "unit": "units", "operator": "Operator"},
        "hospital": {"resource": "Facility Unit", "resource_plural": "Rooms & Beds", "group": "Department / Ward", "unit": "beds", "operator": "Staff"},
        "warehouse": {"resource": "Storage Bay", "resource_plural": "Bays & Docks", "group": "Warehouse Zone", "unit": "pallets", "operator": "Worker"},
        "office": {"resource": "Workspace", "resource_plural": "Workspaces & Rooms", "group": "Floor / Area", "unit": "desks", "operator": "Employee"},
        "education": {"resource": "Classroom / Lab", "resource_plural": "Rooms & Labs", "group": "Complex / Wing", "unit": "seats", "operator": "Faculty"},
    }
    return mapping.get(ws_type.lower(), {"resource": "Resource", "resource_plural": "Resources", "group": "Zone / Group", "unit": "units", "operator": "Staff"})


def init_resource_types_for_workspace(db: Session, org_id: int, workspace_id: int, ws_type: str):
    """Provisions suggested resource types based on chosen domain template."""
    types_map = {
        "factory": [
            ("CNC Machine", "Equipment", "units", [{"name": "power_rating_kw", "label": "Power Rating (kW)", "type": "number"}, {"name": "model", "label": "Model", "type": "text"}]),
            ("Assembly Station", "Production Line", "workstations", [{"name": "line_speed", "label": "Line Speed", "type": "number"}]),
            ("Heavy Press", "Equipment", "units", [{"name": "tonnage", "label": "Tonnage Rating", "type": "number"}]),
            ("Industrial Boiler", "Utility", "kW", [{"name": "max_pressure_bar", "label": "Max Pressure", "type": "number"}]),
        ],
        "hospital": [
            ("Operating Theatre", "Surgical", "tables", [{"name": "sterility_grade", "label": "Sterility Grade", "type": "text"}]),
            ("ICU Bed Unit", "Inpatient", "beds", [{"name": "ventilator_equipped", "label": "Ventilator Equipped", "type": "boolean"}]),
            ("MRI Scanner", "Diagnostics", "scans/hr", [{"name": "tesla_rating", "label": "Tesla Rating", "type": "number"}]),
            ("General Ward Room", "Inpatient", "beds", [{"name": "ac_equipped", "label": "Climate Controlled", "type": "boolean"}]),
        ],
        "warehouse": [
            ("High-Bay Storage", "Storage Area", "pallets", [{"name": "max_height_meters", "label": "Max Height (m)", "type": "number"}]),
            ("Cold Storage Chamber", "Refrigerated", "sq_meters", [{"name": "temp_range_celsius", "label": "Temperature (°C)", "type": "text"}]),
            ("Loading Bay Dock", "Logistics", "trucks", [{"name": "dock_type", "label": "Dock Type", "type": "text"}]),
            ("Electric Forklift", "Fleet", "units", [{"name": "battery_capacity_kwh", "label": "Battery Capacity", "type": "number"}]),
        ],
        "office": [
            ("Conference Room", "Meeting Space", "seats", [{"name": "av_display", "label": "Video Conference AV", "type": "boolean"}]),
            ("Hot-Desk Zone", "Workstation", "desks", [{"name": "monitors_per_desk", "label": "Monitors", "type": "number"}]),
            ("Private Focus Pod", "Quiet Space", "desks", [{"name": "soundproof", "label": "Acoustic Proofing", "type": "boolean"}]),
            ("Executive Boardroom", "Meeting Space", "seats", [{"name": "catering_enabled", "label": "Catering Available", "type": "boolean"}]),
        ],
        "education": [
            ("Lecture Theatre", "Space", "seats", [{"name": "projector", "label": "Dual Projector", "type": "boolean"}]),
            ("Computer Science Lab", "Space", "workstations", [{"name": "gpu_workstations", "label": "GPU Workstations", "type": "number"}]),
            ("Seminar Hall", "Space", "seats", [{"name": "audio_mic_count", "label": "Audio Mics", "type": "number"}]),
            ("Classroom", "Space", "seats", [{"name": "smartboard", "label": "Smartboard", "type": "boolean"}]),
        ],
    }

    selected = types_map.get(ws_type.lower(), [
        ("Primary Asset", "Equipment", "units", []),
        ("Secondary Facility", "Space", "units", []),
    ])

    for name, cat, unit, attrs in selected:
        rt = ResourceType(
            organization_id=org_id,
            workspace_id=workspace_id,
            name=name,
            category=cat,
            unit=unit,
            attributes_schema=json.dumps(attrs),
        )
        db.add(rt)
    db.commit()


def universal_search(db: Session, org_id: int, query: str, workspace_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Real cross-entity global search across resources, anomalies, scenarios, actions, and buildings.
    Never fabricates results; returns grounded database matches.
    """
    clean_q = query.strip()
    if not clean_q:
        return {"resources": [], "anomalies": [], "scenarios": [], "actions": [], "goals": []}

    like_term = f"%{clean_q}%"

    # 1. Resources
    res_query = db.query(Resource).filter(
        Resource.organization_id == org_id,
        or_(Resource.name.ilike(like_term), Resource.code.ilike(like_term), Resource.location.ilike(like_term)),
    )
    if workspace_id:
        res_query = res_query.filter(Resource.workspace_id == workspace_id)
    resources = res_query.limit(8).all()

    # 2. Anomalies
    anom_query = db.query(Anomaly).filter(
        Anomaly.organization_id == org_id,
        or_(Anomaly.reason.ilike(like_term), Anomaly.metric_type.ilike(like_term), Anomaly.anomaly_type.ilike(like_term)),
    )
    anomalies = anom_query.limit(5).all()

    # 3. Scenarios
    scen_query = db.query(Scenario).filter(
        Scenario.organization_id == org_id,
        or_(Scenario.name.ilike(like_term), Scenario.description.ilike(like_term)),
    )
    if workspace_id:
        scen_query = scen_query.filter(Scenario.workspace_id == workspace_id)
    scenarios = scen_query.limit(5).all()

    # 4. Actions
    act_query = db.query(Action).filter(
        Action.organization_id == org_id,
        or_(Action.title.ilike(like_term), Action.description.ilike(like_term)),
    )
    if workspace_id:
        act_query = act_query.filter(Action.workspace_id == workspace_id)
    actions = act_query.limit(5).all()

    # 5. Goals
    goal_query = db.query(Goal).filter(
        Goal.organization_id == org_id,
        or_(Goal.title.ilike(like_term), Goal.description.ilike(like_term)),
    )
    if workspace_id:
        goal_query = goal_query.filter(Goal.workspace_id == workspace_id)
    goals = goal_query.limit(5).all()

    return {
        "resources": [{"id": r.id, "name": r.name, "code": r.code, "type": r.resource_type.name if r.resource_type else "Resource", "location": r.location} for r in resources],
        "anomalies": [{"id": a.id, "reason": a.reason, "severity": a.severity, "metric": a.metric_type, "status": a.status} for a in anomalies],
        "scenarios": [{"id": s.id, "name": s.name, "status": s.status, "base_period": s.base_period} for s in scenarios],
        "actions": [{"id": ac.id, "title": ac.title, "status": ac.status, "action_type": ac.action_type} for ac in actions],
        "goals": [{"id": g.id, "title": g.title, "target_value": g.target_value, "unit": g.unit, "status": g.status} for g in goals],
    }


def seed_multidomain_workspaces(db: Session, org_id: int):
    """Provisions representative demo workspaces across industrial manufacturing, healthcare, and logistics."""
    demo_definitions = [
        {
            "name": "Fab-1 Advanced Manufacturing",
            "code": "MFG-01",
            "workspace_type": "factory",
            "description": "High-precision automated CNC milling, robotics, and assembly facility.",
            "location": "Industrial Park Zone B",
            "resources": [
                ("CNC 5-Axis Milling Center", "CNC-01", "CNC Machine", 250, "Line 1"),
                ("High-Speed Assembly Line A", "ASY-01", "Assembly Station", 500, "Assembly Bay"),
                ("Robotic Spot Welder Unit", "WLD-03", "CNC Machine", 120, "Welding Cell"),
                ("Heavy Hydraulic Press 400T", "PRS-02", "Heavy Press", 80, "Press Shop"),
                ("High-Efficiency Chiller Plant", "CHL-01", "Industrial Boiler", 450, "Utility Central"),
            ],
            "goals": [
                ("Maintain Overall Equipment Effectiveness (OEE) > 82%", "improve_utilization", 82.0, "%", 71.0, 78.4),
                ("Reduce Peak Grid Electrical Surges by 18%", "reduce_cost", 18.0, "%", 0.0, 11.5),
                ("Zero Line-Stoppage Scheduling Bottlenecks", "avoid_shortage", 0.0, "events", 4.0, 0.0),
            ],
        },
        {
            "name": "Metro Health Medical Center",
            "code": "HSP-01",
            "workspace_type": "hospital",
            "description": "Acute care surgical hospital, inpatient wards, and diagnostic facilities.",
            "location": "Central Metro Hospital",
            "resources": [
                ("Operating Theatre Suite 1", "OR-01", "Operating Theatre", 2, "Surgical Wing"),
                ("Intensive Care Unit Ward A", "ICU-01", "ICU Bed Unit", 16, "Critical Care"),
                ("Siemens 3T MRI Diagnostic Bay", "MRI-01", "MRI Scanner", 4, "Radiology"),
                ("Acute Emergency Trauma Bay", "TRM-01", "General Ward Room", 8, "Emergency"),
                ("Cardiology Inpatient Ward", "CRD-02", "General Ward Room", 24, "Inpatient 3rd Floor"),
            ],
            "goals": [
                ("Maintain ICU Bed Occupancy Safety Buffer between 65-80%", "improve_utilization", 75.0, "%", 58.0, 72.0),
                ("Eliminate Elective Surgery Rescheduling Due to Room Conflicts", "increase_capacity", 0.0, "delays", 6.0, 0.0),
                ("Curtail Unoccupied Inpatient Wing Energy Costs", "reduce_cost", 15.0, "%", 0.0, 9.4),
            ],
        },
        {
            "name": "Central Logistics & Freight Hub",
            "code": "LOG-01",
            "workspace_type": "warehouse",
            "description": "Multi-tier distribution center with automated sorting, high-bay bays, and loading docks.",
            "location": "Freight Terminal Hub 4",
            "resources": [
                ("High-Bay Storage Aisle 1-4", "BAY-01", "High-Bay Storage", 1200, "Zone North"),
                ("Climate-Controlled Vault B", "COLD-01", "Cold Storage Chamber", 450, "Cold Chain Zone"),
                ("Outbound Express Loading Dock 1", "DCK-01", "Loading Bay Dock", 4, "Dock Row A"),
                ("Automated Pallet Shuttle System", "SHT-01", "Electric Forklift", 120, "Transfer Bay"),
                ("Inbound Freight Inspection Dock 2", "DCK-02", "Loading Bay Dock", 4, "Dock Row B"),
            ],
            "goals": [
                ("Target 85% Pallet Storage Density Without Congestion", "improve_utilization", 85.0, "%", 64.0, 81.2),
                ("Reduce Dock Idle & Turnaround Time to < 18 min", "reduce_downtime", 18.0, "min", 32.0, 21.0),
                ("Optimize Fleet Charging Schedule for Off-Peak Tariffs", "reduce_cost", 20.0, "%", 0.0, 14.8),
            ],
        },
    ]

    for d in demo_definitions:
        existing = db.query(Workspace).filter(Workspace.organization_id == org_id, Workspace.code == d["code"]).first()
        if existing:
            continue

        ws_in = WorkspaceCreate(
            name=d["name"],
            code=d["code"],
            workspace_type=d["workspace_type"],
            description=d["description"],
            location=d["location"],
            is_active=True,
            is_demo=True,
        )
        ws = create_workspace(db, org_id, ws_in)

        # Retrieve newly provisioned resource types for this workspace
        rtypes = {rt.name: rt for rt in db.query(ResourceType).filter(ResourceType.workspace_id == ws.id).all()}

        for r_name, r_code, rt_name, cap, group in d["resources"]:
            rt = rtypes.get(rt_name)
            res = Resource(
                organization_id=org_id,
                workspace_id=ws.id,
                resource_type_id=rt.id if rt else None,
                name=r_name,
                code=r_code,
                capacity=cap,
                group_name=group,
                status="Active",
                location=f"{d['location']} - {group}",
            )
            db.add(res)
        db.commit()

        # Add specific goals
        for g_title, g_type, target, unit, baseline, curr in d["goals"]:
            g = Goal(
                organization_id=org_id,
                workspace_id=ws.id,
                title=g_title,
                goal_type=g_type,
                target_value=target,
                unit=unit,
                baseline_value=baseline,
                current_value=curr,
                timeframe="Q4 2026",
                status="In Progress",
                priority="High",
            )
            db.add(g)
        db.commit()

