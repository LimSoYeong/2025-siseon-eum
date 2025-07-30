# model-server/app.py

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from inference import run_inference

app = FastAPI()

# CORS 설정 (원한다면 API 서버 도메인만 열기)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/inference")
async def inference_endpoint(image: UploadFile = File(...)):
    image_bytes = await image.read()
    try:
        result = run_inference(image_bytes)
        return result
    except Exception as e:
        return {"error": str(e)}