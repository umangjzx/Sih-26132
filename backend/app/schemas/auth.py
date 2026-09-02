"""Pydantic v2 schemas for the auth endpoints."""

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

_PHONE_RE = re.compile(r"^\+?\d{10,15}$")


def _clean_phone(v: str) -> str:
    """Strip spaces / dashes / parens, keep an optional leading +, require
    10-15 digits (an Indian mobile is 10; +91 prefix makes it 12)."""
    s = re.sub(r"[\s\-().]", "", (v or "").strip())
    if not _PHONE_RE.match(s):
        raise ValueError("Enter a valid phone number (10-15 digits, optional +country code)")
    return s


class RegisterBody(BaseModel):
    """Create an account: phone is the identity, password is the credential.

    ``role`` is farmer or buyer only — admin accounts are provisioned out of
    band (seed / DB), never via self-service registration.
    """

    phone: str
    name: str = Field(min_length=1, max_length=200)
    role: Literal["farmer", "buyer"] = "farmer"
    password: str = Field(min_length=6, max_length=128)
    # Optional trading location, captured from the browser at sign-up.
    district: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return _clean_phone(v)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v


class LoginBody(BaseModel):
    """Sign in with phone + password."""

    phone: str
    password: str

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        # be lenient on login — just normalise, don't 422 an almost-right number
        import re as _re

        return _re.sub(r"[\s\-().]", "", (v or "").strip())


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
    state: str = ""
    latitude: float | None = None
    longitude: float | None = None
    kyc_status: str
    verification_status: str = "unverified"
    verification_note: str | None = None
    is_active: bool


class ProfileUpdate(BaseModel):
    """Fields a user may change on their own account. Note: role, phone,
    verification status and is_active are deliberately not here."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    district: str | None = Field(default=None, max_length=120)
    taluka: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @field_validator("name", "district", "taluka", "state")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class RequestVerification(BaseModel):
    """A user asks an admin to verify their account."""

    note: str | None = Field(default=None, max_length=500)
    reference: str | None = Field(default=None, max_length=120)


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: UserResponse


# --------------------------------------------------------------------------- #
# Admin user management (v1.4)
# --------------------------------------------------------------------------- #

class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str
    role: str
    district: str
    state: str = ""
    kyc_status: str
    verification_status: str
    verification_note: str | None = None
    verification_ref: str | None = None
    is_active: bool
    created_at: object | None = None
    lots: int = 0
    demands: int = 0
    deals: int = 0


class VerifyUserBody(BaseModel):
    status: Literal["verified", "rejected", "unverified"]
    note: str | None = Field(default=None, max_length=500)


class SetActiveBody(BaseModel):
    is_active: bool
