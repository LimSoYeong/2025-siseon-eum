from db_config import Base, engine
from models import Conversation, RecentDoc

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("DB 테이블 생성 완료 (app.db)")
