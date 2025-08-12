# qwen_multiagent_debate.py
import sys
from pathlib import Path

# ====== 경로 설정 (프로젝트 루트 추가) ======
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from datetime import datetime
from PIL import Image
import torch
import json
import time

# 모델/프로세서 로더
from model_loader import get_model, get_processor

# ====== 디렉터리/입출력 경로 ======
base_dir = ROOT_DIR
result_path = base_dir / "qwen" / "results_final.jsonl"
image_dir = base_dir / "data" / "img"
image_files = sorted(list(image_dir.glob("*.jpg")) + list(image_dir.glob("*.png")))

# ====== 모델 로드 ======
model = get_model().eval()     # 일관성 위해 eval 모드
processor = get_processor()

# ====== Agent 역할 프롬프트 ======
EXPLAINER_PROMPT = (
    "당신은 혼자 사는 80세 할머니에게 문서를 설명하는 따뜻한 손자 역할입니다. "
    "아래 문서를 읽고, 어르신이 이해할 수 있도록 쉬운 말과 친절한 말투로 설명해 주세요. "
    "전문 용어나 딱딱한 표현은 피하고, 또박또박 이야기하듯 말해 주세요. "
    "어르신이 헷갈릴 수 있는 부분은 미리 짚어주거나 예를 들어 설명해주세요."
)

GRANDMA_PROMPT = (
    "당신은 혼자 사는 80세 할머니입니다. 누군가가 문서 내용을 친절하게 설명해주었지만, "
    "시력도 약하고 학교도 오래전에 그만두어 어려운 말을 잘 이해하지 못합니다. "
    "설명 중에 조금이라도 어려운 단어, 익숙하지 않은 표현, 복잡한 내용이 나오면 꼭 물어보세요. "
    "예: '그게 무슨 말이냐', '조금 더 쉽게 말해줄래?'와 같은 말투로 1~2문장 질문을 해주세요."
)

HELPER_PROMPT = (
    "당신은 손자와 할머니의 대화를 도와주는 도우미입니다. "
    "손자가 설명한 내용 중 어르신이 이해하기 어려워한 단어나 표현이 있다면 더 쉬운 말로 바꿔 다시 설명해주세요. "
    "중요한 내용이 빠졌다면 간단히 덧붙이고, 너무 자세한 정보는 줄여주세요. "
    "마지막으로, 손자의 말투와 어조를 유지하면서 어르신에게 전달할 최종 요약 문장을 2~3문장으로 한 문단에 정리해 주세요."
)

# ====== Qwen 호출 함수 ======
def query_qwen(pil_image, system_prompt, user_prompt, max_new_tokens=300):
    """
    pil_image: PIL.Image.Image
    system_prompt: str
    user_prompt: str
    """
    # 메시지 포맷: 이미지+텍스트 혼합
    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": [
                {"type": "image", "image": pil_image},
                {"type": "text", "text": user_prompt},
            ],
        },
    ]

    # 채팅 템플릿 적용
    text = processor.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )

    # processor가 이미지 텐서화까지 처리
    inputs = processor(
        text=[text],
        images=[pil_image],
        return_tensors="pt",
        padding=True
    )

    # 디바이스로 이동
    inputs = {k: v.to(model.device) if hasattr(v, "to") else v for k, v in inputs.items()}

    with torch.no_grad():
        generated_ids = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,            # 재현성 우선. 필요시 True + temperature/top_p 조절
            eos_token_id=processor.tokenizer.eos_token_id,
        )

    # 프롬프트 부분 길이만큼 잘라서 디코딩
    input_ids = inputs["input_ids"]
    trimmed = [
        out_ids[len(in_ids):] for in_ids, out_ids in zip(input_ids, generated_ids)
    ]
    output_text = processor.batch_decode(
        trimmed,
        skip_special_tokens=True,
        clean_up_tokenization_spaces=False
    )[0]

    return output_text.strip()

# ====== 결과 저장 ======
def save_final_prompt(final_output, elapsed_time):
    result_path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "output": final_output,
        "infer_time": round(elapsed_time, 2)
    }
    with open(result_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

# ====== 메인 루프 ======
def main():
    if not image_files:
        print(f"⚠️ 이미지가 없습니다: {image_dir}")
        return

    for img_path in image_files:
        try:
            image = Image.open(img_path).convert("RGB")
        except Exception as e:
            print(f"⚠️ 이미지 열기 실패: {img_path} - {e}")
            continue

        start_time = time.time()

        try:
            # 1) 손자 설명
            summary = query_qwen(
                image,
                EXPLAINER_PROMPT,
                "아래 문서를 어르신께 설명해 주세요. 핵심을 먼저 말하고, 예시를 1개만 들어주세요.",
                max_new_tokens=350,
            )

            # 2) 할머니 질문 (설명 요약에 기반해 추가 질문 유도)
            grandma_reply = query_qwen(
                image,
                GRANDMA_PROMPT,
                f"손자가 이렇게 설명했어요:\n\n{summary}\n\n이 설명을 듣고 궁금한 점을 1~2문장으로 물어봐 주세요.",
                max_new_tokens=120,
            )

            # 3) 도우미 최종 정리
            helper_final = query_qwen(
                image,
                HELPER_PROMPT,
                f"설명자(손자): {summary}\n\n할머니: {grandma_reply}\n\n위 대화를 바탕으로 최종 어르신 요약을 2~3문장으로 작성해 주세요.",
                max_new_tokens=200,
            )

            elapsed_time = time.time() - start_time
            print(f"✅ {img_path.name} 요약 완료 (⏱ {elapsed_time:.2f}s): {helper_final[:60]}...")
            save_final_prompt(helper_final, elapsed_time)

        except torch.cuda.OutOfMemoryError:
            print("💥 CUDA OOM 발생 — empty_cache() 후 다음 이미지로 진행합니다.")
            torch.cuda.empty_cache()
            continue
        except Exception as e:
            print(f"⚠️ 처리 중 오류: {img_path.name} - {e}")
            continue

if __name__ == "__main__":
    main()
