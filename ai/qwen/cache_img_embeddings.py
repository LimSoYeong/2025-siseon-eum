import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from PIL import Image      # ✅ 이거 꼭 필요
import torch
from tqdm import tqdm

from model_loader import get_model, get_processor
from qwen_vl_utils import process_vision_info


# 경로 설정
base_dir = Path(__file__).resolve().parent.parent
image_dir = base_dir / "data" / "img"
save_dir = base_dir / "qwen" / "cached_embeds"
save_dir.mkdir(parents=True, exist_ok=True)

# 모델과 프로세서 로딩 (재사용 가능하게)
model = get_model()
processor = get_processor()

# processor pixel 제한 설정
processor.min_pixels = 256 * 14 * 14
processor.max_pixels = 1280 * 14 * 14

# 캐싱 루프
image_files = list(image_dir.glob("*.jpg"))

for img_path in tqdm(image_files, desc="이미지 임베딩 캐싱 중"):
    image = Image.open(img_path).convert("RGB")

    with torch.no_grad():
        image_inputs, _ = process_vision_info(image)

    torch.save(image_inputs, save_dir / f"{img_path.stem}.pt")

