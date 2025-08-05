import json
from pathlib import Path
import re
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API = os.getenv("OPENAI_API")

client = OpenAI(api_key=OPENAI_API)

# ====== Agent별 시스템 프롬프트 정의 ======
SYSTEM_PROMPTS = {
    "손자 준호": """
        당신은 요약 내용을 어르신에게 처음 설명하고, 질문에 답변하는 손자입니다.
        100점 만점 기준으로 평가해주세요. 
        평가 기준:
            - 핵심 설명력
            - 질문에 대한 재설명 정확성
            - 흐름 논리성
        출력 형식은 반드시 다음과 같이 해주세요:
            점수: (숫자만)
    """,
    "할머니 복례": """
        당신은 설명을 듣는 80세 어르신입니다. 설명이 얼마나 잘 이해되는지 평가해주세요.
        100점 만점 기준으로 평가해주세요. 
        기준:
            - 첫 설명 이해도
            - 질문 후 답변 이해도
            - 친숙한 말 사용
        출력 형식:
            점수: (숫자만)
    """,
    "도우미 수자": """
        당신은 대화를 듣고 언어와 태도, 배려, 정보 누락 여부를 평가하는 도우미입니다.
        100점 만점 기준으로 평가해주세요. 
        기준:
            - 정서적 적절성
            - 말투, 배려
            - 정보 누락 유무
        출력 형식:
            점수: (숫자만)
    """,
    "AI 평가관 수연": """
        당신은 전체 흐름과 문서 기반 정확성, 논리 연결성을 평가하는 AI 평가관입니다.
        100점 만점 기준으로 평가해주세요. 
        기준:
            - 요약→질문→답변 일관성
            - 정보 정확도
            - 불필요한 말 배제
        출력 형식:
            점수: (숫자만)
    """
}
# ====== Aggregator Prompt ======
AGGREGATOR_PROMPT = """
당신은 모든 평가자들의 의견과 점수를 보고 종합 판단하는 Aggregator 민재입니다.
모든 의견을 고려하여 다음 네 항목의 최종 점수를 도출하세요:

- 설명력
- 이해도
- 정서적 배려
- 논리 정확성

출력 형식은 반드시 아래와 같이 하세요:
설명력: (숫자)
이해도: (숫자)
정서적 배려: (숫자)
논리 정확성: (숫자)
"""
# ====== 평가자 평가 함수 ======
def get_agent_opinion(role: str, summary_text: str) -> tuple[int, str]:
    system_prompt = SYSTEM_PROMPTS[role]
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"요약 내용:\n{summary_text}"}
        ],
        temperature=0,
        max_tokens=512
    )
    content = response.choices[0].message.content
    score_match = re.search(r"점수[:：]?\s*(\d{1,3})", content)
    opinion_match = re.search(r"의견[:：]?\s*(.+)", content)
    score = int(score_match.group(1)) if score_match else -1
    opinion = opinion_match.group(1).strip() if opinion_match else "의견 없음"
    return score, opinion

# ====== Aggregator 최종 평가 함수 ======
def get_final_scores_from_aggregator(summary_text: str, agent_feedbacks: dict) -> dict:
    # 토론 프롬프트 구성
    debate_input = "요약 내용:\n" + summary_text + "\n\n"
    debate_input += "다음은 각 평가자의 점수와 의견입니다:\n"
    for name, (score, opinion) in agent_feedbacks.items():
        debate_input += f"- {name}: 점수 {score}, 의견: {opinion}\n"

    # Aggregator 호출
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": AGGREGATOR_PROMPT},
            {"role": "user", "content": debate_input}
        ],
        temperature=0,
        max_tokens=512
    )
    content = response.choices[0].message.content

    # 최종 점수 추출
    final_scores = {}
    for field in ["설명력", "이해도", "정서적 배려", "논리 정확성"]:
        match = re.search(fr"{field}[:：]?\s*(\d{{1,3}})", content)
        final_scores[field] = int(match.group(1)) if match else -1
    return final_scores

# ====== 경로 설정 ======
input_path = Path("./results_dom.jsonl")
output_path = Path("./results_dom_score_final.jsonl")

# ====== 전체 평가 및 저장 ======
with open(input_path, "r", encoding="utf-8") as infile, open(output_path, "w", encoding="utf-8") as outfile:
    for line in infile:
        data = json.loads(line)
        summary = data.get("output", "").strip()
        if not summary:
            continue

        agent_feedbacks = {}
        for agent in SYSTEM_PROMPTS:
            try:
                score, opinion = get_agent_opinion(agent, summary)
                agent_feedbacks[agent] = (score, opinion)
            except Exception as e:
                agent_feedbacks[agent] = (-1, f"오류: {str(e)}")

        # Aggregator가 최종 평가
        try:
            final_scores = get_final_scores_from_aggregator(summary, agent_feedbacks)
        except Exception as e:
            final_scores = {"설명력": -1, "이해도": -1, "정서적 배려": -1, "논리 정확성": -1, "오류": str(e)}

        outfile.write(json.dumps(final_scores, ensure_ascii=False) + "\n")

print("✅ Step 2: Aggregator 토론 기반 최종 점수 저장 완료 → results_dom_score_final.jsonl")