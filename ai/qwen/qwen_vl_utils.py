# ai/qwen/qwen_vl_utils.py

import torch
from model_loader import get_processor

def process_vision_info(image):
    processor = get_processor()
    processor.min_pixels = 256 * 14 * 14
    processor.max_pixels = 1280 * 14 * 14

    # 반드시 text도 함께 제공해야 함
    dummy_prompt = "이 이미지를 설명해줘."  # 또는 단순 placeholder 가능

    inputs = processor(
        text=dummy_prompt,
        images=image,
        return_tensors="pt"
    ).to("cuda")

    return inputs, None


