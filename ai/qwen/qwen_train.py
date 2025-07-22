from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor, TrainingArguments, Trainer
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from datasets import load_dataset
from pathlib import Path
import torch

# 경로 설정
base_dir = Path(__file__).resolve().parent.parent
jsonl_path = base_dir / "data" / "train0722.jsonl"

# 모델 로드
model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
    "Qwen/Qwen2.5-VL-7B-Instruct",
    device_map="auto",
    torch_dtype=torch.float16,
)

# LoRA 설정
lora_config = LoraConfig(
    r=8,
    lora_alpha=32,
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules=["c_attn", "q_proj", "v_proj", "k_proj", "o_proj"]  # Qwen 구조에 맞게 조정
)

model = prepare_model_for_kbit_training(model)
model = get_peft_model(model, lora_config)

# 데이터셋 로드
dataset = load_dataset("json", data_files={"train": str(jsonl_path)})

# TrainingArguments
training_args = TrainingArguments(
    output_dir=str(base_dir / "qwen" / "lora_finetuned"),
    per_device_train_batch_size=1,
    num_train_epochs=3,
    logging_dir=str(base_dir / "logs"),
    save_strategy="steps",
    save_steps=100,
    logging_steps=10,
    fp16=True,
)

# Trainer 설정
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
)

# 학습 시작
trainer.train()
trainer.save_model(str(base_dir / "qwen" / "lora_finetuned"))
