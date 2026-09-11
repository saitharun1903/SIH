"""
Tests for Phase 11 Pluggable AI Assistant & Grounded Query Engine
"""

import pytest


def get_token(client, email: str = "viewertest@nexus.edu"):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return res.json()["access_token"]


def test_get_suggested_prompts(client):
    token = get_token(client)
    res = client.get(
        "/api/v1/assistant/suggested-prompts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    prompts = res.json()
    assert len(prompts) >= 4
    assert any("phantom" in p.lower() for p in prompts)


def test_assistant_chat_phantom_energy(client):
    token = get_token(client)
    res = client.post(
        "/api/v1/assistant/chat",
        json={"prompt": "How much phantom energy was wasted?"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "answer" in data
    assert data["category"] == "phantom_energy"
    assert "metrics" in data
    assert "suggested_actions" in data


def test_assistant_chat_underutilization(client):
    token = get_token(client)
    res = client.post(
        "/api/v1/assistant/chat",
        json={"prompt": "Which classrooms are underutilized below 40%?"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "answer" in data
    assert data["category"] == "underutilization"


def test_assistant_chat_friday_policy(client):
    token = get_token(client)
    res = client.post(
        "/api/v1/assistant/chat",
        json={"prompt": "What happens if we move Friday classes online?"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "answer" in data
    assert data["category"] == "policy_simulation"
    assert "weekly_energy_savings_kwh" in data["metrics"]
