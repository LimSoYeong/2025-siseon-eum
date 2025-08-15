# backend/routes/feedback_router.py

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
import os, json, base64, mimetypes
from io import BytesIO
from PIL import Image
import time

from db_config import SessionLocal
from models import Feedback
from config.settings import OPENAI_API_KEY
from data_store.recent_docs import get_recent_doc_by_doc_id

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend
from config.settings import OPENAI_API_KEY

from openai import OpenAI
client = OpenAI(api_key=OPENAI_API_KEY)

router = APIRouter(prefix="/api", tags=["Feedback"])

MAX_SIDE = 1600  # 긴 변 상한(전송/비용 안정화)

BACKEND_DIR = Path(__file__).resolve().parents[1]   # .../backend
DATA_BASE   = BACKEND_DIR / "data"
SFT_JSONL   = DATA_BASE / "sft_train" / "sft.jsonl"
DPO_JSONL   = DATA_BASE / "dpo_train" / "dpo_dataset.jsonl"


def _save_jsonl(path: str, row: dict):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")

def _encode_image_as_data_url(path: str) -> tuple[str | None, int]:
    if not (path and os.path.exists(path)):
        return None, 0
    try:
        mime, _ = mimetypes.guess_type(path)
        if not mime:
            mime = "image/jpeg"
        img = Image.open(path).convert("RGB")
        w, h = img.size
        scale = min(1.0, MAX_SIDE / max(w, h))
        if scale < 1.0:
            img = img.resize((int(w * scale), int(h * scale)))
        buf = BytesIO()
        ext = "JPEG" if mime.endswith(("jpeg", "jpg")) else "PNG"
        img.save(buf, format=ext, optimize=True, quality=92 if ext == "JPEG" else None)
        b = buf.getvalue()
        b64 = base64.b64encode(b).decode("ascii")
        return f"data:{mime};base64,{b64}", len(b)
    except Exception as e:
        print(f"[feedback_router] _encode_image_as_data_url error: {e}", flush=True)
        return None, 0



def _openai_improve(prompt: str, image_path: str | None) -> str | None:
    if client is None:
        print("[feedback_router] OpenAI client is None (no API key)", flush=True)
        return None

    data_url, bytes_len = _encode_image_as_data_url(image_path) if image_path else (None, 0)
    print(f"[feedback_router] image_path={image_path} exists={bool(image_path and os.path.exists(image_path))} size_bytes={bytes_len}", flush=True)

    sys_prompt = (
        "너는 한국어 요약 전문가다. 한자 금지. 사람 신원/나이/성별/민감특성 추정 금지. "
        "배경·물체·표지 텍스트 등 비식별 정보 중심으로 간결·정확하게 2~3문장 요약."
    )
    user_text = f"이미지를 참고해 다음 지시에 맞게 2~3문장 요약을 생성해줘.\n[지시]\n{prompt}"

    content = [{"type": "text", "text": user_text}]
    if data_url:
        content.append({"type": "image_url", "image_url": {"url": data_url, "detail": "high"}})
        print("[feedback_router] sending vision: YES", flush=True)
    else:
        print("[feedback_router] sending vision: NO", flush=True)

    t0 = time.time()
    try:
        r = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": content},
            ],
            temperature=0.2,
            max_tokens=200,
        )
        dt = time.time() - t0
        text = (r.choices[0].message.content or "").strip()
        print(f"[feedback_router] latency_sec={dt:.2f}", flush=True)
        print(f"[feedback_router] improved text: {text[:200]}", flush=True)
        return text or None
    except Exception as e:
        print(f"[feedback_router] OpenAI error: {e}", flush=True)
        return None


class FeedbackIn(BaseModel):
    user_id: str | None = None
    doc_id: str | None = None
    image_path: str | None = None
    prompt: str
    output: str
    feedback: str  # "good" | "bad"
    note: str | None = None
    regenerate_with_openai: bool = True


def _background_improve_and_log(row_id: int, prompt: str, output: str, img_path: str | None, meta: dict):
    try:
        improved = _openai_improve(prompt, img_path)

        db: Session = SessionLocal()
        try:
            fb = db.query(Feedback).filter(Feedback.id == row_id).first()
            if fb:
                fb.improved = improved
                db.commit()
        finally:
            db.close()

        if improved:
            _save_jsonl(str(DPO_JSONL), {
                "image_path": img_path,
                "prompt": prompt,
                "chosen": improved,
                "rejected": output,
                "ts": datetime.utcnow().isoformat(),
                **meta,
            })
            print(f"[feedback_router] DPO appended: {DPO_JSONL}", flush=True)
        else:
            print("[feedback_router] improved is None -> skip DPO append", flush=True)

    except Exception as e:
        # ❗ 디버깅 중에는 절대 삼키지 말고 찍자
        print(f"[feedback_router] background task error: {e}", flush=True)


@router.post("/feedback")
def submit_feedback(payload: FeedbackIn, background_tasks: BackgroundTasks):
    db: Session = SessionLocal()
    improved = None
    try:
        # 라벨 정규화 (positive/up -> good, negative/down -> bad)
        fb = (payload.feedback or "").strip().lower()
        if fb in ("positive", "up", "👍", "good"):
            fb_norm = "good"
        elif fb in ("negative", "down", "👎", "bad"):
            fb_norm = "bad"
        else:
            fb_norm = fb or "bad"

        # 이미지 경로 보강
        img_path = payload.image_path
        if (not img_path) and payload.doc_id:
            row = get_recent_doc_by_doc_id(payload.doc_id)
            if row and row.get("path"):
                img_path = row["path"]

        fb = Feedback(
            user_id=payload.user_id,
            doc_id=payload.doc_id,
            image_path=img_path,
            prompt=payload.prompt,
            output=payload.output,
            feedback=fb_norm,
            improved=None,
            note=payload.note,
        )
        db.add(fb)
        db.commit()
        db.refresh(fb)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

    if fb_norm == "good":
        _save_jsonl(SFT_JSONL, {
            "image": img_path,
            "instruction": payload.prompt,
            "output": payload.output,
            "ts": datetime.utcnow().isoformat(),
            "user_id": payload.user_id,
            "doc_id": payload.doc_id,
        })
    else:
        # 👎은 비동기로 OpenAI 개선 생성 + DPO 적재. 즉시 응답 반환
        if payload.regenerate_with_openai:
            meta = {"user_id": payload.user_id, "doc_id": payload.doc_id, "chosen_source": "openai"}
            background_tasks.add_task(
                _background_improve_and_log,
                fb.id,
                payload.prompt,
                payload.output,
                img_path,
                meta,
            )

    return {"status": "ok", "queued": fb_norm == "bad", "id": fb.id}
