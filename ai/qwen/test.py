
import torch, platform, os
print("torch:", torch.__version__)
print("cuda:", torch.version.cuda)
print("sm available:", torch.cuda.get_device_name(0))
print("python:", platform.python_version())
print("CUDA_VISIBLE_DEVICES:", os.environ.get("CUDA_VISIBLE_DEVICES"))
