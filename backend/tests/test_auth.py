import pytest
from app.core.security import get_password_hash, verify_password, create_access_token, decode_access_token


def test_password_hashing():
    pwd = "MySecurePassword2026!"
    hashed = get_password_hash(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_lifecycle():
    token = create_access_token(subject=42, extra_claims={"role": "Administrator"})
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["role"] == "Administrator"

    invalid_payload = decode_access_token("gibberish-token")
    assert invalid_payload is None


def test_health_endpoint(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"]["status"] == "connected"


def test_login_success(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admintest@nexus.edu", "password": "Secret123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "admintest@nexus.edu"
    assert data["user"]["role"] == "Administrator"


def test_login_invalid_password(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admintest@nexus.edu", "password": "WrongPassword"},
    )
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["error"]["message"]


def test_protected_me_endpoint(client):
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "analysttest@nexus.edu", "password": "Secret123"},
    )
    token = login_res.json()["access_token"]

    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    user_data = me_res.json()
    assert user_data["email"] == "analysttest@nexus.edu"
    assert user_data["role"] == "Analyst"

    unauth_res = client.get("/api/v1/auth/me")
    assert unauth_res.status_code == 401


def test_rbac_register_permissions(client):
    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admintest@nexus.edu", "password": "Secret123"},
    )
    admin_token = admin_login.json()["access_token"]

    reg_res = client.post(
        "/api/v1/auth/register",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "organization_id": 1,
            "name": "New Staff Member",
            "email": "staff@nexus.edu",
            "password": "Password@123",
            "role": "Viewer",
        },
    )
    assert reg_res.status_code == 200
    assert reg_res.json()["email"] == "staff@nexus.edu"

    viewer_login = client.post(
        "/api/v1/auth/login",
        json={"email": "viewertest@nexus.edu", "password": "Secret123"},
    )
    viewer_token = viewer_login.json()["access_token"]

    forbidden_res = client.post(
        "/api/v1/auth/register",
        headers={"Authorization": f"Bearer {viewer_token}"},
        json={
            "organization_id": 1,
            "name": "Hacker",
            "email": "hacker@nexus.edu",
            "password": "Password@123",
            "role": "Administrator",
        },
    )
    assert forbidden_res.status_code == 403
