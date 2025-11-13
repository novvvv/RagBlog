
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel  # Pydantic 모델 정의 (데이터 유효성 검사)
from dotenv import load_dotenv
import os
import re
from typing import List, Tuple
os.environ["USE_TF"] = "0"  # tensor flow 사용 안함
os.environ["TRANSFORMERS_NO_TF"] = "1"  # tensor flow 사용 안함

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
import chromadb
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.schema import Document
from langchain.text_splitter import HTMLHeaderTextSplitter, RecursiveCharacterTextSplitter

from bs4 import BeautifulSoup

from retrieval_utils import (
    CrossEncoderReranker,
    HybridRetriever,
    load_all_documents_from_chroma_collection,
)

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

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "400"))  # 청크 크기: 400자
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))  # 오버랩: 100자 (25% 유지)
SUMMARY_CHAR_LIMIT = int(os.getenv("CHUNK_SUMMARY_LIMIT", "180"))
EMBEDDING_TOP_K = int(os.getenv("EMBEDDING_TOP_K", "8"))
BM25_TOP_K = int(os.getenv("BM25_TOP_K", "12"))
HYBRID_FINAL_K = int(os.getenv("HYBRID_FINAL_K", "4"))

HTML_HEADERS = [
    ("h1", "H1"),
    ("h2", "H2"),
    ("h3", "H3"),
    ("h4", "H4"),
]

HTML_SPLITTER = HTMLHeaderTextSplitter(headers_to_split_on=HTML_HEADERS)
TEXT_SPLITTER = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=["\n\n", "\n", " ", ""],
    add_start_index=True,
)

# --- 헬퍼 함수 ---


def _summarize_text(text: str, limit: int = SUMMARY_CHAR_LIMIT) -> str:
    if not text:
        return ""
    compact = " ".join(text.split())
    if not compact:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", compact)
    summary = sentences[0] if sentences else compact
    if len(summary) > limit:
        summary = summary[:limit].rsplit(" ", 1)[0]
    return summary


def _build_section_path(section_meta: dict) -> str:
    levels = [section_meta.get(label) for _, label in HTML_HEADERS]
    return " > ".join([level for level in levels if level])


def _extract_special_blocks(
    post_id: str,
    soup: BeautifulSoup,
    *,
    chunk_id_start: int = 0,
) -> Tuple[List[Document], int]:
    documents: List[Document] = []
    counter = chunk_id_start

    for pre in soup.find_all("pre"):
        code_text = pre.get_text("\n", strip=True)
        pre.decompose()
        if not code_text:
            continue
        chunk_id = f"{post_id}__code_{counter}"
        metadata = {
            "post_id": post_id,
            "chunk_id": chunk_id,
            "chunk_type": "code",
            "summary": _summarize_text(code_text, limit=120),
            "section_path": "코드 블록",
            "order": counter,
        }
        documents.append(Document(page_content=code_text, metadata=metadata))
        counter += 1

    for table in soup.find_all("table"):
        table_text = table.get_text(" ", strip=True)
        table.decompose()
        if not table_text:
            continue
        chunk_id = f"{post_id}__table_{counter}"
        metadata = {
            "post_id": post_id,
            "chunk_id": chunk_id,
            "chunk_type": "table",
            "summary": _summarize_text(table_text, limit=120),
            "section_path": "표",
            "order": counter,
        }
        documents.append(Document(page_content=table_text, metadata=metadata))
        counter += 1

    return documents, counter


