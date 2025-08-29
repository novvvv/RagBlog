
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel # Pydantic 모델 정의 (데이터 유효성 검사)
from dotenv import load_dotenv
import os

from langchain_upstage import ChatUpstage
import chromadb
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough, RunnableParallel
from langchain_core.output_parsers import StrOutputParser

from bs4 import BeautifulSoup

# .env 파일에서 환경 변수 로드
load_dotenv()

# --- 초기 설정 ---
app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 실제 배포 시에는 특정 도메인으로 제한하는 것이 좋습니다.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# LLM, 임베딩, 벡터 DB 초기화
llm = ChatUpstage()
embeddings = HuggingFaceEmbeddings(model_name="jhgan/ko-sroberta-multitask")
# 벡터를 저장할 디렉토리를 지정합니다. 이 디렉토리는 서버에 영구적으로 저장됩니다.
# ChromaDB를 HTTP 클라이언트로 연결
client = chromadb.HttpClient(host="localhost", port=8001)
db = Chroma(client=client, embedding_function=embeddings)

# --- Pydantic 모델 정의 (데이터 유효성 검사) ---
class IndexRequest(BaseModel):
    post_id: str
    content: str # HTML 콘텐츠

"""
    json body 형식
    post_id: 게시글 ID
    question: 사용자 질문
"""

class ChatRequest(BaseModel):
    post_id: str
    question: str

# --- API 엔드포인트 ---

@app.post("/index")
def index_post(request: IndexRequest):
    """
    게시글 내용을 받아서 벡터로 변환하고 ChromaDB에 저장합니다.
    """
    print(f"Indexing request received for post_id: {request.post_id}")
    print(f"Content length: {len(request.content)} characters")

    # 1. HTML을 텍스트로 변환
    soup = BeautifulSoup(request.content, 'html.parser')
    text_content = soup.get_text()
    print(f"Extracted text content length: {len(text_content)} characters")

    # 2. 텍스트를 의미 있는 단위로 분할
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    docs = text_splitter.split_text(text_content)
    print(f"Number of chunks created: {len(docs)}")
    if docs:
        print(f"First chunk sample: {docs[0][:200]}...") # 첫 200자만 출력

    # 3. 각 텍스트 조각에 메타데이터 추가 (어떤 게시글에서 왔는지 식별하기 위함)
    metadatas = [{"post_id": request.post_id} for _ in docs]
    
    # 4. ChromaDB에 텍스트와 메타데이터 저장
    db.add_texts(texts=docs, metadatas=metadatas)
    
    print(f"✅ Post {request.post_id} indexed successfully.")
    return {"status": "success", "post_id": request.post_id}



@app.post("/chat")
def chat_with_rag(request: ChatRequest):

    print(f"--- Incoming Chat Request ---: {request}")
    
    # post_id가 "default" 또는 비어있으면 일반 챗봇
    if not request.post_id or request.post_id == "default":
        answer = llm.invoke(request.question)
        # answer가 dict이고 content 필드가 있으면 content만 반환
        if isinstance(answer, dict) and "content" in answer:
            return {"answer": answer["content"]}
        # answer가 리스트면 각 항목의 content만 추출해서 합침
        if isinstance(answer, list):
            contents = [a["content"] if isinstance(a, dict) and "content" in a else str(a) for a in answer]
            return {"answer": "\n".join(contents)}
        # 그 외에는 문자열로 변환해서 반환
        return {"answer": str(answer)}

    # RAG (게시글 컨텍스트 기반)
    retriever = db.as_retriever(
        search_type="similarity", 
        search_kwargs={'k': 3, 'filter': {'post_id': request.post_id}}
    )

    # 검색 결과 확인용 디버깅 코드
    print("\n--- Debugging Retriever Output ---")
    try:
        relevant_docs = retriever.get_relevant_documents(request.question)
        print(f"Retrieved {len(relevant_docs)} documents for post_id: {request.post_id} based on question: '{request.question}'")
        for i, doc in enumerate(relevant_docs):
            print(f"--- Document {i+1} ---")
            print(f"Content: {doc.page_content}")
            print(f"Metadata: {doc.metadata}")
    except Exception as e:
        print(f"Error during document retrieval: {e}")
    print("--- End of Retriever Output ---\n")

    template = """
안녕하세요! 저는 기술 문서 전문가 AI 어시스턴트입니다.

답변 규칙:
1. 제공된 컨텍스트를 최대한 활용하여 정확하고 전문적인 답변을 드리겠습니다
2. 컨텍스트에 관련 정보가 있으면 자세하고 체계적으로 설명해드리겠습니다
3. 컨텍스트에 없는 내용이면 "이 부분은 현재 자료에 포함되어 있지 않지만, 일반적으로..."라고 시작하여 기본적인 정보를 제공해드리겠습니다
4. 답변은 전문적이면서도 이해하기 쉽게 작성하겠습니다
5. 필요시 구체적인 예시나 적절한 비유를 사용하여 설명해드리겠습니다

컨텍스트:
{context}

질문:
{question}

답변 형식:
[정중한 인사] + [전문적이고 정확한 답변] + [추가 설명 및 예시]
"""
    prompt = ChatPromptTemplate.from_template(template)
    rag_chain = (
        RunnableParallel(
            context=retriever,
            question=RunnablePassthrough()
        )
        | prompt
        | llm
        | StrOutputParser()
    )
    answer = rag_chain.invoke(request.question)
    # answer가 dict이고 content 필드가 있으면 content만 반환
    if isinstance(answer, dict) and "content" in answer:
        return {"answer": answer["content"]}
    # answer가 리스트면 각 항목의 content만 추출해서 합침
    if isinstance(answer, list):
        contents = [a["content"] if isinstance(a, dict) and "content" in a else str(a) for a in answer]
        return {"answer": "\n".join(contents)}
    # 그 외에는 문자열로 변환해서 반환
    return {"answer": str(answer)}

# 서버 실행 (개발용)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
