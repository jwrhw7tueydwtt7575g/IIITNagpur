import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from database import get_db
from models import User
from auth_utils import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

logger = logging.getLogger("citygraph.auth")

from rate_limiter import limiter

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


class UserRegister(BaseModel):
    email: str
    username: str
    password: str
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    username_or_email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str] = None
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


def seed_default_user(db: Session) -> None:
    """Seed a default administrative user for local development and demonstration."""
    import os
    environment = os.getenv("ENVIRONMENT", "development").lower()
    seed_allowed = os.getenv("SEED_DEFAULT_USER", "true" if environment != "production" else "false").lower() == "true"
    
    if not seed_allowed:
        logger.info("Default user auto-seeding skipped per configuration.")
        return

    admin_email = os.getenv("INITIAL_ADMIN_EMAIL", "admin@citygraph.org")
    admin_user = db.query(User).filter(
        (User.email == admin_email) | (User.username == "admin")
    ).first()

    if not admin_user:
        raw_password = os.getenv("INITIAL_ADMIN_PASSWORD", "password123" if environment != "production" else None)
        if not raw_password:
            logger.warning("INITIAL_ADMIN_PASSWORD not set; skipping admin user seeding.")
            return

        new_admin = User(
            email=admin_email,
            username="admin",
            full_name="City Operations Lead",
            hashed_password=hash_password(raw_password),
            role="Incident Commander",
        )
        db.add(new_admin)
        db.commit()
        logger.info(f"Default user seeded successfully: {admin_email} (password configured securely)")


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_user(req: UserRegister, request: Request, db: Session = Depends(get_db)):
    # Rate limit registration (5 requests per minute per IP)
    limiter.check_rate_limit(request, endpoint_key="auth_register", max_requests=5, window_seconds=60)

    email = req.email.strip().lower()
    username = req.username.strip().lower()

    if not email or "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid email address is required.",
        )

    if len(username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters long.",
        )

    if len(req.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )

    # Check for duplicate email
    if db.query(User).filter(User.email == email).first():
        logger.warning(f"Registration attempt failed: Email '{email}' already registered.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    # Check for duplicate username
    if db.query(User).filter(User.username == username).first():
        logger.warning(f"Registration attempt failed: Username '{username}' already taken.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This username is already taken. Please choose another.",
        )

    new_user = User(
        email=email,
        username=username,
        full_name=req.full_name.strip() if req.full_name else username.capitalize(),
        hashed_password=hash_password(req.password),
        role="Urban Risk Analyst",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info(f"New user registered successfully: {username} ({email})")

    token = create_access_token(data={"sub": new_user.username})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(new_user),
    )


@router.post("/login", response_model=TokenResponse)
def login_user(req: UserLogin, request: Request, db: Session = Depends(get_db)):
    # Rate limit login attempts (5 requests per minute per IP to mitigate brute-force)
    limiter.check_rate_limit(request, endpoint_key="auth_login", max_requests=5, window_seconds=60)

    identifier = req.username_or_email.strip().lower()

    user = db.query(User).filter(
        (User.email == identifier) | (User.username == identifier)
    ).first()

    if not user or not verify_password(req.password, user.hashed_password):
        logger.warning(f"Failed login attempt for identifier: {identifier}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username/email or password.",
        )

    logger.info(f"User logged in successfully: {user.username}")

    token = create_access_token(data={"sub": user.username})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Returns profile for currently authenticated user."""
    return UserOut.model_validate(current_user)


@router.post("/logout")
def logout_user(current_user: User = Depends(get_current_user)):
    """Logs out current user session."""
    logger.info(f"User logged out: {current_user.username}")
    return {"message": "Successfully logged out."}