def _extract_text_chunks(post_id: str, html_content: str) -> List[Document]:
    soup = BeautifulSoup(html_content, "html.parser")
    for meta in soup(["script", "style", "header", "footer", "nav"]):
        meta.decompose()

    body = soup.body or soup
    special_docs, counter = _extract_special_blocks(post_id, body)

    title = soup.title.string.strip() if soup.title and soup.title.string else ""

    section_documents: List[Document] = HTML_SPLITTER.split_text(str(body))
    documents: List[Document] = list(special_docs)

    for section_doc in section_documents:
        section_text = " ".join(section_doc.page_content.split())
        if not section_text:
            continue

        section_meta = dict(section_doc.metadata or {})
        section_meta["title"] = title
        section_path = _build_section_path(section_meta)

        split_docs = TEXT_SPLITTER.create_documents(
            [section_text],
            metadatas=[section_meta],
        )

        for chunk_doc in split_docs:
            chunk_content = chunk_doc.page_content.strip()
            if not chunk_content:
                continue
            chunk_id = f"{post_id}__chunk_{counter}"
            metadata = {
                "post_id": post_id,
                "chunk_id": chunk_id,
                "chunk_type": "text",
                "title": title,
                "section_path": section_path,
                "summary": _summarize_text(chunk_content),
                "order": counter,
            }
            metadata.update(chunk_doc.metadata or {})
            documents.append(Document(page_content=chunk_content, metadata=metadata))
            counter += 1

    return documents

# LLM, 임베딩, 벡터 DB 초기화
# Hugging Face EXAONE 4.0 모델 로딩
model_name = os.getenv("LLM_MODEL_ID", "LGAI-EXAONE/EXAONE-4.0-1.2B")
print(f"{model_name} 모델 로딩 중...")
try:
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # EXAONE 4.0 모델은 bfloat16을 권장하지만, 시스템 지원 여부에 따라 조정
    if torch.cuda.is_available() and torch.cuda.is_bf16_supported():
        target_dtype = torch.bfloat16
    elif torch.cuda.is_available() or torch.backends.mps.is_available():
        target_dtype = torch.float16
    else:
        target_dtype = torch.float32
    
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=target_dtype,
        trust_remote_code=True,
    )
except Exception as e:
    print(f"❌ 모델 로딩 실패: {e}")
    print(f"\n사용 가능한 대안:")
    print("1. 환경 변수 LLM_MODEL_ID를 설정하세요 (예: export LLM_MODEL_ID='올바른_모델_이름')")
    print("2. 또는 .env 파일에 LLM_MODEL_ID=올바른_모델_이름 을 추가하세요")
    print("\n일반적인 한국어 모델 예시:")
    print("  - LGAI-EXAONE/EXAONE-4.0-1.2B (기본값)")
    print("  - skt/kogpt2-base-v2")
    print("  - beomi/KoAlpaca-Polyglot-5.8B")
    print("  - nlpai-lab/kullm-polyglot-5.8b-v2")
    print("\n참고: EXAONE 4.0 모델은 transformers >= 4.54.0 버전이 필요합니다.")
    raise

device = torch.device(
    "cuda" if torch.cuda.is_available() else
    ("mps" if torch.backends.mps.is_available() else "cpu")
)
model = model.to(device)

# EXAONE 4.0 권장 설정: 한국어 일반 대화는 temperature=0.1 권장
pipeline_kwargs = dict(
    model=model,
    tokenizer=tokenizer,
    device=device,
    max_new_tokens=320,
    temperature=0.1,  # EXAONE 4.0 한국어 대화 권장값
    top_p=0.85,
    top_k=40,
    repetition_penalty=1.1,
    do_sample=True,
    pad_token_id=tokenizer.pad_token_id,
    eos_token_id=tokenizer.eos_token_id,
    num_return_sequences=1,
    return_full_text=False,
)
llm = pipeline("text-generation", **pipeline_kwargs)
print("HuggingFaceEmbeddings Model - mxbai-embed-large")
embeddings = HuggingFaceEmbeddings(
    model_name="mixedbread-ai/mxbai-embed-large-v1",
    model_kwargs={"trust_remote_code": True},
    encode_kwargs={"normalize_embeddings": True},
)
# 벡터를 저장할 디렉토리를 지정합니다. 이 디렉토리는 서버에 영구적으로 저장됩니다.
# ChromaDB를 HTTP 클라이언트로 연결
client = chromadb.HttpClient(host="localhost", port=8001)
db = Chroma(client=client, embedding_function=embeddings)
collection = client.get_collection(name=db._collection.name)

existing_documents = load_all_documents_from_chroma_collection(collection)
print(f"Chroma 초기 로드 문서 수: {len(existing_documents)}")

