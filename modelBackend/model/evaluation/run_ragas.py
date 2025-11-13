"""
RAGAS 스타일 평가 스크립트
---------------------------
현재 FastAPI RAG 서버(포트 8002)와 ChromaDB(포트 8001)를 바라보며
사전에 정의된 20개 질문 세트로 RAG 품질을 측정한다.

평가 메트릭:
- Faithfulness
- Answer Relevancy
- Context Precision
- Context Recall

결과는 JSON 파일로 저장된다.
"""

from __future__ import annotations

import json
import os
import sys
import re
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import List

import numpy as np
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
import requests
import chromadb
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from retrieval_utils import (
    CrossEncoderReranker,
    HybridRetriever,
    load_all_documents_from_chroma_collection,
)

# ----- 평가 파라미터 -----
WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
RESULT_DIR = WORKSPACE_ROOT / "modelBackend" / "model" / "evaluation" / "results"
RESULT_DIR.mkdir(parents=True, exist_ok=True)

# 로컬 Chroma persistent DB 경로 및 접속 설정
CHROMA_PATH = WORKSPACE_ROOT / "modelBackend" / "model" / "chroma_db"
CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8001"))
USE_CHROMA_HTTP_CLIENT = os.getenv("CHROMA_USE_HTTP", "1").lower() in {"1", "true", "yes"}
CHAT_ENDPOINT = os.getenv("CHAT_ENDPOINT", "http://localhost:8002/chat")

EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "mixedbread-ai/mxbai-embed-large-v1")
EVAL_EMBEDDING_TOP_K = int(os.getenv("EVAL_EMBEDDING_TOP_K", "8"))
EVAL_BM25_TOP_K = int(os.getenv("EVAL_BM25_TOP_K", "12"))
EVAL_FINAL_TOP_K = int(os.getenv("EVAL_FINAL_TOP_K", "4"))

EVAL_MIN_SENTENCE_LENGTH = int(os.getenv("EVAL_MIN_SENTENCE_LENGTH", "20"))
CONTEXT_PRECISION_SIM_THRESHOLD = float(os.getenv("EVAL_CONTEXT_PRECISION_THRESHOLD", "0.35"))
CONTEXT_RECALL_TOP_K = int(os.getenv("EVAL_CONTEXT_RECALL_TOP_K", "3"))

embeddings_model = HuggingFaceEmbeddings(
    model_name=EMBEDDING_MODEL_NAME,
    model_kwargs={"trust_remote_code": True},
    encode_kwargs={"normalize_embeddings": True},
)

# ----- 데이터 모델 -----
@dataclass
class QuestionItem:
    question: str
    category: str


@dataclass
class EvaluationRecord:
    question: str
    category: str
    answer: str
    contexts: List[str]
    metrics: dict


# ----- 질문 세트 정의 (총 20개) -----
def _embed_documents(texts: List[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, 0), dtype=np.float32)
    vectors = embeddings_model.embed_documents(texts)
    return np.asarray(vectors, dtype=np.float32)


def _embed_query(text: str) -> np.ndarray:
    cleaned = (text or "").strip()
    if not cleaned:
        return np.zeros((0,), dtype=np.float32)
    vector = embeddings_model.embed_query(cleaned)
    return np.asarray(vector, dtype=np.float32)


def _cosine_similarity_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    if a.size == 0 or b.size == 0:
        return np.zeros((a.shape[0], b.shape[0]), dtype=np.float32)
    return np.matmul(a, b.T)


def _cosine_similarity(u: np.ndarray, v: np.ndarray) -> float:
    if u.size == 0 or v.size == 0:
        return 0.0
    return float(np.clip(np.dot(u, v), -1.0, 1.0))


def _split_sentences(text: str) -> List[str]:
    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", text)
        if sentence.strip()
    ]
    if not sentences:
        return []
    filtered = [s for s in sentences if len(s) >= EVAL_MIN_SENTENCE_LENGTH]
    return filtered or sentences


