from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
# from langchain_openai import ChatOpenAI
from langchain_upstage import ChatUpstage 
from dotenv import load_dotenv
import os

load_dotenv()
app = FastAPI() # FastApi 앱 생성 

# CORS 설정 (Next.js에서 호출 허용)
# 브라우저가 다른 출처에서 API를 호출하는 것을 허용한다. 
# 실제 프로덕트에서는 개인 블로그 주소로 제한 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 실제 배포 시엔 도메인 지정
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# llm = ChatOpenAI()
llm = ChatUpstage()

# /chat 경로로 Post 요청이 들어오면 실행 
@app.post("/chat")
async def chat(request: Request):
    body = await request.json()
    question = body.get("message", "")
    if not question:
        return { "answer": "메시지가 없습니다." }
    response = llm.invoke(question)
    return { "answer": response.content }