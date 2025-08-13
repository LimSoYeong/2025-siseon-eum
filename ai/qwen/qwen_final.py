import time, json, gc
from pathlib import Path
from PIL import Image
import torch

from model_loader import get_model, get_processor

# ===== 경로/파일 =====
base_dir = Path(__file__).resolve().parent.parent
out_path = base_dir / "qwen" / "results_hybrid_flash_cls_sdpa_sum.jsonl"
image_dir = base_dir / "data" / "img"
image_files = sorted(list(image_dir.glob("*.jpg")) + list(image_dir.glob("*.png")))

# ===== 저장 =====
def save_jsonl(record, path=out_path):
    path.parent.mkdir(parents=True, exist_ok=True)
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


PROMPT_MAP = {
    "고지서": A_PROMPT,
    "안내문-건강": HEALTH_PROMPT,
    "안내문-생활": LIFE_PROMPT,
    "안내문-금융": FINANCE_PROMPT,
    "기타": ELSE_PROMPT,
}


MAX_NEW_TOKENS = 256
WARMUP = 1

# ===== 공통 유틸 =====
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
        torch.cuda.synchronize()
        t0 = time.perf_counter()
        out_ids = model.generate(**inputs, max_new_tokens=16)
        torch.cuda.synchronize()
        t1 = time.perf_counter()
    trimmed = [o[len(i):] for i, o in zip(inputs.input_ids, out_ids)]
    result = processor.batch_decode(trimmed, skip_special_tokens=True)[0].strip()
    return result, (t1 - t0)

def summarize_document(image, prompt_text, model, processor):
    messages = [
        {"role": "user", "content": [
            {"type": "image", "image": image},
            {"type": "text", "text": prompt_text}
        ]}
    ]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = processor(text=[text], images=[image], return_tensors="pt").to(model.device)
    with torch.no_grad():
        torch.cuda.synchronize()
        t0 = time.perf_counter()
        out_ids = model.generate(**inputs, max_new_tokens=MAX_NEW_TOKENS)
        torch.cuda.synchronize()
        t1 = time.perf_counter()
    trimmed = [o[len(i):] for i, o in zip(inputs.input_ids, out_ids)]
    output = processor.batch_decode(trimmed, skip_special_tokens=True)[0].strip()
    return output, (t1 - t0)

def clear_model_cache():
    get_model.cache_clear()
    gc.collect()
    torch.cuda.empty_cache()
    torch.cuda.synchronize()

# ===== 실행 =====
if __name__ == "__main__":
    if not image_files:
        raise SystemExit("이미지 폴더가 비어있어요: data/img/*.jpg|*.png")

    # ---------- 1) Flash ON으로 '분류'만 전체 처리 ----------
    clear_model_cache()
    try:
        model_cls = get_model(attn_impl="flash_attention_2").eval()
    except Exception as e:
        print(f"⚠️ FlashAttention 분류 모델 로드 실패: {e}\n→ sdpa로 대체합니다.")
        model_cls = get_model(attn_impl="sdpa").eval()
    processor = get_processor()
    print(f"\n=== [분류: Flash ON 우선] device={model_cls.device} ===")

    # 분류 결과 저장: {image_name: (doc_type, classify_s)}
    classifications = {}

    # 워밍업
    if image_files and WARMUP > 0:
        img0 = Image.open(image_files[0]).convert("RGB")
        _ = classify_document(img0, model_cls, processor)

    for img_path in image_files:
        try:
            image = Image.open(img_path).convert("RGB")
        except Exception as e:
            print(f"이미지 열기 실패: {img_path} - {e}")
            continue
        doc_type, t_cls = classify_document(image, model_cls, processor)
        classifications[img_path] = (doc_type, round(t_cls, 4))
        print(f"[CLS] {img_path.name}: {doc_type} ({t_cls:.3f}s)")

    # ---------- 2) Flash OFF(SDPA)로 '요약'만 전체 처리 ----------
    clear_model_cache()
    model_sum = get_model(attn_impl="sdpa").eval()
    # processor는 동일
    print(f"\n=== [요약: Flash OFF(sdpa)] device={model_sum.device} ===")

    # 워밍업
    if image_files and WARMUP > 0:
        img0 = Image.open(image_files[0]).convert("RGB")
        _ = summarize_document(img0, ELSE_PROMPT, model_sum, processor)

    for img_path in image_files:
        if img_path not in classifications:
            continue
        doc_type, cls_s = classifications[img_path]
        try:
            image = Image.open(img_path).convert("RGB")
        except Exception as e:
            print(f"이미지 열기 실패: {img_path} - {e}")
            continue

        prompt_text = PROMPT_MAP.get(doc_type, ELSE_PROMPT)
        output, sum_s = summarize_document(image, prompt_text, model_sum, processor)

        record = {
            "mode": "Hybrid(FlashON-CLS,SDPA-SUM)",
            "image": img_path.name,
            "doc_type": doc_type,
            "output": output,
            "classify_s": cls_s,
            "summary_s": round(sum_s, 4),
            "total_s": round(cls_s + sum_s, 4),
            "attn_impl_cls": "flash_attention_2",
            "attn_impl_sum": "sdpa",
            "max_new_tokens": MAX_NEW_TOKENS,
        }
        save_jsonl(record)
        print(f"[SUM] {img_path.name}: total {record['total_s']}s | 요약: {output[:80]}...")

    print(f"\n✅ 완료. 결과: {out_path}")