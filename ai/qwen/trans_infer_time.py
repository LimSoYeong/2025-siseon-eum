import json
import pandas as pd
from json import JSONDecoder, JSONDecodeError

# ====== 경로 ======
input_path = "results_final.jsonl"
output_path = "infer_time_results.xlsx"

# ====== JSON 안전 파싱 함수 ======
def extract_json_objects(text: str):
    decoder = JSONDecoder()
    idx, n = 0, len(text)
    while idx < n:
        start_idx = text.find("{", idx)
        if start_idx == -1:
            break
        try:
            obj, end_idx = decoder.raw_decode(text, start_idx)
            yield obj
            idx = end_idx
        except JSONDecodeError:
            idx = start_idx + 1

# ====== 파일 전체 읽어서 infer_time 추출 ======
with open(input_path, "r", encoding="utf-8") as f:
    content = f.read()

records = list(extract_json_objects(content))
infer_times = [r.get("infer_time") for r in records if isinstance(r.get("infer_time"), (int, float))]

# ====== 10개씩 끊어 열로 배치 ======
cols = [infer_times[i:i+10] for i in range(0, len(infer_times), 10)]
df = pd.DataFrame(cols).T  # 전치해서 10행 × N열

# ====== 저장 ======
df.to_excel(output_path, index=False, header=False)
print(f"✅ 저장 완료: {output_path} ({df.shape[0]}행 × {df.shape[1]}열)")
