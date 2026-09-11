"""Realistic institutional seed data generator for NEXUS.
Generates 1 organization, 4 buildings, 4 resource types, 55 resources
(40 classrooms, 10 labs, 5 seminar halls), hundreds of schedules,
and 14 days of time-series occupancy, utilization, and energy usage records.
"""

from datetime import datetime, timedelta, timezone
import random
from sqlalchemy.orm import Session
from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.models import (
    Organization,
    Building,
    ResourceType,
    Resource,
    Schedule,
    ResourceUsage,
    EnergyUsage,
    OccupancyRecord,
    Constraint,
)
from app.core.logging import logger

random.seed(42)  # Deterministic seed for reproducible analytics


def generate_seed_data(db: Session = None, force_reseed: bool = False):
    close_db_at_end = False
    if db is None:
        db = SessionLocal()
        close_db_at_end = True

    try:
        # 1. Get or create Organization
        org = db.query(Organization).first()
        if not org:
            org = Organization(
                name="Nexus Institute of Technology",
                organization_type="Educational Institution",
                location="Main Campus, Hyderabad",
                timezone="Asia/Kolkata",
            )
            db.add(org)
            db.commit()
            db.refresh(org)

        if not force_reseed:
            existing_count = db.query(Resource).filter(Resource.organization_id == org.id).count()
            if existing_count >= 50:
                logger.info(f"Seed data already present ({existing_count} resources found). Skipping reseed.")
                return {"message": f"Seed data already present ({existing_count} resources).", "reseeded": False}

        # Clear existing resources, schedules, usages if force_reseed
        if force_reseed:
            logger.info("Cleaning existing operational data for reseed...")
            db.query(OccupancyRecord).delete()
            db.query(EnergyUsage).delete()
            db.query(ResourceUsage).delete()
            db.query(Schedule).delete()
            db.query(Constraint).delete()
            db.query(Resource).filter(Resource.organization_id == org.id).delete()
            db.query(Building).filter(Building.organization_id == org.id).delete()
            db.query(ResourceType).filter(ResourceType.organization_id == org.id).delete()
            db.commit()

        # 2. Buildings (4 Campus Blocks)
        buildings_data = [
            {"name": "Turing Hall", "code": "BLOCK-A", "location": "North Quad", "floor_count": 4},
            {"name": "Ramanujan Block", "code": "BLOCK-B", "location": "East Wing", "floor_count": 4},
            {"name": "Aryabhata Tower", "code": "BLOCK-C", "location": "South Wing", "floor_count": 5},
            {"name": "Visvesvaraya Complex", "code": "BLOCK-D", "location": "West Quad", "floor_count": 3},
        ]
        building_objs = {}
        for b_data in buildings_data:
            bldg = db.query(Building).filter(Building.organization_id == org.id, Building.code == b_data["code"]).first()
            if not bldg:
                bldg = Building(organization_id=org.id, **b_data)
                db.add(bldg)
                db.commit()
                db.refresh(bldg)
            building_objs[b_data["code"]] = bldg

        # 3. Resource Types
        type_data = [
            {"name": "Classroom", "category": "Space", "unit": "seats", "description": "Standard lecture halls and smart rooms"},
            {"name": "Laboratory", "category": "Space", "unit": "workstations", "description": "Specialized computing & physical labs"},
            {"name": "Seminar Hall", "category": "Space", "unit": "seats", "description": "Large presentation and auditorium spaces"},
            {"name": "Equipment", "category": "Hardware", "unit": "units", "description": "Shared high-value institutional hardware"},
        ]
        type_objs = {}
        for t_data in type_data:
            rt = db.query(ResourceType).filter(ResourceType.organization_id == org.id, ResourceType.name == t_data["name"]).first()
            if not rt:
                rt = ResourceType(organization_id=org.id, **t_data)
                db.add(rt)
                db.commit()
                db.refresh(rt)
            type_objs[t_data["name"]] = rt

        # 4. Resources (55 Total)
        # 40 Classrooms
        classroom_rt = type_objs["Classroom"]
        lab_rt = type_objs["Laboratory"]
        seminar_rt = type_objs["Seminar Hall"]

        resource_objs = []

        # Block A Classrooms (14)
        for i in range(1, 15):
            fl = 1 if i <= 7 else 2
            room_no = f"A-{fl}{i%10:02d}"
            cap = 60 if i % 3 != 0 else (90 if i % 2 == 0 else 120)
            res = Resource(
                organization_id=org.id,
                building_id=building_objs["BLOCK-A"].id,
                resource_type_id=classroom_rt.id,
                name=f"Lecture Hall {room_no}",
                code=room_no,
                capacity=cap,
                status="Active",
                floor=fl,
                area=float(cap * 15),
                location=f"Block A, Floor {fl}",
            )
            resource_objs.append(res)

        # Block B Classrooms (14)
        for i in range(1, 15):
            fl = 1 if i <= 7 else 2
            room_no = f"B-{fl}{i%10:02d}"
            cap = 60 if i % 2 == 0 else 45
            res = Resource(
                organization_id=org.id,
                building_id=building_objs["BLOCK-B"].id,
                resource_type_id=classroom_rt.id,
                name=f"Smart Classroom {room_no}",
                code=room_no,
                capacity=cap,
                status="Active",
                floor=fl,
                area=float(cap * 14),
                location=f"Block B, Floor {fl}",
            )
            resource_objs.append(res)

        # Block C Classrooms (12) - Some intentionally underutilized
        for i in range(1, 13):
            fl = (i % 3) + 1
            room_no = f"C-{fl}{i%10:02d}"
            cap = 60
            res = Resource(
                organization_id=org.id,
                building_id=building_objs["BLOCK-C"].id,
                resource_type_id=classroom_rt.id,
                name=f"Tutorial Room {room_no}",
                code=room_no,
                capacity=cap,
                status="Active",
                floor=fl,
                area=750.0,
                location=f"Block C, Floor {fl}",
            )
            resource_objs.append(res)

        # 10 Laboratories in Block D & Block A
        labs_meta = [
            ("D-101", "AI & Robotics Lab", 40, "BLOCK-D", 1, '["GPU Workstations", "Robotics Kits"]'),
            ("D-102", "Advanced Computing Lab", 50, "BLOCK-D", 1, '["Linux Workstations", "High-Speed LAN"]'),
            ("D-201", "VLSI & Embedded Systems Lab", 35, "BLOCK-D", 2, '["FPGA Boards", "Oscilloscopes"]'),
            ("D-202", "IoT & Sensor Network Lab", 35, "BLOCK-D", 2, '["Microcontrollers", "Sensor Kits"]'),
            ("D-301", "Data Engineering Lab", 45, "BLOCK-D", 3, '["Cloud Nodes", "Dual Monitors"]'),
            ("D-302", "Cybersecurity & Network Lab", 40, "BLOCK-D", 3, '["Isolated Network", "Server Racks"]'),
            ("A-301", "Applied Physics Lab", 40, "BLOCK-A", 3, '["Optics Bench", "Spectrometer"]'),
            ("A-302", "Materials & Chemistry Lab", 35, "BLOCK-A", 3, '["Fume Hoods", "Chemical Storage"]'),
            ("B-301", "Digital Fabrication & CAD Lab", 30, "BLOCK-B", 3, '["3D Printers", "CAD Stations"]'),
            ("B-302", "Mechanical Simulation Lab", 30, "BLOCK-B", 3, '["ANSYS Stations", "Hydraulic Rig"]'),
        ]
        for code, name, cap, b_code, fl, eq in labs_meta:
            res = Resource(
                organization_id=org.id,
                building_id=building_objs[b_code].id,
                resource_type_id=lab_rt.id,
                name=name,
                code=code,
                capacity=cap,
                status="Active",
                floor=fl,
                area=float(cap * 22),
                location=f"{building_objs[b_code].name}, Floor {fl}",
                metadata_json=eq,
            )
            resource_objs.append(res)

        # 5 Seminar Halls
        seminars_meta = [
            ("AUD-01", "Turing Grand Auditorium", 500, "BLOCK-A", 1, "Main Campus Auditorium"),
            ("SEM-01", "Seminar Hall Alpha", 120, "BLOCK-B", 4, "AV Equipped Presentation Space"),
            ("SEM-02", "Seminar Hall Beta", 100, "BLOCK-C", 4, "Tiered Seating Hall"),
            ("CONF-01", "Executive Conference Room 1", 40, "BLOCK-A", 4, "Boardroom Style"),
            ("CONF-02", "Faculty Council Room 2", 35, "BLOCK-B", 4, "Discussion Suite"),
        ]
        for code, name, cap, b_code, fl, loc in seminars_meta:
            res = Resource(
                organization_id=org.id,
                building_id=building_objs[b_code].id,
                resource_type_id=seminar_rt.id,
                name=name,
                code=code,
                capacity=cap,
                status="Active",
                floor=fl,
                area=float(cap * 18),
                location=loc,
            )
            resource_objs.append(res)

        db.add_all(resource_objs)
        db.commit()
        for r in resource_objs:
            db.refresh(r)

        logger.info(f"Created {len(resource_objs)} institutional resources.")

        # 5. Schedules (Academic Timetable)
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        time_slots = [
            ("09:00", "10:00"),
            ("10:00", "11:00"),
            ("11:15", "12:15"),
            ("13:00", "14:00"),
            ("14:00", "15:00"),
            ("15:15", "16:15"),
        ]
        dept_subjects = {
            "Computer Science": ["Data Structures", "Algorithms Design", "Operating Systems", "Computer Networks", "Compiler Design"],
            "Artificial Intelligence": ["Machine Learning", "Deep Learning", "Natural Language Processing", "Computer Vision", "Knowledge Graphs"],
            "Electronics": ["VLSI Design", "Digital Signal Processing", "Microcontrollers", "Communication Systems", "Circuit Theory"],
            "Mathematics": ["Linear Algebra", "Calculus & Optimization", "Probability & Statistics", "Discrete Mathematics"],
            "Mechanical": ["Thermodynamics", "Fluid Mechanics", "Robotics Kinematics", "Finite Element Analysis"],
        }

        schedules = []
        # Populate schedules for classrooms and labs
        for idx, res in enumerate(resource_objs):
            # Leave room C-109, C-110 intentionally with very few classes (low utilization)
            is_low_util = res.code in ["C-109", "C-110", "C-209", "C-210"]
            # Make room A-101 and B-101 heavily booked (peak utilization)
            is_high_util = res.code in ["A-101", "B-101", "D-101"]

            slots_per_day = 1 if is_low_util else (5 if is_high_util else random.randint(3, 4))

            dept = list(dept_subjects.keys())[idx % len(dept_subjects)]
            subjects = dept_subjects[dept]

            for day in days:
                used_slots = random.sample(time_slots, min(slots_per_day, len(time_slots)))
                for start_t, end_t in used_slots:
                    subj = random.choice(subjects)
                    expected = int(res.capacity * (0.25 if is_low_util else (0.92 if is_high_util else random.uniform(0.65, 0.85))))
                    actual = int(expected * random.uniform(0.90, 1.05))
                    actual = min(actual, res.capacity)

                    sched = Schedule(
                        organization_id=org.id,
                        resource_id=res.id,
                        subject_name=f"{subj} ({dept[:4]})",
                        department=dept,
                        day_of_week=day,
                        start_time=start_t,
                        end_time=end_t,
                        expected_occupancy=expected,
                        actual_occupancy=actual,
                        equipment_requirements=res.metadata_json if res.resource_type_id == lab_rt.id else None,
                    )
                    schedules.append(sched)

        db.add_all(schedules)
        db.commit()
        logger.info(f"Created {len(schedules)} academic timetable schedules.")

        # 6. Time-Series Historical Records (14 Days)
        # Creates occupancy_records, resource_usage, and energy_usage
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        start_date = now - timedelta(days=14)

        usage_records = []
        energy_records = []
        occupancy_records = []

        tariff_per_kwh = 8.50  # INR per kWh

        curr_time = start_date
        while curr_time <= now:
            hour = curr_time.hour
            is_business_hour = 8 <= hour <= 18
            is_weekend = curr_time.weekday() >= 5

            # Sample a subset of resources each hour for rich multi-day time-series
            for res in resource_objs:
                # Base standby power
                base_kw = res.area * 0.005  # ~3-5 kW standby lighting/hvac
                active_kw = res.area * 0.025 # ~15-20 kW occupied

                if is_weekend:
                    occ = random.randint(0, 5) if random.random() < 0.1 else 0
                    kw = base_kw * random.uniform(0.8, 1.1)
                elif is_business_hour:
                    occ_ratio = 0.20 if res.code in ["C-109", "C-209"] else (0.92 if res.code in ["A-101", "B-101"] else random.uniform(0.5, 0.85))
                    occ = int(res.capacity * occ_ratio)
                    kw = (base_kw + active_kw * (occ / res.capacity)) * random.uniform(0.9, 1.1)
                else:
                    occ = 0
                    kw = base_kw * random.uniform(0.8, 1.0)

                # Intentional Anomaly: High night energy consumption on D-101 (Robotics Lab)
                if res.code == "D-101" and 1 <= hour <= 4 and curr_time.day % 4 == 0:
                    kw *= 4.5  # Server or robotics rig left active overnight!

                util_pct = round((occ / res.capacity) * 100.0, 1) if res.capacity > 0 else 0.0

                # Sample every 3 hours to keep table size optimized (~5,000 rows)
                if hour % 3 == 0:
                    occ_rec = OccupancyRecord(
                        resource_id=res.id,
                        timestamp=curr_time,
                        occupancy=occ,
                        source="sensor",
                    )
                    occupancy_records.append(occ_rec)

                    u_rec = ResourceUsage(
                        resource_id=res.id,
                        timestamp=curr_time,
                        usage_value=float(occ),
                        utilization_percent=util_pct,
                        source="system",
                    )
                    usage_records.append(u_rec)

                    cost = round(kw * tariff_per_kwh, 2)
                    e_rec = EnergyUsage(
                        resource_id=res.id,
                        timestamp=curr_time,
                        consumption=round(kw, 2),
                        unit="kWh",
                        cost=cost,
                    )
                    energy_records.append(e_rec)

            curr_time += timedelta(hours=3)

        db.add_all(occupancy_records)
        db.add_all(usage_records)
        db.add_all(energy_records)
        db.commit()

        logger.info(
            f"Created {len(occupancy_records)} occupancy logs, "
            f"{len(usage_records)} utilization points, and {len(energy_records)} energy meters."
        )

        return {
            "message": "Realistic institutional seed data successfully generated.",
            "buildings": len(buildings_data),
            "resources": len(resource_objs),
            "schedules": len(schedules),
            "occupancy_points": len(occupancy_records),
            "reseeded": True,
        }
    except Exception as e:
        logger.error(f"Error seeding demo data: {e}", exc_info=True)
        db.rollback()
        raise e
    finally:
        if close_db_at_end:
            db.close()


if __name__ == "__main__":
    logger.info("Executing standalone institutional seed script...")
    res = generate_seed_data(force_reseed=True)
    print("Seed result:", res)
