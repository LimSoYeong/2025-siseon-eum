# -*- coding: utf-8 -*-
"""
fill_ocr_and_generate_dpo_v2.py

기능:
  - metadata.csv, sft.jsonl, dpo_pairs.jsonl, ocr_texts.csv를 읽어
    SFT/DPO 학습용 완성본(sft_filled.jsonl, dpo_pairs_filled.jsonl)을 생성.
  - (옵션) --auto_pairs 켜면 도메인별 규칙기반으로 chosen/rejected 자동 생성.

입력 파일(동일 폴더에 존재 권장):
  - metadata.csv              (filename, doc_category_hint 등)
  - sft.jsonl                 (instruction/input/output/domain)
  - dpo_pairs.jsonl           (prompt/chosen/rejected/domain)
  - ocr_texts.csv             (filename, ocr_text)

출력 파일:
  - sft_filled.jsonl
  - dpo_pairs_filled.jsonl

실행 예:
  python fill_ocr_and_generate_dpo_v2.py
  python fill_ocr_and_generate_dpo_v2.py --auto_pairs
  python fill_ocr_and_generate_dpo_v2.py --ocr_csv ../data/ocr_texts.csv
"""

import argparse
import csv
import json
import os
import re
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

# ------------------------------------------------------------
# 경로/옵션
# ------------------------------------------------------------

DEF_META = "metadata.csv"
DEF_SFT  = "sft.jsonl"
DEF_DPO  = "dpo_pairs.jsonl"
DEF_OCR  = "ocr_texts.csv"

OUT_SFT  = "sft_filled.jsonl"
OUT_DPO  = "dpo_pairs_filled.jsonl"

def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--meta", type=str, default=DEF_META)
    ap.add_argument("--sft", type=str, default=DEF_SFT)
    ap.add_argument("--dpo", type=str, default=DEF_DPO)
    ap.add_argument("--ocr_csv", type=str, default=DEF_OCR)
    ap.add_argument("--auto_pairs", action="store_true",
                    help="DPO chosen/rejected를 규칙기반으로 자동 생성(없을 때만)")
    ap.add_argument("--overwrite", action="store_true",
                    help="출력 파일이 있어도 덮어쓰기")
    return ap.parse_args()

# ------------------------------------------------------------
# 유틸: JSONL/CSV 로딩, filename 추출/정규화
# ------------------------------------------------------------

_num_re = re.compile(r"(\d+)")
def idx_from_name(path_or_name: str) -> Optional[int]:
    m = _num_re.findall(os.path.basename(path_or_name or ""))
    return int(m[-1]) if m else None

def read_jsonl(path: Path) -> List[Dict[str, Any]]:
    rows = []
    if not path.exists():
        return rows
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if isinstance(obj, dict):
                    rows.append(obj)
            except Exception:
                # 잘못된 라인 스킵
                pass
    return rows

def write_jsonl(path: Path, rows: List[Dict[str, Any]]):
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

def load_metadata(meta_path: Path) -> Dict[str, Dict[str, Any]]:
    """
    metadata.csv를 filename 기준으로 dict로 반환.
    """
    meta = {}
    if not meta_path.exists():
        return meta
    with meta_path.open(encoding="utf-8") as f:
        rd = csv.DictReader(f)
        for r in rd:
            fn = r.get("filename", "").strip()
            if fn:
                meta[fn] = r
    return meta

def load_ocr_map(ocr_csv: Path) -> Dict[str, str]:
    """
    ocr_texts.csv를 filename -> text 매핑으로 로드.
    filename은 basename 기준/하위경로 포함 둘 다를 허용(번호로도 매칭).
    """
    ocr_rows = []
    with ocr_csv.open(encoding="utf-8", newline="") as f:
        rd = csv.DictReader(f)
        for r in rd:
            # stray column 제거
            if None in r:
                r.pop(None, None)
            ocr_rows.append({"filename": r.get("filename","").strip(),
                             "ocr_text": (r.get("ocr_text","") or "").strip()})
    # 우선순위: 완전 일치 > 번호 일치 중 가장 긴 텍스트
    exact = {}
    by_num: Dict[int, Tuple[str,str]] = {}
    for r in ocr_rows:
        fn = r["filename"]
        txt = r["ocr_text"]
        if fn:
            exact[fn] = txt
        n = idx_from_name(fn)
        if n:
            prev = by_num.get(n)
            if (prev is None) or (len(txt) > len(prev[1])):
                by_num[n] = (fn, txt)
    return {"__EXACT__": exact, "__BYNUM__": {k:v[1] for k,v in by_num.items()}}

