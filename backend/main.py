import os
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from uuid import UUID, uuid4
from datetime import date, timedelta  # Corrected import to include 'date'
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

import auth
import models
import schemas
from database import SessionLocal, engine, get_db

# This line is problematic for production and should be removed or commented out.
# We will create tables manually or with a migration tool.
# models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Contract AI API", version="1.0")

# --- CORS Middleware ---
# This allows your frontend to communicate with your backend
origins = [
    "http://localhost:5173",
    "https://contractx-saas.netlify.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Endpoints ---

@app.post("/signup", response_model=schemas.User, status_code=201)
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
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
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
    doc_id = uuid4()
    
    # 1. Create the Document record
    new_document = models.Document(
        id=doc_id,
        user_id=current_user.id,
        filename=file.filename,
        uploaded_on=date.today(),
        expiry_date=expiry_date,
        parties=parties,
        status="Active",  # Mock status
        risk_score="Low" # Mock risk score
    )
    db.add(new_document)
    db.commit()
    db.refresh(new_document)

    # 2. Mock parsing and create Chunk records
    mock_chunks = [
        {
            "chunk_id": "c1",
            "text": "Termination clause: Either party may terminate with 90 days’ notice.",
            "embedding": [0.12, -0.45, 0.91, 0.33],
            "metadata": {"page": 2, "contract_name": file.filename, "clause_title": "Termination"}
        },
        {
            "chunk_id": "c2",
            "text": "Liability cap: Limited to 12 months’ fees.",
            "embedding": [0.01, 0.22, -0.87, 0.44],
            "metadata": {"page": 5, "contract_name": file.filename, "clause_title": "Limitation of Liability"}
        }
    ]

    for chunk_data in mock_chunks:
        new_chunk = models.Chunk(
            id=uuid4(),
            doc_id=doc_id,
            user_id=current_user.id,
            text_chunk=chunk_data["text"],
            embedding=chunk_data["embedding"],
            chunk_metadata=chunk_data["metadata"]
        )
        db.add(new_chunk)

    db.commit()

    return {"filename": file.filename, "doc_id": doc_id, "status": "processed"}

@app.get("/contracts", response_model=List[schemas.Document])
def get_user_contracts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    contracts = db.query(models.Document).filter(models.Document.user_id == current_user.id).all()
    return contracts

@app.get("/contracts/{doc_id}", response_model=schemas.DocumentDetail)
def get_contract_details(
    doc_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    document = db.query(models.Document).filter(models.Document.id == doc_id, models.Document.user_id == current_user.id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks = db.query(models.Chunk).filter(models.Chunk.doc_id == doc_id).all()
    
    # Mock insights
    mock_insights = [
        {"id": "ins1", "type": "risk", "text": "The 90-day termination notice is standard but could be shorter."},
        {"id": "ins2", "type": "recommendation", "text": "Consider adding a clause for termination for cause with a shorter notice period."}
    ]

    return {
        **document.__dict__,
        "clauses": chunks,
        "insights": mock_insights
    }

@app.post("/ask")
def ask_question(question: schemas.Question, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Mock RAG workflow
    # 1. Embed query (mocked)
    query_embedding = [0.1, 0.2, 0.3, 0.4]

    # 2. Vector search (this is a simplified example)
    # In a real app, you would use pgvector's cosine distance operator
    from sqlalchemy import text
    
    # IMPORTANT: This is a simplified search and not a true vector search.
    # A real implementation would use something like:
    # result = db.execute(text("SELECT id, text_chunk, chunk_metadata FROM chunks ORDER BY embedding <-> :query_embedding LIMIT 5"), 
    #                     {"query_embedding": str(query_embedding)})
    # For now, we'll just return the first few chunks for this user.
    
    retrieved_chunks = db.query(models.Chunk).filter(models.Chunk.user_id == current_user.id).limit(3).all()

    # 3. Mock AI answer
    mock_answer = "Based on the retrieved documents, the termination clause generally requires a 90-day notice. However, liability is capped at 12 months of fees."

    return {
        "answer": mock_answer,
        "retrieved_chunks": retrieved_chunks
    }

