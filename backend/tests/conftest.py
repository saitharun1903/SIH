import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.core.security import get_password_hash
from app.models import Organization, User, Building, ResourceType, Resource

# Single shared in-memory SQLite engine for all tests
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Create all tables and baseline organization, users, and resources for the test suite."""
    Base.metadata.create_all(bind=test_engine)
    db = TestSessionLocal()

    # 1. Organization
    org = Organization(
        name="Test Campus Institute",
        organization_type="Educational Institution",
        location="Main Quad",
        timezone="UTC",
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    # 2. Baseline Users
    admin = User(
        organization_id=org.id,
        name="Admin Test",
        email="admintest@nexus.edu",
        password_hash=get_password_hash("Secret123"),
        role="Administrator",
        is_active=True,
    )
    analyst = User(
        organization_id=org.id,
        name="Analyst Test",
        email="analysttest@nexus.edu",
        password_hash=get_password_hash("Secret123"),
        role="Analyst",
        is_active=True,
    )
    viewer = User(
        organization_id=org.id,
        name="Viewer Test",
        email="viewertest@nexus.edu",
        password_hash=get_password_hash("Secret123"),
        role="Viewer",
        is_active=True,
    )
    db.add_all([admin, analyst, viewer])
    db.commit()

    # 3. Baseline Building & Resource Type
    bldg = Building(
        organization_id=org.id,
        name="Science Hall",
        code="SCI-01",
        location="North Wing",
        floor_count=3,
    )
    rt = ResourceType(
        organization_id=org.id,
        name="Classroom",
        category="Space",
        unit="seats",
    )
    db.add_all([bldg, rt])
    db.commit()
    db.refresh(bldg)
    db.refresh(rt)

    # 4. Baseline Resource
    res = Resource(
        organization_id=org.id,
        building_id=bldg.id,
        resource_type_id=rt.id,
        name="Lecture Hall 101",
        code="LH-101",
        capacity=60,
        status="Active",
        floor=1,
        area=900.0,
    )
    db.add(res)
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db():
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    return TestClient(app)