def load_questions() -> List[QuestionItem]:
    questions_data = [
        ("C++에서 STL Vector Container를 어떻게 사용하나요?", "C++"),
        ("C++에서 Class를 어떻게 사용하나요?", "C++"),
        ("C++에서 pointer란 무엇인가요?", "C++"),
        ("C++에서 strcpy, strlen, strcmp 함수를 어떻게 사용하나요?", "C++"),
        ("C++에서 STL List Container를 어떻게 사용하나요?", "C++"),
        ("C++에서 STL Map Container를 어떻게 사용하나요?", "C++"),
        ("C++에서 STL Deque Container를 어떻게 사용하나요?", "C++"),
        ("C++에서 STL Set Container를 어떻게 사용하나요?", "C++"),
        ("C++에서 STL find() 함수를 어떻게 사용하나요?", "C++"),
        ("C++에서 STL sort() 함수를 어떻게 사용하나요?", "C++"),
        ("C++에서 STL pair를 어떻게 사용하나요?", "C++"),
        ("C++에서 STL algorithm을 어떻게 사용하나요?", "C++"),
    ]

    return [QuestionItem(question=q, category=c) for q, c in questions_data]


# ----- 메트릭 계산 유틸 -----
def calculate_faithfulness(answer: str, contexts: List[str]) -> float:
    if not answer or not contexts:
        return 0.0

    sentences = _split_sentences(answer)
    if not sentences:
        return 0.0

    context_vectors = _embed_documents(contexts)
    if context_vectors.size == 0:
        return 0.0

    sentence_vectors = _embed_documents(sentences)
    if sentence_vectors.size == 0:
        return 0.0

    similarity_matrix = _cosine_similarity_matrix(sentence_vectors, context_vectors)
    if similarity_matrix.size == 0:
        return 0.0

    max_similarities = np.max(similarity_matrix, axis=1)
    max_similarities = np.clip(max_similarities, 0.0, 1.0)
    return float(np.mean(max_similarities))


def calculate_answer_relevancy(answer: str, question: str) -> float:
    if not answer or not question:
        return 0.0
    question_vector = _embed_query(question)
    answer_vector = _embed_query(answer)
    score = _cosine_similarity(question_vector, answer_vector)
    return float(np.clip(score, 0.0, 1.0))


def calculate_context_precision(contexts: List[str], question: str) -> float:
    if not contexts or not question:
        return 0.0
    context_vectors = _embed_documents(contexts)
    if context_vectors.size == 0:
        return 0.0
    question_vector = _embed_query(question)
    if question_vector.size == 0:
        return 0.0
    similarities = context_vectors @ question_vector
    positives = similarities >= CONTEXT_PRECISION_SIM_THRESHOLD
    if context_vectors.shape[0] == 0:
        return 0.0
    return float(positives.sum() / context_vectors.shape[0])


def calculate_context_recall(contexts: List[str], question: str) -> float:
    if not contexts or not question:
        return 0.0
    context_vectors = _embed_documents(contexts)
    if context_vectors.size == 0:
        return 0.0
    question_vector = _embed_query(question)
    if question_vector.size == 0:
        return 0.0
    similarities = context_vectors @ question_vector
    similarities = np.clip(similarities, 0.0, 1.0)
    top_k = min(len(similarities), max(CONTEXT_RECALL_TOP_K, 1))
    if top_k == 0:
        return 0.0
    top_scores = np.sort(similarities)[-top_k:]
    return float(np.mean(top_scores))


