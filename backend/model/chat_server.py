from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
import os

load_dotenv()
app = FastAPI()

# CORS 설정 (Next.js에서 호출 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 실제 배포 시엔 도메인 지정
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

llm = ChatOpenAI()

@app.post("/chat")
async def chat(request: Request):
    body = await request.json()
    question = body.get("message", "")
    if not question:
        return { "answer": "메시지가 없습니다." }
    response = llm.invoke(question)
    return { "answer": response.content }