import os
from pathlib import Path
import torch

from datasets import load_dataset
from transformers import (
    AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
)
from peft import LoraConfig, get_peft_model, PeftModel
from transformers import TrainingArguments, Trainer
from trl import DPOTrainer, DPOConfig

BASE_MODEL = os.getenv("BASE_MODEL", "Qwen/Qwen2.5-7B-Instruct")
ROOT = Path(__file__).resolve().parents[1]   # backend/
DATA_DIR = ROOT / "data" / "training"
OUT_SFT = ROOT / "outputs" / "sft" / "policy"
OUT_DPO = ROOT / "outputs" / "dpo" / "policy"

SFT_JSONL = DATA_DIR / "sft.jsonl"
DPO_JSONL = DATA_DIR / "dpo.jsonl"

# 4bit QLoRA (L4에 적합)
bnb = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
)

# LoRA 표준 타깃 모듈 (Qwen 계열)
LORA_CFG = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05,
    target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"]
)

def train_sft():
    print("== SFT ==")
    tok = AutoTokenizer.from_pretrained(BASE_MODEL, use_fast=True)
    tok.pad_token = tok.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL, quantization_config=bnb, device_map="auto"
    )
    model = get_peft_model(model, LORA_CFG)

    ds = load_dataset("json", data_files=str(SFT_JSONL))["train"]

    def fmt(ex):
        text = ex["prompt"] + "\n\n" + ex["output"]
        enc = tok(text, truncation=True, max_length=2048)
        enc["labels"] = enc["input_ids"].copy()
        return enc

    ds = ds.map(fmt, remove_columns=ds.column_names)

    args = TrainingArguments(
        output_dir=str(OUT_SFT.parent),
        per_device_train_batch_size=2,
        gradient_accumulation_steps=8,
        learning_rate=1e-5,
        num_train_epochs=1,
        bf16=True,
        logging_steps=20, save_steps=500
    )

    trainer = Trainer(model=model, args=args, train_dataset=ds)
    trainer.train()

    OUT_SFT.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(OUT_SFT))
    tok.save_pretrained(str(OUT_SFT))

def train_dpo_from_sft():
    print("== DPO (continue from SFT) ==")
    tok = AutoTokenizer.from_pretrained(BASE_MODEL, use_fast=True)
    tok.pad_token = tok.eos_token

    # 정책(policy) 시작점: "SFT 어댑터가 장착된" 모델
    base = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL, quantization_config=bnb, device_map="auto"
    )
    policy = PeftModel.from_pretrained(base, str(OUT_SFT))  # ← SFT에서 이어서

    # ref_model 은 "고정된 기준"이어야 함: 보통 SFT 체크포인트를 참조로 둔다.
    # TRL은 경로 문자열을 주면 내부에서 로드한다.
    ref_model = str(OUT_SFT)

    dpo_args = DPOConfig(
        output_dir=str(OUT_DPO.parent),
        per_device_train_batch_size=2,
        gradient_accumulation_steps=8,
        learning_rate=5e-6,
        num_train_epochs=1,
        bf16=True,
        beta=0.1,
        max_length=2048,           # prompt+response 전체 길이
        max_target_length=512,     # response 길이 상한
        logging_steps=20, save_steps=500,
    )

    ds = load_dataset("json", data_files=str(DPO_JSONL))["train"]

    trainer = DPOTrainer(
        model=policy,
        ref_model=ref_model,         # ← SFT 체크포인트를 KL 기준으로 사용
        args=dpo_args,
        train_dataset=ds,
        tokenizer=tok,
        peft_config=LORA_CFG,        # LoRA 계속 학습
    )
    trainer.train()

    OUT_DPO.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(OUT_DPO))
    tok.save_pretrained(str(OUT_DPO))

if __name__ == "__main__":
    assert SFT_JSONL.exists(), f"missing {SFT_JSONL}"
    assert DPO_JSONL.exists(), f"missing {DPO_JSONL}"
    train_sft()
    train_dpo_from_sft()
    print(f"[DONE] SFT→DPO complete. Final adapter: {OUT_DPO}")