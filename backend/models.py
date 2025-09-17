import uuid
from sqlalchemy import Column, String, Date, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

    documents = relationship("Document", back_populates="owner")
    
    # Explicit constructor to fix the TypeError
    def __init__(self, id, username, hashed_password):
        self.id = id
        self.username = username
        self.hashed_password = hashed_password

class Document(Base):
    __tablename__ = "documents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    filename = Column(String, index=True)
    uploaded_on = Column(Date, default=datetime.date.today)
    expiry_date = Column(Date)
    status = Column(String)
    risk_score = Column(String)
    parties = Column(String)

    owner = relationship("User", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document")

class Chunk(Base):
    __tablename__ = "chunks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doc_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    text_chunk = Column(String)
    embedding = Column(Vector(4))  # Match the mock embedding dimension
    chunk_metadata = Column(JSON)

    document = relationship("Document", back_populates="chunks")