def get_filename_from_text(txt: str) -> Optional[str]:
    # (source_image=...) 꼬리표
    m = re.search(r"source_image=([^)]+)\)", txt or "")
    if m:
        return m.group(1)
    # img_###.ext 패턴
    m = re.search(r"([A-Za-z0-9_\-\/.]*img[_-]?\d+\.(?:png|jpg|jpeg))", txt or "", re.IGNORECASE)
    if m:
        return os.path.basename(m.group(1))
    return None

# ------------------------------------------------------------
# 숫자/날짜/시간 표기 헬퍼 (읽기 친화)
# ------------------------------------------------------------

def kr_digit_group_readable(n: int) -> str:
    """
    117430 -> "11만 7천 430"
    억(1e8), 만(1e4) 단위까지 단순화.
    """
    if n < 0:
        return "마이너스 " + kr_digit_group_readable(-n)
    units = [("억", 100_000_000), ("만", 10_000)]
    rem = n
    parts = []
    for label, base in units:
        q, rem = divmod(rem, base)
        if q:
            parts.append(f"{q}{label}")
    # 남은 rem은 천/백/십 단위 간단 표기
    if rem >= 1000:
        q, rem = divmod(rem, 1000)
        parts.append(f"{q}천")
    if rem:
        parts.append(f"{rem}")
    return " ".join(parts) if parts else "0"

_money_re = re.compile(r"(?P<num>\d{1,3}(?:,\d{3})+|\d+)\s*원")

def to_readable_money(expr: str) -> str:
    """
    "117,430원" -> "11만 7천 430원"
    """
    def _rep(m):
        num = m.group("num").replace(",", "")
        try:
            val = int(num)
        except:
            return m.group(0)
        return f"{kr_digit_group_readable(val)}원"
    return _money_re.sub(_rep, expr)

_time_re = re.compile(r"\b(?P<h>\d{1,2}):(?P<m>\d{2})\b")
def to_readable_time(s: str) -> str:
    """
    09:30 -> 오전 9시 30분 / 13:05 -> 오후 1시 5분
    """
    def _rep(m):
        h = int(m.group("h")); mnt = int(m.group("m"))
        ap = "오전" if h < 12 else "오후"
        h12 = h if 1 <= h <= 12 else (h-12 if h>12 else 12)
        if mnt == 0:
            return f"{ap} {h12}시"
        return f"{ap} {h12}시 {mnt}분"
    return _time_re.sub(_rep, s)

_date1 = re.compile(r"(?P<y>20\d{2})[./-]\s*(?P<m>\d{1,2})[./-]\s*(?P<d>\d{1,2})")
_date2 = re.compile(r"(?P<m>\d{1,2})\s*월\s*(?P<d>\d{1,2})\s*일")
def to_readable_date(s: str) -> str:
    s = _date1.sub(lambda m: f"{int(m.group('m'))}월 {int(m.group('d'))}일", s)
    s = _date2.sub(lambda m: f"{int(m.group('m'))}월 {int(m.group('d'))}일", s)
    return s

def normalize_read_friendly(s: str) -> str:
    s = to_readable_money(s)
    s = to_readable_time(s)
    s = to_readable_date(s)
    return s

# ------------------------------------------------------------
# 간단 규칙 기반 정보 추출(최소 구현)
# ------------------------------------------------------------

def find_first_money(text: str, keywords: Tuple[str,...]=()) -> Optional[str]:
    # 키워드가 주어지면 해당 라인 근처 우선
    if keywords:
        for line in text.splitlines():
            if any(k in line for k in keywords):
                m = _money_re.search(line)
                if m: return m.group(0)
    m = _money_re.search(text)
    return m.group(0) if m else None

def find_date_like(text: str, keywords: Tuple[str,...]=()) -> Optional[str]:
    cand = None
    for line in text.splitlines():
        if keywords and not any(k in line for k in keywords):
            continue
        s = to_readable_date(line)
        if re.search(r"\b월\s*\d{1,2}\s*일\b", s):
            cand = re.search(r"\d{1,2}\s*월\s*\d{1,2}\s*일", s)
            if cand:
                return cand.group(0)
    # 전체에서 검색
    s = to_readable_date(text)
    m = re.search(r"\d{1,2}\s*월\s*\d{1,2}\s*일", s)
    return m.group(0) if m else None

_phone = re.compile(r"\b\d{2,3}-\d{3,4}-\d{4}\b")
def find_phone(text: str) -> Optional[str]:
    m = _phone.search(text)
    return m.group(0) if m else None