# ----- 평가 로직 -----
def build_retriever():
    if USE_CHROMA_HTTP_CLIENT:
        client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    else:
        client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    
    # 서버와 동일한 방식으로 Chroma 초기화하여 정확한 컬렉션 찾기
    chroma_test = Chroma(client=client, embedding_function=embeddings_model)
    server_collection_name = chroma_test._collection.name
    print(f"🔍 서버가 사용하는 컬렉션 이름: {server_collection_name}")
    
    # 모든 컬렉션 확인하고 문서가 있는 컬렉션 찾기
    collections = client.list_collections()
    print(f"📚 발견된 컬렉션 수: {len(collections)}")
    
    best_collection = None
    best_collection_name = None
    max_docs = 0
    
    # 모든 컬렉션 확인
    for coll in collections:
        try:
            test_collection = client.get_collection(name=coll.name)
            # 정확한 문서 수 확인
            try:
                doc_count = test_collection.count()
            except:
                # count()가 없으면 get()으로 확인
                result = test_collection.get()
                doc_count = len(result.get("ids", [])) if result else 0
            
            print(f"  - 컬렉션 '{coll.name}': {doc_count}개 문서")
            
            # 문서가 있는 컬렉션 중에서 선택
            if doc_count > max_docs:
                max_docs = doc_count
                best_collection = test_collection
                best_collection_name = coll.name
        except Exception as ex:
            print(f"  - 컬렉션 '{coll.name}' 확인 실패: {ex}")
            continue
    
    # 문서가 있는 컬렉션을 찾지 못했으면 서버가 사용하는 컬렉션 확인
    if max_docs == 0:
        print(f"⚠️ 모든 컬렉션이 비어있습니다. 서버 컬렉션 '{server_collection_name}' 확인 중...")
        try:
            server_collection = client.get_collection(name=server_collection_name)
            try:
                server_doc_count = server_collection.count()
            except:
                result = server_collection.get()
                server_doc_count = len(result.get("ids", [])) if result else 0
            
            if server_doc_count > 0:
                print(f"✅ 서버 컬렉션에 {server_doc_count}개 문서 발견!")
                best_collection = server_collection
                best_collection_name = server_collection_name
                max_docs = server_doc_count
            else:
                print(f"❌ 서버 컬렉션도 비어있습니다.")
                raise ValueError(
                    "ChromaDB에 문서가 있는 컬렉션을 찾을 수 없습니다.\n"
                    "서버가 실행 중인지 확인하고, 인덱싱을 실행하세요:\n"
                    "  python reindex_bge.py"
                )
        except Exception as e:
            print(f"❌ 서버 컬렉션 확인 실패: {e}")
            raise ValueError(
                "ChromaDB에 문서가 있는 컬렉션을 찾을 수 없습니다.\n"
                "서버가 실행 중인지 확인하고, 인덱싱을 실행하세요:\n"
                "  python reindex_bge.py"
            )
    else:
        print(f"✅ 문서가 있는 컬렉션 발견: '{best_collection_name}' ({max_docs}개 문서)")
    
    # Chroma 객체를 찾은 컬렉션으로 생성
    chroma = Chroma(
        client=client,
        collection_name=best_collection_name,
        embedding_function=embeddings_model
    )
    
    # 문서 로드
    existing_docs = load_all_documents_from_chroma_collection(best_collection)
    print(f"📄 최종 로드된 문서 수: {len(existing_docs)}")
    
    if len(existing_docs) == 0:
        raise ValueError(
            f"컬렉션 '{best_collection_name}'에서 문서를 로드할 수 없습니다.\n"
            "인덱싱을 다시 실행하세요:\n"
            "  python reindex_bge.py"
        )
    
    reranker = CrossEncoderReranker(model_name="mixedbread-ai/mxbai-rerank-large-v1")
    hybrid_retriever = HybridRetriever(
        chroma_store=chroma,
        initial_documents=existing_docs,
        embedding_k=EVAL_EMBEDDING_TOP_K,
        bm25_k=EVAL_BM25_TOP_K,
        final_k=EVAL_FINAL_TOP_K,
        embedding_weight=0.65,
        bm25_weight=0.35,
        reranker=reranker,
    )
    return hybrid_retriever


def fetch_answer(question: str) -> str:
    payload = {"post_id": "default", "question": question}
    response = requests.post(CHAT_ENDPOINT, json=payload, timeout=120)
    response.raise_for_status()
    data = response.json()
    return data.get("answer", "")


