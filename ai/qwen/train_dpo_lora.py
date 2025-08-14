# train_dpo_lora.py  (grad 문제 해결판 + QLoRA)
from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from peft import PeftModel, prepare_model_for_kbit_training
from trl import DPOTrainer, DPOConfig
import torch, inspect
from pathlib import Path

BASE_MODEL  = "Qwen/Qwen2.5-7B-Instruct"
SFT_ADAPTER = "outputs/sft-qwen25-7b-lora"   # SFT 결과(로컬 폴더)
DATA_PATH   = "dpo_pairs_filled.jsonl"
OUT_DIR     = "outputs/dpo-qwen25-7b-lora"

assert (Path(SFT_ADAPTER) / "adapter_config.json").exists(), "SFT 어댑터가 없습니다."
assert Path(DATA_PATH).exists(), f"{DATA_PATH} not found"

tok = AutoTokenizer.from_pretrained(BASE_MODEL, use_fast=True)
if tok.pad_token is None:
    tok.pad_token = tok.eos_token
tok.padding_side = "right"

# QLoRA 4bit 로드
bnb = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
    bnb_4bit_compute_dtype=torch.float16,   # bfloat16도 가능
)

base = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL, quantization_config=bnb, device_map="auto"
)
base.config.pad_token_id = tok.pad_token_id
base.config.use_cache = False

# ★ 4bit 학습 준비 + 체크포인팅
base = prepare_model_for_kbit_training(base, use_gradient_checkpointing=True)
base.gradient_checkpointing_enable()

# ★ LoRA 어댑터를 '학습가능' 상태로 로드
model = PeftModel.from_pretrained(base, SFT_ADAPTER, is_trainable=True)
model.train()

# (안전 확인) 최소 한 개 이상 파라미터가 requires_grad=True 이어야 함
assert any(p.requires_grad for _, p in model.named_parameters()), "No trainable parameters found!"
# 디버그용: 학습가능 파라미터 요약
trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
total = sum(p.numel() for p in model.parameters())
print(f"[INFO] trainable params: {trainable:,} / {total:,}")

# 데이터 로드 + 유효 샘플만
ds = load_dataset("json", data_files=DATA_PATH, split="train")
def ok_row(ex):
    return all(isinstance(ex.get(k,""), str) and len(ex[k].strip())>0 for k in ["prompt","chosen","rejected"])
ds = ds.filter(ok_row)

# ----- DPOConfig: trl 버전별 허용 인자만 선택 -----
base_kwargs = dict(
    output_dir=OUT_DIR,
    per_device_train_batch_size=1,
    gradient_accumulation_steps=16,
    learning_rate=5e-6,
    num_train_epochs=1,
    fp16=True,
    logging_steps=10,
    save_steps=200,
    save_total_limit=2,
    report_to=[],
    beta=0.1,
    optim="paged_adamw_8bit",
)
length_candidates = {
    "max_length": 1024,         # 전체 입력 길이 한도
    "max_prompt_length": 640,   # 일부 TRL 버전에서만 지원
    # "max_target_length": 384,  # 버전에 따라 미지원 → 자동 선택에서 제외/포함
}
sig = inspect.signature(DPOConfig.__init__).parameters
length_kwargs = {k:v for k,v in length_candidates.items() if k in sig}

cfg = DPOConfig(**base_kwargs, **length_kwargs)

trainer = DPOTrainer(
    model=model,
    args=cfg,
    processing_class=tok,
    train_dataset=ds,
)

trainer.train()
Path(OUT_DIR).mkdir(parents=True, exist_ok=True)
model.save_pretrained(OUT_DIR)
tok.save_pretrained(OUT_DIR)
print("✅ DPO done:", OUT_DIR)
