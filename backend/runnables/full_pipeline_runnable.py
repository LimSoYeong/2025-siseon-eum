# backend/runnables/full_pipeline_runnable.py

# from langchain_core.runnables import RunnableLambda, RunnableMap
# from runnables.stt_runnable import stt_chain
# from runnables.chat_runnable import get_chat_agent
# from runnables.tts_runnable import tts_chain

# # ✅ LangChain Agent (Qwen2.5-VL 기반 QA)
# qa_chain = get_chat_agent()

# # ✅ 전체 체인: STT → QA → TTS
# # 입력: {
# #     "audio_path": "static/audio/input.wav",
# #     "image_path": "static/images/doc.jpg"
# # }

# full_chain = (
#     # 1. STT 처리
#     RunnableLambda(lambda x: {
#         "question": stt_chain.invoke(x["audio_path"]),
#         "image_path": x.get("image_path")
#     })
#     # 2. QA 처리
#     | RunnableLambda(lambda x: {
#         "answer": qa_chain.invoke({
#             "input": x["question"],
#             "image_path": x.get("image_path")
#         })
#     })
#     # 3. TTS 처리
#     | RunnableLambda(lambda x: {
#         "answer": x["answer"],
#         "tts_audio_path": tts_chain.invoke(x["answer"])
#     })
# )

# # ✅ 사용 예시
# # result = full_chain.invoke({
# #     "audio_path": "static/audio/user_input.wav",
# #     "image_path": "static/images/doc.jpg"
# # })
# # print(result)
# # => { "answer": "...", "tts_audio_path": "static/audio/output.mp3" }