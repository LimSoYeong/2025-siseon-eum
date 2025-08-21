import json
from pathlib import Path
import time
import os
import re
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
OPENAI_API = os.getenv("OPENAI_API")
client = OpenAI(api_key="OPENAI_API")

MODEL_NAME = "gpt-4o"  # 비용 줄이려면 "gpt-4o-mini"로 교체
def force_int_0_100(x):
    try:
        n = int(float(x))
    except Exception:
        return -1
    return max(0, min(100, n))

# ====== Agent별 시스템 프롬프트 (JSON 강제) ======
BASE_AGENT_SUFFIX = """
출력 형식은 반드시 아래 JSON 한 줄만 출력하세요. 다른 말/라벨/코드블록 금지.
{"score": <0~100 정수>, "comment": "<15자 이내 한국어 코멘트>"}
"""

SYSTEM_PROMPTS = {
    "손자 준호": """
당신은 요약 내용을 어르신에게 처음 설명하고, 질문에 답변하는 손자입니다.
100점 만점 기준으로 평가하세요.
평가 기준:
- 핵심 설명력
- 질문에 대한 재설명 정확성
- 흐름 논리성
""" + BASE_AGENT_SUFFIX,
    "할머니 복례": """
당신은 설명을 듣는 80세 어르신입니다. 설명이 얼마나 잘 이해되는지 평가하세요.
평가 기준:
- 첫 설명 이해도
- 질문 후 답변 이해도
- 친숙한 말 사용
""" + BASE_AGENT_SUFFIX,
    "도우미 수자": """
당신은 대화를 듣고 언어와 태도, 배려, 정보 누락 여부를 평가하는 도우미입니다.
평가 기준:
- 정서적 적절성
- 말투, 배려
- 정보 누락 유무
""" + BASE_AGENT_SUFFIX,
    "AI 평가관 수연": """
당신은 전체 흐름과 문서 기반 정확성, 논리 연결성을 평가하는 AI 평가관입니다.
평가 기준:
- 요약→질문→답변 일관성
- 정보 정확도
- 불필요한 말 배제
""" + BASE_AGENT_SUFFIX,
}

AGGREGATOR_PROMPT = """
당신은 모든 평가자들의 점수와 코멘트를 보고 종합 판단하는 Aggregator 민재입니다.
모든 의견을 고려하여 다음 네 항목의 최종 점수를 0~100 정수로 도출하고, 한 줄 코멘트를 덧붙이세요.
항목:
- 설명력
- 이해도
- 정서적 배려
- 논리 정확성

출력 형식은 반드시 아래 JSON 한 줄만 출력하세요. 다른 말/라벨/코드블록 금지.
{"설명력": <int>, "이해도": <int>, "정서적 배려": <int>, "논리 정확성": <int>, "comment": "<20자 이내 요약코멘트>"}
"""

def call_with_retry(fn, *args, **kwargs):
    """간단 백오프 재시도"""
    delay = 1.0
    for attempt in range(5):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            if attempt == 4:
                raise
            time.sleep(delay)
            delay *= 2

def chat_json(system_prompt: str, user_prompt: str, max_tokens: int = 64, temperature: float = 0):
    resp = call_with_retry(
        client.chat.completions.create,
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    content = resp.choices[0].message.content.strip()
    # 일부 모델이 코드펜스 붙이는 경우 제거
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content, flags=re.DOTALL).strip()
    try:
        return json.loads(content)
    except Exception:
        # 혹시 숫자만 왔을 때 대비(에이전트가 옛 포맷으로 응답)
        m = re.search(r"(\d{1,3})", content)
        if m:
            return {"score": force_int_0_100(m.group(1)), "comment": ""}
        # 완전 실패
        return None

def get_agent_opinion(role: str, summary_text: str) -> tuple[int, str]:
    payload = chat_json(
        SYSTEM_PROMPTS[role],
        f"요약 내용:\n{summary_text}",
        max_tokens=64,
        temperature=0
    )
    if not payload or "score" not in payload:
        return -1, "파싱실패"
    score = force_int_0_100(payload.get("score", -1))
    comment = (payload.get("comment") or "").strip()
    return score, comment

def get_final_scores_from_aggregator(summary_text: str, agent_feedbacks: dict) -> dict:
    debate = {
        "summary": summary_text,
        "agents": [
            {"name": name, "score": s, "comment": c}
            for name, (s, c) in agent_feedbacks.items()
        ]
    }
    payload = chat_json(
        AGGREGATOR_PROMPT,
        json.dumps(debate, ensure_ascii=False),
        max_tokens=96,
        temperature=0
    )
    if not payload:
        return {"설명력": -1, "이해도": -1, "정서적 배려": -1, "논리 정확성": -1, "comment": "파싱실패"}
    # 클램프
    for k in ["설명력", "이해도", "정서적 배려", "논리 정확성"]:
        payload[k] = force_int_0_100(payload.get(k, -1))
    payload["comment"] = (payload.get("comment") or "").strip()
    return payload

# ====== 경로 ======
input_path = Path("./results_final.jsonl")
output_path = Path("./results_dom_score_final.jsonl")

# ====== 실행 ======
idx = 0
with open(input_path, "r", encoding="utf-8") as infile, open(output_path, "w", encoding="utf-8") as outfile:
    for line in infile:
        if not line.strip():
            continue  # 빈 줄 스킵 (721줄 문제 방지)
        try:
            data = json.loads(line)
        except Exception:
            # 깨진 라인 방지
            continue
        summary = (data.get("output") or "").strip()
        if not summary:
            continue

        agent_feedbacks = {}
        for agent in SYSTEM_PROMPTS:
            try:
                s, c = get_agent_opinion(agent, summary)
            except Exception as e:
                s, c = -1, f"오류:{type(e).__name__}"
            agent_feedbacks[agent] = (s, c)

        try:
            final_scores = get_final_scores_from_aggregator(summary, agent_feedbacks)
        except Exception as e:
            final_scores = {"설명력": -1, "이해도": -1, "정서적 배려": -1, "논리 정확성": -1, "comment": f"오류:{type(e).__name__}"}

        record = {
            "idx": idx,
            "final": final_scores,
            "agents": {k: {"score": v[0], "comment": v[1]} for k, v in agent_feedbacks.items()}
        }
        outfile.write(json.dumps(record, ensure_ascii=False) + "\n")
        idx += 1

print("✅ Step 2 완료: Aggregator 최종 점수(+에이전트 상세) → results_dom_score_final.jsonl")
