import json
import pandas as pd
import math

# ====== 파일 경로 설정 ======
input_path = "results_time_infer_only"  # JSONL 파일 경로

# ====== JSONL 파일 읽고 infer_time만 추출 ======
with open(input_path, "r", encoding="utf-8") as f:
    records = [json.loads(line) for line in f]

# infer_time 리스트 추출
infer_times = [record.get("infer_time") for record in records if "infer_time" in record]

chunk_size = 10
num_chunks = math.ceil(len(infer_times) / chunk_size)

# ====== 10개씩 분할 저장 ======
for i in range(num_chunks):
    start = i * chunk_size
    end = start + chunk_size
    chunk = infer_times[start:end]

    df = pd.DataFrame({"infer_time": chunk})
    output_path = f"infer_time_part_{i+1}.xlsx"
    df.to_excel(output_path, index=False)

    print(f"✅ 저장 완료: {output_path}")
