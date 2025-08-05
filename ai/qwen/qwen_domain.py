from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
from pathlib import Path
from datetime import datetime
import torch
import json
import time

# ====== 경로 설정 ======
base_dir = Path(__file__).resolve().parent.parent
result_path = base_dir / "qwen" / "results_dom.jsonl"
embedding_dir = base_dir / "qwen" / "cached_embeds"
selected_indices = [80, 82, 30, 41, 50, 13, 44, 53, 18, 19]
# embedding_files = [embedding_dir / f"img_{i:03d}.pt" for i in range(1, 101)]
embedding_files = [embedding_dir / f"img_{i:03d}.pt" for i in selected_indices]

# ====== 저장 함수 ======
def save_result_jsonl(output, infer_time, path=result_path):
    record = {
        "output": output.strip(),
        "infer_time": round(infer_time, 2)
    }
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

# ====== 분류 프롬프트 ======
DOC_TYPE_PROMPT = """
다음 문서가 어떤 유형인지 하나만 선택해서 출력하세요.
- 고지서
- 안내문-건강
- 안내문-생활
- 안내문-금융

조건:
- 유형 이름만 정확히 출력하세요 (예: 고지서, 안내문-생활)
- 다른 설명은 출력하지 마세요
"""

# ====== 문서 분류 함수 ======
def classify_document(image_inputs, model, processor):
    messages = [
        {"role": "user", "content": [
            {"type": "image", "image": "<cached>"},
            {"type": "text", "text": DOC_TYPE_PROMPT}
        ]}
    ]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = processor(text=[text], images=image_inputs, return_tensors="pt").to(model.device)

    with torch.no_grad():
        generated_ids = model.generate(**inputs, max_new_tokens=16)
        trimmed_ids = [out[len(inp):] for inp, out in zip(inputs.input_ids, generated_ids)]
        result = processor.batch_decode(trimmed_ids, skip_special_tokens=True)[0]
    return result.strip()

# ====== 유형별 프롬프트 ======
A_PROMPT = """
다음 문서는 관리비, 공과금 등 납부 관련 고지서입니다.  
당신의 역할은 문서의 핵심 항목을 파악하고 어르신이 이해하기 쉬운 방식으로 요약하는 것입니다.

문서에서 자주 등장하는 항목은 다음과 같습니다:
- 전기료, 수도료, 관리비, 총 납부액, 납부 마감일, 연체 시 금액

출력 조건:
    - 1~2단계(핵심 금액 정리 및 요약 후보)는 내부적으로만 처리하고 출력하지 마세요.
    - 최종적으로 3단계의 어르신용 쉬운 말 요약 한 줄만 출력하세요.
    - 쉬운 말 요약은 금액, 마감일, 주의사항 등을 포함하여 부드럽고 친근한 말투로 2~3문장 이내로 작성하세요.
    - 출력은 접두어나 설명 없이 요약 문장만 출력하세요 (예: "어르신, ...").
예시:
    "어르신, 이번 달 관리비는 11만 7천 430원이에요. 5월 28일까지 내시면 돼요."


"""

    
HEALTH_PROMPT = """
    다음 문서는 건강검진, 예방접종 등 어르신 건강과 관련된 안내문입니다.  
    당신의 역할은 중요한 일시·장소·대상자 정보를 파악해 어르신이 이해하기 쉽게 요약하는 것입니다.

    문서에서 자주 등장하는 항목은 다음과 같습니다:
    - 날짜와 시간, 장소, 신분증, 건강검진, 대상자, 주의사항

    출력 조건:
        - 1~2단계(핵심 정보 표와 중간 요약)는 내부적으로만 처리하고 출력하지 마세요.
        - 최종적으로 3단계의 어르신용 쉬운 말 요약 한 줄만 출력하세요.
        - 쉬운 말 요약은 반드시 날짜·장소·필요 준비물을 포함하고, 어르신 말투로 2~3문장으로 간결하게 작성하세요.
        - 출력은 접두어나 설명 없이 요약 문장만 출력하세요 (예: "어르신, ...").
    예시:
        "어르신, 9월 10일 오전 9시에 ○○보건소에서 건강검진이 있어요. 신분증 꼭 챙기세요."
    """

