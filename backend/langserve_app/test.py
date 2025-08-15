import torch

print("CUDA 사용 가능:", torch.cuda.is_available())
print("GPU 개수:", torch.cuda.device_count())
if torch.cuda.is_available():
    print("GPU 이름:", torch.cuda.get_device_name(0))
    print("CUDA 버전:", torch.version.cuda)
    print("PyTorch 버전:", torch.__version__)

import torch

def check_flashattention_support():
    if not torch.cuda.is_available():
        return False, "CUDA GPU가 없습니다."
    
    gpu_name = torch.cuda.get_device_name(0)
    major_cc, _ = torch.cuda.get_device_capability()
    
    if major_cc < 8:  # Ampere(8.x) 이상 필요
        return False, f"GPU({gpu_name})는 FlashAttention 지원 X"
    
    try:
        from flash_attn import flash_attn_func
        return True, f"GPU({gpu_name})에서 FlashAttention 사용 가능"
    except ImportError:
        return False, "flash-attn 라이브러리가 설치되지 않았습니다."

ok, msg = check_flashattention_support()
print("msg:",msg)
