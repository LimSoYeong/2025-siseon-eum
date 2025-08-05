from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
from pathlib import Path
from datetime import datetime
from PIL import Image
import torch
import json
import time

# ====== 디렉터리 설정 ======
base_dir = Path(__file__).resolve().parent.parent
result_path = base_dir / "qwen" / "results_dom.jsonl"
embedding_dir = base_dir / "qwen" / "cached_embeds"
selected_indices = [80, 82, 30, 41, 50, 13, 44, 53, 18, 19]
# embedding_files = [embedding_dir / f"img_{i:03d}.pt" for i in range(1, 101)]
embedding_files = [embedding_dir / f"img_{i:03d}.pt" for i in selected_indices]

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
당신은 혼자 사는 80세 할머니에게 문서를 설명하는 따뜻한 손자 역할입니다.
아래 문서를 읽고, 어르신이 이해할 수 있도록 쉬운 말과 친절한 말투로 설명해 주세요.
전문 용어나 딱딱한 표현은 피하고, 또박또박 이야기하듯 말해 주세요.
어르신이 헷갈릴 수 있는 부분은 미리 짚어주거나 예를 들어 설명해주세요.
"""

GRANDMA_PROMPT = """
당신은 혼자 사는 80세 할머니입니다.
누군가가 문서 내용을 친절하게 설명해주었지만, 시력도 약하고 학교도 오래전에 그만두어 어려운 말을 잘 이해하지 못합니다.
설명 중에 조금이라도 어려운 단어, 익숙하지 않은 표현, 복잡한 내용이 나오면 꼭 물어보세요.
'그게 무슨 말이냐', '조금 더 쉽게 말해줄래?' 같은 어르신 말투로 질문해 주세요.
"""

HELPER_PROMPT = """
당신은 손자와 할머니의 대화를 도와주는 도우미입니다.
손자가 설명한 내용 중 어르신이 이해하기 어려워한 단어나 표현이 있다면, 더 쉬운 말로 바꿔 다시 설명해주세요.
중요한 내용이 빠졌다면 간단히 덧붙이고, 너무 자세한 정보는 줄여주세요.
마지막으로, 손자의 말투와 어조를 유지하면서 어르신에게 전달할 최종 요약 문장을 한 문단으로 정리해 주세요.
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
            max_new_tokens=512,
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
def save_final_prompt(final_output, elapsed_time):
    result_path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "output": final_output,
        "infer_time": round(elapsed_time, 2)
    }
    with open(result_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


# 루프 
for embed_file in embedding_files:
    torch.cuda.empty_cache()
    if not embed_file.exists():
        print(f"❌ 임베딩 파일 없음: {embed_file.name}")
        continue

    image_inputs = torch.load(embed_file, weights_only=False)
    start_time = time.time()

    summary = query_qwen(image_inputs, EXPLAINER_PROMPT, "아래 문서를 어르신께 설명해 주세요.")
    grandma_reply = query_qwen(image_inputs, GRANDMA_PROMPT, f"손자가 이렇게 설명했어요: {summary}")
    helper_final = query_qwen(
        image_inputs,
        HELPER_PROMPT,
        f"설명자: {summary}\n\n할머니: {grandma_reply}\n\n위 대화를 바탕으로 최종 어르신 요약을 2~3문장으로 작성해 주세요."
    )

    elapsed_time = time.time() - start_time

    print(f"✅ 요약 완료 (⏱ {elapsed_time:.2f}s): {helper_final[:50]}...")
    save_final_prompt(helper_final, elapsed_time)
