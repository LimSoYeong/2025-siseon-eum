from db import Base, engine
from models import Summary

Base.metadata.create_all(bind=engine)
