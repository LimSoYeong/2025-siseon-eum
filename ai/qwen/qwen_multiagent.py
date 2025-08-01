from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
from pathlib import Path
from datetime import datetime
from PIL import Image
import torch
import json
import time

# ====== 디렉터리 설정 ======
base_dir = Path(__file__).resolve().parent.parent
result_path = base_dir / "qwen" / "results.jsonl"
embedding_dir = base_dir / "qwen" / "cached_embeds"
embedding_files = [embedding_dir / f"img_{i:03d}.pt" for i in range(1, 11)]

# ====== 모델 및 프로세서 로드 ======
model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
    "Qwen/Qwen2.5-VL-7B-Instruct", 
    torch_dtype=torch.float16,
    device_map="auto"
)
model.eval()

processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-VL-7B-Instruct", use_fast=False)

# ====== Agent 역할 프롬프트 ======
EXPLAINER_PROMPT = """
당신은 노인에게 문서를 쉽고 따뜻하게 설명하는 손자 역할입니다.
아래 문서 내용을 토대로 어르신이 이해할 수 있도록 쉬운 말, 친절한 말투로 요약해 주세요.
반말이나 딱딱한 표현은 피하고, 공손하고 친근한 말투를 사용하세요.
"""

GRANDMA_PROMPT = """
당신은 혼자 사는 80세 할머니입니다. 누군가 설명해준 문장을 듣고 이해되지 않는 단어, 표현, 개념이 있으면 질문하세요.
당신은 시력이 약하고 교육 수준이 높지 않아 어려운 단어가 나올 경우 잘 이해하지 못합니다.
"""

HELPER_PROMPT = """
당신은 도우미입니다. 손자와 할머니의 대화를 보고, 어려운 단어나 표현이 있다면 더 쉬운 말로 바꿔 설명해주세요.
또한 중요한 정보가 빠졌다면 보완해서 최종 어르신용 요약 문장을 만들어 주세요.
"""

# ====== Qwen에게 텍스트 생성 요청 ======
def query_qwen(image_inputs, system_prompt, user_prompt):
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": [
            {"type": "image", "image": "<cached>"},
            {"type": "text", "text": user_prompt}
        ]}
    ]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = processor(
        text=[text],
        images=image_inputs,
        return_tensors="pt",
        padding=True
    )
    inputs = inputs.to(model.device)

    with torch.no_grad():
        generated_ids = model.generate(
            **inputs,
            max_new_tokens=128,
            do_sample=False
        )
        generated_ids_trimmed = [
            out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]
        output_text = processor.batch_decode(
            generated_ids_trimmed,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False
        )[0]
    return output_text.strip()


# ====== 결과 저장 ======
def save_final_prompt(image_id, final_prompt):
    result_path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "image_id": image_id,
        "final_prompt": final_prompt,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(result_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

# ====== 전체 루프 실행 ======
for embed_file in embedding_files:
    torch.cuda.empty_cache()
    if not embed_file.exists():
        print(f"❌ 임베딩 파일 없음: {embed_file.name}")
        continue

    image_inputs = torch.load(embed_file, weights_only=False)
    image_id = embed_file.stem

    # Step 1: 설명자 요약
    summary = query_qwen(image_inputs, EXPLAINER_PROMPT, "아래 문서를 어르신께 설명해 주세요.")

    # Step 2: 할머니 피드백
    grandma_reply = query_qwen(image_inputs, GRANDMA_PROMPT, f"손자가 이렇게 설명했어요: {summary}")

    # Step 3: 보조자 최종 정제
    helper_final = query_qwen(
        image_inputs,
        HELPER_PROMPT,
        f"설명자: {summary}\n\n할머니: {grandma_reply}\n\n위 대화를 바탕으로 최종 어르신 요약을 5문장이 넘지 않도록 작성해 주세요."
    )

    print(f"✅ [{image_id}] 최종 요약: {helper_final[:50]}...")
    save_final_prompt(image_id, helper_final)
