import sys
import time
import json
import torch
from pathlib import Path
from PIL import Image


from model_loader import get_model, get_processor

# ====== 경로 설정 ======
base_dir = Path(__file__).resolve().parent.parent
result_path = base_dir / "qwen" / "results_selected_prompts.jsonl"
image_dir = base_dir / "data" / "img"
image_files = sorted(image_dir.glob("*.jpg"))  # 또는 *.png 등

# ====== 저장 함수 ======
def save_result_jsonl(output, infer_time, path=result_path):
    record = {
        "output": output.strip(),
        "infer_time": round(infer_time, 2)
    }
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

# ====== 분류용 프롬프트 ======
DOC_TYPE_PROMPT = """
다음 문서가 어떤 유형인지 하나만 선택해서 출력하세요.
- 고지서
- 안내문-건강
- 안내문-생활
- 안내문-금융
- 기타

조건:
- 유형 이름만 정확히 출력하세요 (예: 고지서, 안내문-생활, 기타)
- 다른 설명은 출력하지 마세요
"""

# ====== 요약용 프롬프트 (유형별로 변수 따로) ======
A_PROMPT = """
다음 문서를 보고 어르신이 이해하기 쉬운 2~3문장으로 요약하세요.

단계:
    1. 문서를 읽고 1차 요약을 작성하세요.
    2. 아래 질문을 스스로에게 하며 검토하고, 수정이 필요하다면 보완하여 최종 요약을 작성하세요.

검토 질문:
    - 빠뜨린 중요한 항목(납부 총 금액, 날짜, 납부 마감일 등)은 없나요?
    - 이 고지서가 무슨 돈(세금·요금) 고지서인지 명확하게 알려주었나요? (예: 자동차세, 전기요금, 건강보험료 등)
    - 어르신이 듣기에 이해하기 어려운 표현은 없나요?
    - 금액과 마감일은 친숙한 단위와 말투로 표현되었나요?

출력 조건:
    - 최종 2~3문장 요약만 출력하세요.
    - 검토 과정이나 중간 요약은 출력하지 마세요.

"""

    
HEALTH_PROMPT = """
    다음 건강 안내문을 분석하여 어르신이 이해하기 쉬운 요약을 작성하세요.  
    예시, 자가 점검 질문, 핵심 요소를 참고하되,  
    중간 과정은 출력하지 말고, '쉬운 말 요약:' 한 줄만 출력하세요.

    예시:
        원문:
            "○ 8월 10일 오전 9시부터 무료 건강검진이 진행됩니다.
            ○ 장소: ○○보건소
            ○ 준비물: 신분증 지참"
        쉬운 말 요약:
            "어르신, 8월 10일 오전 9시에 ○○보건소에서 건강검진이 있어요. 신분증 꼭 챙기세요."

    질문:
        1. 날짜와 시간이 명확한가요?
        2. 장소와 준비물이 빠지지 않았나요?
        3. 어르신이 이해할 수 있는 말투로 표현되었나요?

    필수 요소:
        - 날짜와 시간
        - 장소
        - 대상자 또는 신청 조건
        - 준비물 (예: 신분증)
        - 주의사항 (있는 경우)

    단계:
        1단계: 위 항목을 표처럼 정리하고 요약 후보를 작성하세요.  
        2단계: 빠진 정보 보완 후 5문장 요약으로 압축하세요.  
        3단계: 문장 수를 줄이며 불필요한 표현은 제거하세요.  
        4단계: 핵심만 남겨 2~3문장으로 정리하세요.  
        5단계: 말투를 어르신께 친근하게 다듬으세요.

    출력 조건:
        - 반드시 '쉬운 말 요약:'으로 시작하는 2~3문장만 출력하세요.
        - 1~4 단계는 절대 출력하지 마세요.

    """

