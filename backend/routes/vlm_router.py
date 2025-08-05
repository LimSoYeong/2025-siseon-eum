# routes/vlm_router.py

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from infrastructure.vlm_client import extract_text_from_image

router = APIRouter(prefix="/api", tags=["VLM"])

@router.post("/describe")
async def extract_text_from_image_api(image: UploadFile = File(...)):
    try:
        image_bytes = await image.read()
        result = extract_text_from_image(image_bytes)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))