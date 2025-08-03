from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from db import Base

class Summary(Base):
    __tablename__ = "summaries"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String, index=True)
    original_text = Column(Text, nullable=False)
    summary_text = Column(Text, nullable=False)
    tts_path = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
