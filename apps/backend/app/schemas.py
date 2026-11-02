from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field

Email = Annotated[EmailStr, AfterValidator(str.lower)]


class RegisterRequest(BaseModel):
    email: Email
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: Email
    password: str


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
