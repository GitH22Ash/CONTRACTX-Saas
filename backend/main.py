import os
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm # <-- IMPORT IT HERE
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from uuid import UUID, uuid4
import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

import auth
import models
import schemas
from database import engine, get_db

# Create all database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# --- CORS Middleware ---
origins = [
    "http://localhost",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Dependency Injection for Auth ---
app.dependency_overrides[auth.get_db_from_context] = get_db


# --- API Endpoints ---

@app.post("/signup", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(id=uuid4(), username=user.username, hashed_password=hashed_password)
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)): # <-- CORRECT USAGE
    user = auth.authenticate_user(db, username=form_data.username, password=form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(
        data={"sub": user.username, "user_id": str(user.id)}
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/upload")
async def upload_contract(
    file: UploadFile = File(...),
    expiry_date: datetime.date = Form(...),
    parties: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Mock LlamaCloud Parsing
    mock_parsing_response = {
      "document_id": str(uuid4()),
      "chunks": [
        {
          "chunk_id": "c1",
          "text": f"Termination clause for {file.filename}: Either party may terminate with 90 days’ notice.",
          "embedding": [0.12, -0.45, 0.91, 0.33],
          "metadata": { "page": 2, "contract_name": file.filename, "clause_title": "Termination" }
        },
        {
          "chunk_id": "c2",
          "text": f"Liability cap for {file.filename}: Limited to 12 months’ fees.",
          "embedding": [0.01, 0.22, -0.87, 0.44],
          "metadata": { "page": 5, "contract_name": file.filename, "clause_title": "Liability" }
        }
      ]
    }

    # Store document metadata
    new_document = models.Document(
        id=UUID(mock_parsing_response["document_id"]),
        user_id=current_user.id,
        filename=file.filename,
        expiry_date=expiry_date,
        parties=parties,
        status="Active",
        risk_score="Low",
        uploaded_on=datetime.date.today()
    )
    db.add(new_document)
    db.commit()
    db.refresh(new_document)

    # Store chunks
    for chunk_data in mock_parsing_response["chunks"]:
        new_chunk = models.Chunk(
            id=uuid4(),
            doc_id=new_document.id,
            user_id=current_user.id,
            text_chunk=chunk_data["text"],
            embedding=chunk_data["embedding"],
            chunk_metadata=chunk_data["metadata"]
        )
        db.add(new_chunk)
    
    db.commit()

    return {"filename": file.filename, "doc_id": new_document.id, "chunks_saved": len(mock_parsing_response["chunks"])}


@app.get("/contracts", response_model=List[schemas.Document])
def get_contracts(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Document).filter(models.Document.user_id == current_user.id).all()


@app.get("/contracts/{doc_id}", response_model=schemas.DocumentDetail)
def get_contract_details(doc_id: UUID, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    document = db.query(models.Document).filter(models.Document.id == doc_id, models.Document.user_id == current_user.id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks = db.query(models.Chunk).filter(models.Chunk.doc_id == doc_id).all()
    
    mock_insights = [
        {"id": "risk1", "type": "risk", "text": "The termination clause allows for termination with a relatively short notice period of 90 days."},
        {"id": "rec1", "type": "recommendation", "text": "Consider negotiating a longer notice period for termination to ensure business continuity."},
        {"id": "risk2", "type": "risk", "text": "Liability is capped at 12 months' fees, which may not cover all potential damages in a major breach."}
    ]

    return {
        "id": document.id,
        "filename": document.filename,
        "uploaded_on": document.uploaded_on,
        "expiry_date": document.expiry_date,
        "status": document.status,
        "risk_score": document.risk_score,
        "parties": document.parties,
        "clauses": chunks,
        "insights": mock_insights
    }

@app.post("/ask")
def ask_question(question: schemas.Question, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    mock_query_embedding = [0.10, -0.40, 0.95, 0.30]
    
    relevant_chunks = db.query(models.Chunk).filter(models.Chunk.user_id == current_user.id).order_by(models.Chunk.embedding.l2_distance(mock_query_embedding)).limit(3).all()

    mock_answer = "Based on the retrieved documents, the contract can be terminated by either party with a 90 days' notice. The liability is capped at a sum equivalent to 12 months' fees."

    return {
        "answer": mock_answer,
        "retrieved_chunks": relevant_chunks
    }

