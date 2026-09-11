from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenPayload(BaseModel):
    sub: str
    exp: int
    role: str
    organization_id: int


class UserResponse(BaseModel):
    id: int
    organization_id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrganizationResponse(BaseModel):
    id: int
    name: str
    organization_type: str
    location: str
    timezone: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
    organization: Optional[OrganizationResponse] = None


class UserCreate(BaseModel):
    organization_id: int
    name: str
    email: EmailStr
    password: str
    role: str = "Viewer"
