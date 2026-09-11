from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.config import settings
from app.core.security import verify_password, create_access_token, get_password_hash
from app.models import User, Organization, AuditLog
from app.schemas.auth import LoginRequest, Token, UserResponse, OrganizationResponse, UserCreate
from app.api.deps import get_current_user, require_admin

router = APIRouter()


@router.post("/auth/login", response_model=Token, summary="User Authentication & JWT Issuance")
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user with email/password and return JWT access token with role."""
    user = db.query(User).filter(User.email == login_data.email.lower().strip()).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deactivated. Please contact an administrator.",
        )

    # Fetch organization details
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()

    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        subject=user.id,
        expires_delta=expires_delta,
        extra_claims={
            "role": user.role,
            "organization_id": user.organization_id,
            "email": user.email,
            "name": user.name,
        },
    )

    # Record login action in audit log
    audit_log = AuditLog(
        user_id=user.id,
        organization_id=user.organization_id,
        action="AUTH_LOGIN",
        entity_type="User",
        entity_id=user.id,
        metadata_json='{"status": "success"}',
    )
    db.add(audit_log)
    db.commit()

    return Token(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
        organization=OrganizationResponse.model_validate(org) if org else None,
    )


@router.get("/auth/me", response_model=UserResponse, summary="Get Current Authenticated User")
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Return profile data of current authenticated user."""
    return UserResponse.model_validate(current_user)


@router.post("/auth/register", response_model=UserResponse, summary="Register New User Account")
def register_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Administrator-only endpoint to create new users with specific roles."""
    existing_user = db.query(User).filter(User.email == user_in.email.lower().strip()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists.",
        )

    org = db.query(Organization).filter(Organization.id == user_in.organization_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specified organization not found.",
        )

    allowed_roles = ["Administrator", "Analyst", "Viewer"]
    if user_in.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role. Must be one of: {', '.join(allowed_roles)}",
        )

    new_user = User(
        organization_id=user_in.organization_id,
        name=user_in.name,
        email=user_in.email.lower().strip(),
        password_hash=get_password_hash(user_in.password),
        role=user_in.role,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return UserResponse.model_validate(new_user)
