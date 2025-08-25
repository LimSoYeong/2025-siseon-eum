module.exports = {
    apps: [
      {
        name: "infer-gpu0",
        script: "uvicorn",
        args: "main:app --host 127.0.0.1 --port 8001 --workers 1",
        interpreter: "/root/2025-siseon-eum/backend/venv-backend/bin/python",
        env: {
          CUDA_VISIBLE_DEVICES: "0",
          MAX_CONCURRENCY: "1",
          MAX_QUEUE: "200"
        }
      },
      {
        name: "infer-gpu1",
        script: "uvicorn",
        args: "main:app --host 127.0.0.1 --port 8002 --workers 1",
        interpreter: "/root/2025-siseon-eum/backend/venv-backend/bin/python",
        env: {
          CUDA_VISIBLE_DEVICES: "1",
          MAX_CONCURRENCY: "1",
          MAX_QUEUE: "200"
        }
      }
    ]
  }