cross_encoder_reranker = CrossEncoderReranker(model_name="mixedbread-ai/mxbai-rerank-large-v1")
hybrid_retriever = HybridRetriever(
    chroma_store=db,
    initial_documents=existing_documents,
    embedding_k=EMBEDDING_TOP_K,
    bm25_k=BM25_TOP_K,
    final_k=HYBRID_FINAL_K,
    embedding_weight=0.65,
    bm25_weight=0.35,
    reranker=cross_encoder_reranker,
)

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
    global db, collection, hybrid_retriever
    try:
        print(f"Indexing request received for post_id: {request.post_id}")
        print(f"Content length: {len(request.content)} characters")

        documents = _extract_text_chunks(request.post_id, request.content)
        if not documents:
            return {
                "status": "skipped",
                "post_id": request.post_id,
                "reason": "본문에서 유의미한 텍스트를 추출하지 못했습니다.",
            }

        print(f"Number of documents created: {len(documents)}")
        if documents:
            sample = documents[0].page_content[:200]
            print(f"First document sample: {sample}...")

        # 기존 동일 post_id 데이터 삭제 후 재삽입
        try:
            db.delete(where={"post_id": request.post_id})
        except Exception as e:
            print(f"⚠️ 기존 데이터 삭제 중 오류 (무시): {e}")

        texts = [doc.page_content for doc in documents]
        metadatas = [doc.metadata for doc in documents]
        ids = [doc.metadata["chunk_id"] for doc in documents]
        
        # 컬렉션이 없으면 재생성
        try:
            db.add_texts(texts=texts, metadatas=metadatas, ids=ids)
        except Exception as e:
            if "does not exists" in str(e) or "does not exist" in str(e):
                print(f"⚠️ 컬렉션이 없어서 재생성 중...")
                # 컬렉션 재생성
                db = Chroma(client=client, embedding_function=embeddings)
                collection = client.get_collection(name=db._collection.name)
                # 다시 시도
                db.add_texts(texts=texts, metadatas=metadatas, ids=ids)
                # HybridRetriever 재초기화
                existing_documents = load_all_documents_from_chroma_collection(collection)
                hybrid_retriever = HybridRetriever(
                    chroma_store=db,
                    initial_documents=existing_documents,
                    embedding_k=EMBEDDING_TOP_K,
                    bm25_k=BM25_TOP_K,
                    final_k=HYBRID_FINAL_K,
                    embedding_weight=0.65,
                    bm25_weight=0.35,
                    reranker=cross_encoder_reranker,
                )
                print(f"✅ 컬렉션 재생성 완료")
            else:
                raise

        # 하이브리드 검색기 BM25 인덱스 갱신
        # 전체 문서를 다시 로드하는 대신 개별 문서만 추가하여 속도 향상
        try:
            hybrid_retriever.add_documents(documents)
        except Exception as e:
            print(f"⚠️ BM25 인덱스 갱신 중 오류 (무시): {e}")

        print(f"✅ Post {request.post_id} indexed successfully.")
        return {"status": "success", "post_id": request.post_id}
    except Exception as e:
        import traceback
        error_msg = f"Indexing failed for post_id {request.post_id}: {str(e)}"
        print(f"❌ {error_msg}")
        print(traceback.format_exc())
        return {
            "status": "error",
            "post_id": request.post_id,
            "error": error_msg
        }



def generate_answer(messages: list[dict], **gen_kwargs) -> str:
    chat_prompt = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    # 기본 파라미터와 병합 (gen_kwargs가 우선)
    merged_kwargs = {**pipeline_kwargs, **gen_kwargs}
    # pipeline 함수에 전달할 수 없는 키 제거
    pipeline_only_keys = {"model", "tokenizer", "device", "return_full_text"}
    call_kwargs = {k: v for k, v in merged_kwargs.items() if k not in pipeline_only_keys}
    outputs = llm(chat_prompt, **call_kwargs)
    if not outputs:
        return ""
    answer_text = outputs[0].get("generated_text", "")
    return answer_text.strip()


