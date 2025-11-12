
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel # Pydantic 모델 정의 (데이터 유효성 검사)
from dotenv import load_dotenv
import os
os.environ["USE_TF"] = "0" # tensor flow 사용 안함
os.environ["TRANSFORMERS_NO_TF"] = "1" # tensor flow 사용 안함

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
import chromadb
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter

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
# Hugging Face Qwen 1.5 0.5B Chat 모델 로딩
print("Qwen1.5-0.5B-Chat 모델 로딩 중...")
model_name = "Qwen/Qwen1.5-0.5B-Chat"
tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

target_dtype = torch.float16 if (torch.cuda.is_available() or torch.backends.mps.is_available()) else torch.float32
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=target_dtype,
    trust_remote_code=True,
)

device = torch.device(
    "cuda" if torch.cuda.is_available() else
    ("mps" if torch.backends.mps.is_available() else "cpu")
)
model = model.to(device)

llm = pipeline(
    "text-generation",
    model=model,
    tokenizer=tokenizer,
    device=device,
    max_new_tokens=256,
    temperature=0.0,
    do_sample=False,
    pad_token_id=tokenizer.pad_token_id,
    eos_token_id=tokenizer.eos_token_id,  
    num_return_sequences=1,
    return_full_text=False,
)
print("HuggingFaceEmbeddings Meodel - BAAI/bge-m3")
embeddings = HuggingFaceEmbeddings(
    model_name="BAAI/bge-m3",
    encode_kwargs={"normalize_embeddings": True},
)
# 벡터를 저장할 디렉토리를 지정합니다. 이 디렉토리는 서버에 영구적으로 저장됩니다.
# ChromaDB를 HTTP 클라이언트로 연결
client = chromadb.HttpClient(host="localhost", port=8001)
db = Chroma(client=client, embedding_function=embeddings)

# --- Pydantic 모델 정의 (데이터 유효성 검사) ---
class IndexRequest(BaseModel):
    post_id: str
    content: str # HTML 콘텐츠

class ChatRequest(BaseModel):
    post_id: str | None = None
    question: str

"""
    json body 형식
    post_id: 게시글 ID
    question: 사용자 질문
"""



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

    def generate_answer(messages: list[dict]) -> str:
        chat_prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        outputs = llm(chat_prompt)
        if not outputs:
            return ""
        answer_text = outputs[0].get("generated_text", "")
        return answer_text.strip()

    # RAG (게시글 컨텍스트 기반 또는 전체 컬렉션)
    search_kwargs = {'k': 3}
    has_post_filter = bool(request.post_id and request.post_id != "default")
    if has_post_filter:
        search_kwargs['filter'] = {'post_id': request.post_id}

    retriever = db.as_retriever(
        search_type="similarity",
        search_kwargs=search_kwargs,
    )

    # 검색 결과 확인용 디버깅 코드
    print("\n--- Debugging Retriever Output ---")
    relevant_docs = []
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

    if not relevant_docs:
        return {"answer": "컨텍스트 검색에 실패했습니다. 인덱스를 재생성한 뒤 다시 시도해 주세요."}

    context_texts = []
    total_length = 0
    max_context_length = 1200
    for doc in relevant_docs:
        content = (doc.page_content or "").strip()
        if not content:
            continue
        snippet = content[:400]
        if total_length + len(snippet) > max_context_length:
            break
        context_texts.append(snippet)
        total_length += len(snippet)
    if not context_texts:
        if has_post_filter:
            context_texts.append("(관련 컨텍스트를 찾지 못했습니다.)")
        else:
            messages = [
                {
                    "role": "system",
                    "content": "당신은 친절하고 정중한 한국어 어시스턴트입니다. 사용자 질문에 정확하고 간결하게 답변하세요.",
                },
                {
                    "role": "user",
                    "content": request.question,
                },
            ]
            answer_text = generate_answer(messages)
            if not answer_text:
                return {"answer": "죄송합니다. 지금은 답변을 생성하지 못했습니다."}
            return {"answer": answer_text}

    context_block = "\n\n".join(context_texts)
    messages = [
        {
            "role": "system",
            "content": (
                "당신은 기술 문서 기반 RAG 어시스턴트입니다. "
                "제공된 컨텍스트를 우선 활용하여 정확하고 전문적인 한국어 답변을 작성하세요. "
                "컨텍스트에 정보가 없으면 현재 자료에 없음을 먼저 밝히고 일반적인 지식을 간단히 덧붙이세요."
            ),
        },
        {
            "role": "user",
            "content": (
                f"컨텍스트:\n{context_block}\n\n"
                f"질문: {request.question}\n\n"
                "위 컨텍스트만 참고하여 질문에 답변해 주세요."
            ),
        },
    ]

    answer_text = generate_answer(messages)
    if not answer_text:
        return {"answer": "죄송합니다. 현재는 적절한 답변을 생성하지 못했습니다."}
    return {"answer": answer_text}

# 서버 실행 (개발용)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
