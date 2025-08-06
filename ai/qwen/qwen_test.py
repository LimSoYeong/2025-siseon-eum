# /root/2025-siseon-eum/ai/qwen/qwen_test.py

import sys
from pathlib import Path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from qwen_vl_utils import process_vision_info
from PIL import Image
from datetime import datetime
import json
from pathlib import Path
import torch
import time

# ✅ 모델과 프로세서는 이곳에서 import
from model_loader import get_model, get_processor

total_time = 0 # 시간 계산용
base_dir = Path(__file__).resolve().parent.parent # 현재 파일 기준으로 경로 설정 : KSEB/ai
result_path = base_dir / "qwen" / "results.jsonl"
embedding_dir = base_dir / "qwen" / "cached_embeds" # 캐시된 임베딩 경로 (사용 안 할 땐 None)
embedding_files = [embedding_dir / f"img_{i:03d}.pt" for i in range(1, 11)]  # img_001 ~ img_010

# ====== 설정 ======
# 1️⃣ 이미지 경로 (사용 안 할 땐 None)
# image_path = base_dir / "data" / "img" / "img_001.jpg"
image_path = None

prompt_list = [
    """다음 문서(관리비 청구서, 안내문, 복지센터 소식 등)가 제공됩니다. 당신의 역할은 문서에서 핵심 정보를 분석하고 어르신이 이해하기 쉽게 요약하는 것입니다.
    문서 내 항목 중 자주 등장하는 용어는 다음과 같습니다:
    - ELEC(전기료), WATER(수도료), MGMT(관리비), DUE(납부 마감일), AMT(총 납부액), EVENT(행사), WARN(주의사항)

    출력은 다음과 같이 구성하십시오:
    1. 핵심 정보 표 (항목, 금액, 날짜 등)
    2. 2~3문장 핵심 요약
    3. 쉬운 말 요약 (어르신 톤 예시: "어르신, 이번 달 관리비는 11만 7천 430원이에요. 5월 28일까지 내시면 돼요.")

    알려지기 전까지는 이 사양에 따라 작업을 계속 수행하세요."""
]

# ====== 모델 로드 ======
model = get_model().eval() # 평가 모드 전환 : 추론시에 일관성 유지하기 위함
processor = get_processor()

print(f"모델 디바이스: {model.device if hasattr(model, 'device') else '멀티 디바이스'}")


# ====== JSONL 저장 함수 ======
def save_result_jsonl(image_id, prompt, output, path=result_path):
    record = {
        "image_id": image_id,
        "prompt": prompt,
        "output": output,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

# ====== 루프 실행 ======
for embed_file in embedding_files:
    if not embed_file.exists():
        print(f"⚠️ 임베딩 파일 없음: {embed_file}")
        continue

    # 캐시된 임베딩 불러오기
    image_inputs = torch.load(embed_file, weights_only=False)
    video_inputs = None
    image_id = embed_file.stem  # 예: img_001

    for prompt_text in prompt_list:
        messages = [
            {"role": "user", "content": [
                {"type": "image", "image": "<cached>"},
                {"type": "text", "text": prompt_text}
            ]}
        ]
        text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = processor(
            text=[text],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt",
        )
        inputs = inputs.to(model.device)

        # ====== 추론 ======
        with torch.no_grad(): # no_grad : 추론시에만 사용. gradient를 계산하지 않는다는 뜻
            infer_start = time.time() # 추론 시간 측정
            generated_ids = model.generate(
                **inputs,
                max_new_tokens=1024, # 혹은 128
                do_sample=False # 샘플링을 하지 않고, greedy 방식으로 출력 생성
            )
            infer_end = time.time() # 추론 시간 측정 종료
            generated_ids_trimmed = [
                out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
            ]
            output_text = processor.batch_decode(
                generated_ids_trimmed,
                skip_special_tokens=True,
                clean_up_tokenization_spaces=False
            )[0]

        # ====== 결과 출력 & 저장 ======
        print(f"[{image_id}] '{prompt_text}' → {infer_end - infer_start:.2f}초")
        save_result_jsonl(image_id, prompt_text, output_text)