@app.post("/chat")
def chat_with_rag(request: ChatRequest):

    print(f"--- Incoming Chat Request ---: {request}")

    # RAG (게시글 컨텍스트 기반 또는 전체 컬렉션)
    has_post_filter = bool(request.post_id and request.post_id != "default")
    post_filter = request.post_id if has_post_filter else None

    # 검색 결과 확인용 디버깅 코드
    print("\n--- Debugging Retriever Output ---")
    relevant_docs = []
    try:
        relevant_docs = hybrid_retriever.get_relevant_documents(
            request.question,
            post_id=post_filter,
            final_k=HYBRID_FINAL_K,
        )
        print(
            f"Retrieved {len(relevant_docs)} documents for post_id: {request.post_id} "
            f"based on question: '{request.question}'"
        )
        for i, doc in enumerate(relevant_docs):
            print(f"--- Document {i+1} ---")
            print(f"Summary: {doc.metadata.get('summary')}")
            print(f"Content: {doc.page_content}")
            print(f"Metadata: {doc.metadata}")
    except Exception as e:
        print(f"Error during document retrieval: {e}")
    print("--- End of Retriever Output ---\n")

    if not relevant_docs:
        return {"answer": "컨텍스트 검색에 실패했습니다. 인덱스를 재생성한 뒤 다시 시도해 주세요."}

    context_texts = []
    total_length = 0
    max_context_length = 1200  # 컨텍스트 길이 증가로 더 많은 정보 제공
    for idx, doc in enumerate(relevant_docs, start=1):
        content = (doc.page_content or "").strip()
        if not content:
            continue
        section = doc.metadata.get("section_path")
        summary = doc.metadata.get("summary")
        snippet_header = []
        if summary:
            snippet_header.append(f"[요약] {summary}")
        if section:
            snippet_header.append(f"[위치] {section}")
        snippet_body = content[:700]  # 더 많은 컨텍스트 포함
        snippet_parts = snippet_header + [snippet_body]
        snippet = f"[컨텍스트 {idx}]\n" + "\n".join(snippet_parts)
        if len(snippet) < 40:
            continue
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
                "⚠️ 중요: 제공된 컨텍스트에 없는 정보는 절대 포함하지 마세요. "
                "컨텍스트에 명시된 내용만 사용하여 답변하세요. "
                "컨텍스트에 없는 사실, 추측, 일반적인 지식은 포함하지 마세요. "
                "각 문장은 반드시 제공된 컨텍스트에서 직접 찾을 수 있어야 합니다. "
                "컨텍스트에 정보가 부족하면 '제공된 자료에서 해당 정보를 확인할 수 없습니다.'라고 명확히 밝히세요. "
                "중요한 근거가 있는 문장은 반드시 문장 끝에 [컨텍스트 n] 형태로 출처를 표시하세요. "
                "컨텍스트의 표현을 최대한 그대로 사용하고, 용어를 바꾸지 마세요."
            ),
        },
        {
            "role": "user",
            "content": (
                f"아래 컨텍스트만 사용하여 질문에 답변하세요. 컨텍스트에 없는 내용은 포함하지 마세요.\n\n"
                f"=== 컨텍스트 ===\n{context_block}\n\n"
                f"=== 질문 ===\n{request.question}\n\n"
                f"⚠️ 규칙:\n"
                f"1. 위 컨텍스트에 명시된 내용만 사용하세요.\n"
                f"2. 컨텍스트에 없는 정보는 절대 추가하지 마세요.\n"
                f"3. 각 문장 끝에 해당하는 [컨텍스트 n] 번호를 표시하세요.\n"
                f"4. 컨텍스트의 표현을 그대로 사용하세요."
            ),
        },
    ]

    answer_text = generate_answer(
        messages, 
        max_new_tokens=320, 
        min_new_tokens=80,
        temperature=0.05,  # 더 낮은 temperature로 컨텍스트에 충실하게
        repetition_penalty=1.15,  # 반복 패널티 증가로 컨텍스트 내용 강조
    )
    if not answer_text:
        return {"answer": "죄송합니다. 현재는 적절한 답변을 생성하지 못했습니다."}
    return {"answer": answer_text}

# 서버 실행 (개발용)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