def guess_subject(text: str, domain: str) -> str:
    if domain == "고지서":
        for k in ["자동차세","재산세","전기요금","수도요금","건강보험료","등록금","관리비"]:
            if k in text: return k
        return "고지서"
    if domain == "안내문-건강":
        for k in ["건강검진","독감","예방접종","검진","안과","치과","보건소","무료"]:
            if k in text: return "건강 안내"
        return "건강 안내"
    if domain == "안내문-생활":
        for k in ["교실","모집","행사","체험","강좌","지원","집수리","물품"]:
            if k in text: return "생활 안내"
        return "생활 안내"
    if domain == "안내문-금융":
        for k in ["대출","적금","지원금","혜택","신고","해외금융계좌","금리","한도","과태료"]:
            if k in text: return "금융 안내"
        return "금융 안내"
    return "안내"

# ------------------------------------------------------------
# 요약 생성기(선택 기능: --auto_pairs)
# ------------------------------------------------------------

def build_chosen_summary(text: str, domain: str) -> str:
    """
    2~3문장, '어르신,' 시작, 숫자/시간/날짜 읽기 친화.
    """
    subj = guess_subject(text, domain)
    # 핵심 추출
    money_main = find_first_money(text, ("납기내","금액","요금","등록금","보험료")) if domain=="고지서" else find_first_money(text)
    money_late = find_first_money(text, ("납기후","가산금")) if domain=="고지서" else None
    deadline = find_date_like(text, ("납부","납기","마감","까지") if domain=="고지서" else ("신청","마감","까지","접수"))
    phone = find_phone(text)

    text_norm = normalize_read_friendly(text)
    money_main = normalize_read_friendly(money_main or "") if money_main else None
    money_late = normalize_read_friendly(money_late or "") if money_late else None
    deadline   = normalize_read_friendly(deadline or "") if deadline else None

    if domain == "고지서":
        s1 = f"어르신, {subj} 고지서예요."
        s2 = f"{('납기내 금액은 ' + money_main) if money_main else '금액 안내가 없어요.'}"
        s3 = f"납부 기한은 {deadline}이고" if deadline else "납부 기한 안내가 없고"
        s3 += (f", 기한이 지나면 {money_late}로 늘어요." if money_late else " 추가 금액 안내는 없어요.")
        return " ".join([s1, s2, s3])

    if domain == "안내문-건강":
        s1 = f"어르신, {subj}가 있어요."
        when = deadline or find_date_like(text_norm)
        s2 = f"일시는 {when}이고" if when else "일시 안내는 없고"
        s2 += " 장소는 안내문에 표시돼 있어요."  # 장소 정밀 추출은 생략
        s3 = "대상·비용·신청 방법은 안내문을 참고하시고, 정확한 안내가 없어 확인이 필요해요."
        return " ".join([s1, s2, s3])

    if domain == "안내문-생활":
        s1 = f"어르신, {subj} 소식이에요."
        when = deadline or find_date_like(text_norm)
        s2 = f"{when}에 진행되며" if when else "일정은 별도 안내이고"
        s2 += " 장소·신청 방법은 안내문에 있어요."
        s3 = "정원·비용 등 핵심 정보는 간단히 확인 후 신청해 주세요."
        return " ".join([s1, s2, s3])

    if domain == "안내문-금융":
        s1 = f"어르신, {subj} 안내예요."
        s2 = "대상·혜택·한도·금리 등 핵심 조건이 있고, " \
             + (f"신청·신고 기한은 {deadline}까지예요." if deadline else "신청·신고 기한 안내는 없어요.")
        s3 = "자세한 방법과 준비서류는 안내문을 확인해 주세요."
        return " ".join([s1, s2, s3])

    # 기타
    return "어르신, 안내가 있어요. 핵심 정보는 안내문을 확인해 주세요. 정확한 안내가 없어 확인이 필요해요."

def build_rejected_summary(text: str, domain: str) -> str:
    """
    의도적으로 규칙을 어긋나게: 존댓말/숫자 읽기/핵심 누락 등 일부 위반.
    """
    subj = guess_subject(text, domain)
    raw_money = _money_re.search(text)
    raw_money_s = raw_money.group(0) if raw_money else "금액 안내 없음"
    when_raw = None
    m1 = _date1.search(text) or _date2.search(text)
    if m1:
        when_raw = m1.group(0)
    if domain == "고지서":
        # 규칙 위반: 어르신/2~3문장/읽기친화 위반
        return f"{subj} 고지서임. 금액 {raw_money_s}. 기한 {when_raw or '미정'}. 자세한 건 알아서 확인."
    if domain == "안내문-건강":
        return f"{subj} 있음. {when_raw or '일정 미정'}. 장소/대상/비용 등은 생략."
    if domain == "안내문-생활":
        return f"{subj} 진행. 신청 알아서. 비용/정원/연락처 정보 없음."
    if domain == "안내문-금융":
        return f"{subj} 관련 안내. 한도, 금리, 기한 잘 모름. 필요하면 검색."
    return "안내 있음. 끝."

