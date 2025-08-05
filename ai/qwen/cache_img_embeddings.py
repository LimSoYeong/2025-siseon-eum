# 이미지 임베딩 캐싱
# 같은 이미지를 다양한 프롬프트로 실험할 때, 이미지 임베딩을 매번 다시 만들면 오래 걸림.
# 따라서 이미지 임베딩을 한 번만 만들어서 파일로 저장해두고 재사용하가 위해 작성됨.
# Vision Encoder는 고정이고, Decoder부분만 달라지는 상황(LoRA 학습도 일반적으로 LLM쪽만 조정하기 때문에)

# from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
# from qwen_vl_utils import process_vision_info
# from PIL import Image
# from pathlib import Path
# import torch
# from tqdm import tqdm

# # 경로 설정
# base_dir = Path(__file__).resolve().parent.parent
# image_dir = base_dir / "data" / "img"
# save_dir = base_dir / "qwen" / "cached_embeds"
# save_dir.mkdir(parents=True, exist_ok=True)

# # 모델 로딩 (단지 Vision Encoder 사용 목적이라 1회만 실행)
# model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
#     "Qwen/Qwen2.5-VL-7B-Instruct",
#     torch_dtype=torch.float16,
#     device_map="auto"
# )
# model.eval()

# # Processor 로딩
# min_pixels = 256 * 14 * 14
# max_pixels = 1280 * 14 * 14
# processor = AutoProcessor.from_pretrained(
#     "Qwen/Qwen2.5-VL-7B-Instruct",
#     use_fast=True,
#     min_pixels=min_pixels,
#     max_pixels=max_pixels
# )

# # 캐싱 루프
# image_files = list(image_dir.glob("*.jpg"))

# for img_path in tqdm(image_files, desc="이미지 임베딩 캐싱 중"):
#     image = Image.open(img_path).convert("RGB")
#     messages = [{"role": "user", "content": [{"type": "image", "image": image}]}]

#     with torch.no_grad():
#         image_inputs, _ = process_vision_info(messages)

#     torch.save(image_inputs, save_dir / f"{img_path.stem}.pt")