LIFE_PROMPT = """
    다음 생활 안내문을 요약할 때, 아래의 필수 정보가 포함되도록  
    스스로 점검하며 문장을 정리하고, 최종 요약은 2~3문장으로 압축하세요.

    반드시 포함할 정보:
        - 행사명 또는 목적
        - 날짜와 시간
        - 장소
        - 신청 방법 또는 연락처
        - 유의사항 또는 준비물

    스스로 점검하세요:
        - 일정, 장소, 신청 방법이 명확하게 전달되었나요?
        - 너무 딱딱하거나 어색한 표현은 없나요?
        - 어르신이 혼동 없이 이해할 수 있을까요?

    단계:
        1. 위 정보를 포함한 상세한 문장을 떠올려보세요.
        2. 중복되거나 불필요한 표현을 정리하고 문장을 압축하세요.
        3. 2~3문장으로 요약을 마무리하세요.

    출력 조건:
        - 최종 요약 2~3문장만 출력하세요.
        - 1~2 단계는 절대 출력하지 마세요.
    """

FINANCE_PROMPT = """
    다음 금융 안내문을 보고 어르신이 이해하기 쉬운 요약을 2~3문장으로 작성하세요.

    단계:
        1. 혜택, 금액, 조건, 신청방법, 기한 등 중요한 정보를 항목별로 나열하세요.
        2. 항목들을 간단한 문장으로 바꾸세요.
        3. 비슷한 정보는 합치고 불필요한 설명은 줄이세요.
        4. 어르신이 이해하기 쉬운 말로 2~3문장으로 마무리 요약하세요.

    출력 조건:
        - 최종 요약만 출력하세요 (2~3문장)
        - 중간 단계는 출력하지 마세요
    """
ELSE_PROMPT = """
    노인분들 대상으로 이 문서를 요약하세요.
    """


# ====== 모델 불러오기 ======
model = get_model().eval()
processor = get_processor()
print(f"✅ 모델 로드 완료 (디바이스: {model.device})")

# ====== 문서 유형 분류 함수 ======
def classify_document(image, model, processor):
    messages = [
        {"role": "user", "content": [
            {"type": "image", "image": image},
            {"type": "text", "text": DOC_TYPE_PROMPT}
        ]}
    ]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = processor(text=[text], images=[image], return_tensors="pt").to(model.device)

    with torch.no_grad():
        generated_ids = model.generate(**inputs, max_new_tokens=16)
        trimmed_ids = [out[len(inp):] for inp, out in zip(inputs.input_ids, generated_ids)]
        result = processor.batch_decode(trimmed_ids, skip_special_tokens=True)[0]
    return result.strip()

# ====== 메인 루프 ======
for img_path in image_files:
    image_id = img_path.stem
    try:
        image = Image.open(img_path).convert("RGB")
    except Exception as e:
        print(f"⚠️ 이미지 열기 실패: {img_path} - {e}")
        continue

    print(f"\n🖼️ [{image_id}] 이미지 처리 중...")

    # 1. 문서 유형 분류
    doc_type = classify_document(image, model, processor)
    print(f"🔍 문서 유형: {doc_type}")

    # 2. 프롬프트 선택 (변수로 직접 할당)
    if doc_type == "고지서":
        prompt_text = A_PROMPT
    elif doc_type == "안내문-건강":
        prompt_text = HEALTH_PROMPT
    elif doc_type == "안내문-생활":
        prompt_text = LIFE_PROMPT
    elif doc_type == "안내문-금융":
        prompt_text = FINANCE_PROMPT
    elif doc_type == "기타":
        prompt_text = ELSE_PROMPT
    else:
        print(f"⚠️ 알 수 없는 유형: {doc_type}")
        continue

    # 3. 요약용 메시지 구성
    messages = [
        {"role": "user", "content": [
            {"type": "image", "image": image},
            {"type": "text", "text": prompt_text}
        ]}
    ]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = processor(text=[text], images=[image], return_tensors="pt").to(model.device)

    # 4. 추론
    with torch.no_grad():
        start = time.time()
        generated_ids = model.generate(**inputs, max_new_tokens=512)
        end = time.time()

        trimmed_ids = [out[len(inp):] for inp, out in zip(inputs.input_ids, generated_ids)]
        output = processor.batch_decode(trimmed_ids, skip_special_tokens=True)[0]

    infer_time = end - start
    print(f"📝 [{image_id}] 요약 완료 ({infer_time:.2f}s)\n→ {output.strip()}")
    save_result_jsonl(output, infer_time)