# ------------------------------------------------------------
# 메인 로직: OCR 붙이기 + (옵션) chosen/rejected 생성
# ------------------------------------------------------------

def main():
    args = parse_args()
    meta_p = Path(args.meta)
    sft_p  = Path(args.sft)
    dpo_p  = Path(args.dpo)
    ocr_p  = Path(args.ocr_csv)

    if not ocr_p.exists():
        raise FileNotFoundError(f"OCR CSV가 없습니다: {ocr_p}")

    if (Path(OUT_SFT).exists() or Path(OUT_DPO).exists()) and not args.overwrite:
        print(f"[중단] 출력 파일이 이미 있습니다. --overwrite 옵션을 사용하세요.")
        return

    meta_map = load_metadata(meta_p)             # filename -> row
    sft_rows = read_jsonl(sft_p)
    dpo_rows = read_jsonl(dpo_p)
    ocr_map  = load_ocr_map(ocr_p)

    exact = ocr_map.get("__EXACT__", {})
    bynum = ocr_map.get("__BYNUM__", {})

    def lookup_ocr(filename_hint: Optional[str], fallback_idx: Optional[int]) -> str:
        if filename_hint and filename_hint in exact:
            return exact[filename_hint]
        if fallback_idx and fallback_idx in bynum:
            return bynum[fallback_idx]
        return ""

    # --- SFT: input에 OCR 텍스트 주입 ---
    filled_sft = []
    for ex in sft_rows:
        inp = ex.get("input","")
        fname = get_filename_from_text(inp)
        dom = ex.get("domain") or (meta_map.get(fname,{}).get("doc_category_hint") if fname else None)
        if not dom:
            # 파일명에서 번호로 추정
            dom = infer_domain_from_idx(idx_from_name(fname))
        idx = idx_from_name(fname or "")
        ocr_txt = lookup_ocr(fname, idx)
        if ocr_txt:
            ocr_txt = ocr_txt.strip()
        # input을 OCR 텍스트 + source_image 꼬리표로 교체/보강
        new_input = (ocr_txt or "__OCR_TEXT_MISSING__") + (f"\n(source_image={fname})" if fname else "")
        ex["input"] = new_input
        if dom: ex["domain"] = dom
        filled_sft.append(ex)

    write_jsonl(Path(OUT_SFT), filled_sft)
    print(f"[OK] {OUT_SFT}: {len(filled_sft)}줄")

    # --- DPO: prompt 유지 + (옵션) chosen/rejected 자동 생성 ---
    filled_dpo = []
    for ex in dpo_rows:
        prompt_full = ex.get("prompt","")
        fname = get_filename_from_text(prompt_full)
        dom = ex.get("domain") or (meta_map.get(fname,{}).get("doc_category_hint") if fname else None)
        if not dom:
            dom = infer_domain_from_idx(idx_from_name(fname))
        idx = idx_from_name(fname or "")
        ocr_txt = lookup_ocr(fname, idx).strip()

        chosen = ex.get("chosen","") or ""
        rejected = ex.get("rejected","") or ""

        if args.auto_pairs and ocr_txt:
            # 기존 값이 비었을 때만 자동 생성
            if not chosen:
                chosen = build_chosen_summary(ocr_txt, dom or "기타")
            if not rejected:
                rejected = build_rejected_summary(ocr_txt, dom or "기타")

            # 후처리: 읽기 친화 표기 강화
            chosen = normalize_read_friendly(chosen)
            # rejected는 의도적으로 원시 표기 남기기도 함

        ex["chosen"] = chosen
        ex["rejected"] = rejected
        if dom: ex["domain"] = dom
        filled_dpo.append(ex)

    write_jsonl(Path(OUT_DPO), filled_dpo)
    print(f"[OK] {OUT_DPO}: {len(filled_dpo)}줄")
    print("✅ 완료")

def infer_domain_from_idx(idx: Optional[int]) -> str:
    if idx is None: return "기타"
    if 1 <= idx <= 10:  return "고지서"
    if 11 <= idx <= 20: return "안내문-건강"
    if 21 <= idx <= 30: return "안내문-생활"
    if 31 <= idx <= 40: return "안내문-금융"
    return "기타"

if __name__ == "__main__":
    main()