LIFE_PROMPT = """
    다음 문서는 주민센터나 복지시설에서 제공하는 생활 안내문입니다.  
    당신의 역할은 행사나 일정 정보를 정리하고 어르신이 이해할 수 있게 요약하는 것입니다.

    문서에서 자주 등장하는 항목은 다음과 같습니다:
    - 행사명, 날짜, 시간, 장소, 신청 방법, 준비물, 유의사항

    출력 조건:
        - 1~2단계(행사 요약 및 핵심 정보 정리)는 내부적으로만 처리하고 출력하지 마세요.
        - 최종적으로 3단계의 어르신용 쉬운 말 요약 한 줄만 출력하세요.
        - 쉬운 말 요약은 어르신이 이해하기 쉬운 말투로 2~3문장 이내로 작성하세요.
        - 출력은 접두어나 설명 없이 요약 문장만 출력하세요 (예: "어르신, ...").

    예시:
        "어르신, 8월 15일 오후 2시에 주민센터에서 냉방기 점검이 있어요. 1234-5678로 신청하세요."
    """

FINANCE_PROMPT = """
    다음 문서는 세금, 연금, 금융 혜택 등 어르신과 관련된 금융 안내문입니다.  
    당신의 역할은 혜택, 조건, 신청 방법 등을 정리해 어르신이 이해하기 쉽게 요약하는 것입니다.

    문서에서 자주 등장하는 항목은 다음과 같습니다:
    - 세금 납부, 연금, 혜택, 신청 자격, 금액, 기한, 신청 수단(홈택스 등)

    출력 조건:
        - 1~2단계(핵심 정보 정리 및 후보 요약)은 내부적으로만 처리하고 출력하지 마세요.
        - 최종적으로 3단계의 어르신용 쉬운 말 요약 한 줄만 출력하세요.
        - 쉬운 말 요약은 혜택과 신청 방법, 조건을 담고 2~3문장 이내로 자연스럽게 작성하세요.
        - 출력은 접두어나 설명 없이 요약 문장만 출력하세요 (예: "어르신, ...").

    예시:
        "어르신, 세금 납부기한을 세금포인트로 연장할 수 있어요. 홈택스에서 간단히 신청하면 돼요."

    """
   
# ====== 모델 로드 ======
model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
    "Qwen/Qwen2.5-VL-7B-Instruct",
    torch_dtype=torch.float16,
    device_map="auto"
)
model.eval()
processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-VL-7B-Instruct")
print(f"모델 디바이스: {model.device if hasattr(model, 'device') else '멀티 디바이스'}")

# ====== 메인 루프 ======
for embed_file in embedding_files:
    if not embed_file.exists():
        print(f"⚠️ 임베딩 파일 없음: {embed_file}")
        continue

    image_inputs = torch.load(embed_file, weights_only=False)
    image_id = embed_file.stem

    doc_label = classify_document(image_inputs, model, processor)
    print(f"[{image_id}] 문서 유형 분류: {doc_label}")

    if doc_label == "고지서":
        prompt_text = A_PROMPT
    elif doc_label == "안내문-건강":
        prompt_text = HEALTH_PROMPT
    elif doc_label == "안내문-생활":
        prompt_text = LIFE_PROMPT
    elif doc_label == "안내문-금융":
        prompt_text = FINANCE_PROMPT
    else:
        print(f"⚠️ 알 수 없는 유형: {doc_label}")
        continue

    messages = [
        {"role": "user", "content": [
            {"type": "image", "image": "<cached>"},
            {"type": "text", "text": prompt_text}
        ]}
    ]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = processor(text=[text], images=image_inputs, return_tensors="pt").to(model.device)

    with torch.no_grad():
        infer_start = time.time()
        generated_ids = model.generate(**inputs, max_new_tokens=512)
        infer_end = time.time()
        trimmed_ids = [out[len(inp):] for inp, out in zip(inputs.input_ids, generated_ids)]
        output_text = processor.batch_decode(trimmed_ids, skip_special_tokens=True)[0]

    infer_time = infer_end - infer_start
    print(f"[{image_id}] 추론 완료 ({infer_time:.2f}초)")
    save_result_jsonl(output_text, infer_time)
