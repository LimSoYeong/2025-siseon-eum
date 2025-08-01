# routes/vlm_router.py

import asyncio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from infrastructure.vlm_client import extract_text_from_image

router = APIRouter(prefix="/api", tags=["VLM"])

@router.post("/describe")
async def extract_text_from_image_api(image: UploadFile = File(...), background_tasks: BackgroundTasks = BackgroundTasks()):
    try:
        image_bytes = await image.read()
        result = extract_text_from_image(image_bytes, background_tasks)
        return {"result": result}
    except Exception as e:
        print("[ERROR]", e)
        raise HTTPException(status_code=500, detail=str(e))