from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[str] = None

# --- User Schemas ---
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: UUID

    class Config:
        from_attributes = True

# --- Chunk Schemas ---
class ChunkBase(BaseModel):
    text_chunk: str
    chunk_metadata: Optional[Dict[str, Any]] = None

class Chunk(ChunkBase):
    id: UUID
    doc_id: UUID

    class Config:
        from_attributes = True

# --- Document Schemas ---
class DocumentBase(BaseModel):
    filename: str
    expiry_date: date
    parties: str
    status: str
    risk_score: str

class Document(DocumentBase):
    id: UUID
    uploaded_on: date

    class Config:
        from_attributes = True

class DocumentDetail(Document):
    clauses: List[Chunk] = []
    insights: List[Dict[str, Any]] = []

# --- Query Schemas ---
class Question(BaseModel):
    question: str

