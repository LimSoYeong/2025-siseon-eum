# routes/chat_context_router.py

# from fastapi import APIRouter, UploadFile, File
# from runnables.chat_runnable import memory, describe_image

# router = APIRouter(prefix="/api", tags=["VLM-Chat"])

# @router.post("/chat/init-image")
# async def init_image_chat(image: UploadFile = File(...)):
#     image_bytes = await image.read()
#     description = describe_image(image_bytes)

#     # Memory에 초기 대화 저장
#     memory.chat_memory.add_user_message("이 이미지를 설명해줘")
#     memory.chat_memory.add_ai_message(description)

#     return {"description": description}