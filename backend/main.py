import os
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from uuid import UUID, uuid4
from datetime import date
from dotenv import load_dotenv
from fastapi.security import OAuth2PasswordRequestForm

# Load environment variables from .env file
load_dotenv()

import auth
import models
import schemas
from database import SessionLocal, engine, get_db

# This line is commented out for production deployment
# models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Contract AI API", version="1.0")

# --- CORS Middleware ---
# This allows your frontend to communicate with your backend
# Using "*" is acceptable for a prototype/demo project.
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = auth.authenticate_user(db, username=form_data.username, password=form_data.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/upload")
async def upload_contract(
    file: UploadFile = File(...),
    parties: str = Form(...),
    expiry_date: date = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Mock LlamaCloud parsing
    # In a real app, you would send the file content to a parsing service
    # Here, we just create mock chunks.
    
    # 1. Create and save the document metadata
    new_doc = models.Document(
        id=uuid4(),
        user_id=current_user.id,
        filename=file.filename,
        parties=parties,
        expiry_date=expiry_date,
        status="Active", # Mock status
        risk_score="Low" # Mock risk score
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    # 2. Mock LlamaCloud response and save chunks
    mock_llama_response = {
        "document_id": str(new_doc.id),
        "chunks": [
            {
                "chunk_id": "c1",
                "text": f"Termination clause for {file.filename}: Either party may terminate with 90 days’ notice.",
                "embedding": [0.12, -0.45, 0.91, 0.33],
                "metadata": { "page": 2, "contract_name": file.filename, "clause_title": "Termination" }
            },
            {
                "chunk_id": "c2",
                "text": f"Liability cap from {file.filename}: Limited to 12 months’ fees.",
                "embedding": [0.01, 0.22, -0.87, 0.44],
                "metadata": { "page": 5, "contract_name": file.filename, "clause_title": "Liability" }
            }
        ]
    }

    for chunk_data in mock_llama_response["chunks"]:
        new_chunk = models.Chunk(
            id=uuid4(),
            doc_id=new_doc.id,
            user_id=current_user.id,
            text_chunk=chunk_data["text"],
            embedding=chunk_data["embedding"],
            chunk_metadata=chunk_data["metadata"]
        )
        db.add(new_chunk)
    
    db.commit()

    return {"filename": file.filename, "doc_id": new_doc.id, "status": "processed"}

@app.get("/contracts", response_model=List[schemas.Document])
def get_contracts(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    contracts = db.query(models.Document).filter(models.Document.user_id == current_user.id).all()
    return contracts

@app.get("/contracts/{doc_id}", response_model=schemas.DocumentDetail)
def get_contract_details(doc_id: UUID, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    document = db.query(models.Document).filter(models.Document.id == doc_id, models.Document.user_id == current_user.id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    chunks = db.query(models.Chunk).filter(models.Chunk.doc_id == doc_id).all()
    
    # Mock insights
    mock_insights = [
        {"id": 1, "type": "risk", "text": "Termination notice period is longer than standard."},
        {"id": 2, "type": "recommendation", "text": "Consider negotiating a liability cap based on annual fees."}
    ]

    return {
        "id": document.id,
        "filename": document.filename,
        "parties": document.parties,
        "expiry_date": document.expiry_date,
        "status": document.status,
        "risk_score": document.risk_score,
        "clauses": chunks,
        "insights": mock_insights
    }

@app.post("/ask")
def ask_question(question: schemas.Question, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Mock RAG workflow
    # 1. Embed the user's question (mocked)
    mock_query_embedding = [0.1, 0.2, 0.3, 0.4]

    # 2. Perform vector search in Postgres (mocked)
    # In a real app, you would use a SQL query with pgvector's cosine distance/similarity operator
    # e.g., SELECT *, 1 - (embedding <=> '[0.1,0.2,...]') AS similarity FROM chunks WHERE user_id = ... ORDER BY similarity DESC LIMIT 5
    retrieved_chunks = db.query(models.Chunk).filter(models.Chunk.user_id == current_user.id).limit(2).all()
    
    # 3. Generate a mock answer
    mock_answer = f"Based on the retrieved documents, the answer to '{question.question}' relates to termination and liability clauses. Please review the provided snippets for details."

    return {
        "answer": mock_answer,
        "retrieved_chunks": retrieved_chunks
    }

