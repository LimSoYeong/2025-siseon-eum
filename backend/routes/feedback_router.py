# backend/routes/feedback_router.py

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
import os, json, base64, mimetypes

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

BACKEND_DIR = Path(__file__).resolve().parents[1]   # .../backend
DATA_BASE   = BACKEND_DIR / "data"
SFT_JSONL   = DATA_BASE / "sft_train" / "sft.jsonl"
DPO_JSONL   = DATA_BASE / "dpo_train" / "dpo_dataset.jsonl"


def _save_jsonl(path: str, row: dict):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def _openai_improve(prompt: str, output: str, image_path: str | None) -> str:
    if client is None:
        return None
    sys_prompt = "너는 항상 한국어로만 답하며 한자 대신 한글을 사용한다. 같은 정보를 더 간결하고 정확하게 개선하라."
    user_text = (
        "이미지를 참고하여 다음 초안 요약을 더 나은 요약으로 개선해줘.\n\n"
        f"[지시]\n{prompt}\n\n[초안]\n{output}"
    )
    # chat.completions의 vision 입력 포맷
    content = [{"type": "text", "text": user_text}]
    if image_path and os.path.exists(image_path):
        mime, _ = mimetypes.guess_type(image_path)
        if not mime:
            mime = "image/jpeg"
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        data_url = f"data:{mime};base64,{b64}"
        content.append({"type": "image_url", "image_url": {"url": data_url}})

    try:
        r = client.chat.completions.create(
            model="gpt-4o-mini",   # 비용 절감 + 비전 지원
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": content},
            ],
            temperature=0.3,
        )
        text = (r.choices[0].message.content or "").strip()
        return text or None
    except Exception as e:
        # TODO: 재시도/백오프 넣어도 좋음
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
        improved = _openai_improve(prompt, output, img_path)
        # DB 업데이트 + DPO JSONL 적재
        db: Session = SessionLocal()
        try:
            fb = db.query(Feedback).filter(Feedback.id == row_id).first()
            if fb:
                fb.improved = improved
                db.commit()
            if improved:
                _save_jsonl(str(DPO_JSONL), {
                    "image_path": img_path,
                    "prompt": prompt,
                    "chosen": improved,
                    "rejected": output,
                    "ts": datetime.utcnow().isoformat(),
                    **meta,
                })
        finally:
            db.close()
    except Exception:
        pass


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