def main():
    questions = load_questions()
    retriever = build_retriever()

    records: List[EvaluationRecord] = []

    total_metrics = {
        "faithfulness": 0.0,
        "answer_relevancy": 0.0,
        "context_precision": 0.0,
        "context_recall": 0.0,
    }
    answered = 0

    for idx, item in enumerate(questions, start=1):
        print(f"[{idx}/{len(questions)}] 질문: {item.question}")

        try:
            docs = retriever.get_relevant_documents(
                item.question,
                final_k=EVAL_FINAL_TOP_K,
            )
            if len(docs) == 0:
                print(f"  ⚠️ 검색된 문서가 없습니다 (질문: '{item.question}')")
        except Exception as exc:
            print(f"  ❌ 컨텍스트 검색 실패: {exc}")
            import traceback
            traceback.print_exc()
            docs = []

        contexts = []
        total_length = 0
        for doc in docs:
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
            snippet_body = content[:500]
            snippet = "\n".join(snippet_header + [snippet_body])
            if total_length + len(snippet) > 1200:
                break
            contexts.append(snippet)
            total_length += len(snippet)

        try:
            answer = fetch_answer(item.question)
        except Exception as exc:
            print(f"  ❌ 답변 생성 실패: {exc}")
            answer = ""

        if not answer:
            print("  ⚠️ 빈 응답")
            records.append(
                EvaluationRecord(
                    question=item.question,
                    category=item.category,
                    answer=answer,
                    contexts=contexts,
                    metrics={
                        "faithfulness": 0.0,
                        "answer_relevancy": 0.0,
                        "context_precision": 0.0,
                        "context_recall": 0.0,
                    },
                )
            )
            continue

        answered += 1

        faithfulness = calculate_faithfulness(answer, contexts)
        answer_relevancy = calculate_answer_relevancy(answer, item.question)
        context_precision = calculate_context_precision(contexts, item.question)
        context_recall = calculate_context_recall(contexts, item.question)

        print(
            f"  ✓ Faithfulness={faithfulness:.3f}, "
            f"AnswerRelevancy={answer_relevancy:.3f}, "
            f"ContextPrecision={context_precision:.3f}, "
            f"ContextRecall={context_recall:.3f}"
        )

        total_metrics["faithfulness"] += faithfulness
        total_metrics["answer_relevancy"] += answer_relevancy
        total_metrics["context_precision"] += context_precision
        total_metrics["context_recall"] += context_recall

        records.append(
            EvaluationRecord(
                question=item.question,
                category=item.category,
                answer=answer,
                contexts=contexts,
                metrics={
                    "faithfulness": faithfulness,
                    "answer_relevancy": answer_relevancy,
                    "context_precision": context_precision,
                    "context_recall": context_recall,
                },
            )
        )

    summary = {
        "evaluation_time": datetime.now().isoformat(timespec="seconds"),
        "question_count": len(questions),
        "answered_count": answered,
        "average_metrics": {
            "faithfulness": total_metrics["faithfulness"] / answered if answered else 0.0,
            "answer_relevancy": total_metrics["answer_relevancy"] / answered if answered else 0.0,
            "context_precision": total_metrics["context_precision"] / answered if answered else 0.0,
            "context_recall": total_metrics["context_recall"] / answered if answered else 0.0,
        },
        "records": [asdict(record) for record in records],
    }

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = RESULT_DIR / f"ragas_eval_bge_m3_{timestamp}.json"
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print("\n=== 평가 요약 ===")
    print(f"- 질문 수: {len(questions)}")
    print(f"- 답변 성공: {answered}")
    print(f"- 평균 Faithfulness: {summary['average_metrics']['faithfulness']:.3f}")
    print(f"- 평균 Answer Relevancy: {summary['average_metrics']['answer_relevancy']:.3f}")
    print(f"- 평균 Context Precision: {summary['average_metrics']['context_precision']:.3f}")
    print(f"- 평균 Context Recall: {summary['average_metrics']['context_recall']:.3f}")
    print(f"\n결과 파일: {output_path}")


if __name__ == "__main__":
    main()

