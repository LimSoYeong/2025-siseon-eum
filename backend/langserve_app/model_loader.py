# backend/langserve_app/model_loader.py

import torch
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

model_name = "Qwen/Qwen2.5-VL-7B-Instruct"

model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
    model_name,
    torch_dtype=torch.float16,
    device_map="auto"
)
model.eval()

processor = AutoProcessor.from_pretrained(
    model_name,
    use_fast=True
)