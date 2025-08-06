import os
from dotenv import load_dotenv

load_dotenv()

APP_SERVER_URL = os.getenv("APP_SERVER_URL")

NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")