import pandas as pd
import json

# JSONL 파일 경로 (실제 파일 경로로 수정)
jsonl_path = "results_final_FlashAttention.jsonl"

# infer_time 값 추출
infer_times = []
with open(jsonl_path, "r", encoding="utf-8") as f:
    for line in f:
        try:
            data = json.loads(line)
            if "infer_time" in data:
                infer_times.append(data["infer_time"])
        except json.JSONDecodeError:
            continue

# DataFrame 변환
df = pd.DataFrame(infer_times, columns=["infer_time"])

# 엑셀로 저장
excel_path = "comp_infer_times_Flash.xlsx"
df.to_excel(excel_path, index=False)

print(f"✅ 추출 완료: {excel_path}")