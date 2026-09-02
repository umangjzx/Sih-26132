"""Pydantic v2 schemas for the auth endpoints."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class RegisterBody(BaseModel):
    """Create an account: phone is the identity, password is the credential."""

    phone: str
    name: str
    role: Literal["farmer", "buyer", "admin"] = "farmer"
    password: str = Field(min_length=6, max_length=128)


class LoginBody(BaseModel):
    """Sign in with phone + password."""

    phone: str
    password: str


class RefreshBody(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    phone: str
    name: str
    role: str
    district: str
    taluka: str
    kyc_status: str
    is_active: bool


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: UserResponse
