"""Pydantic v2 schemas for the auth endpoints."""

from typing import Literal

from pydantic import BaseModel, ConfigDict


class OtpRequestBody(BaseModel):
    phone: str
    name: str
    role: Literal["farmer", "buyer", "admin"] = "farmer"


class OtpVerifyBody(BaseModel):
    phone: str
    code: str


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
