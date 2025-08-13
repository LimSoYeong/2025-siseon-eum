from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "sqlite:///./app.db"  # SQLite DB 파일

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite 멀티스레드 허용
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
