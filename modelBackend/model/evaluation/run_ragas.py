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
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import List
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
import requests
import chromadb
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

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

EMBEDDING_MODEL_NAME = "BAAI/bge-m3"
RETRIEVER_K = 3


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
def load_questions() -> List[QuestionItem]:
    cpp_questions = [
        "C++에서 STL Vector Container 사용법은?",
        "C++에서 클래스(Class) 사용법은?",
        "C++에서 생성자(Constructor) 사용법은?",
        "C++에서 포인터란 무엇인가?",
        "C++에서 strcpy, strlen, strcmp 함수 사용법은?",
        "프로그래머스 기능개발 문제 C++로 어떻게 풀어야 하나?",
        "프로그래머스 위장 문제 C++로 어떻게 풀어야 하나?",
        "프로그래머스 폰켓몬 문제 C++로 어떻게 풀어야 하나?",
        "프로그래머스 신규 아이디 추천 문제 C++로 어떻게 풀어야 하나?",
        "프로그래머스 키패드 누르기 문제 C++로 어떻게 풀어야 하나?",
    ]

    js_questions = [
        "JavaScript에서 생성자 함수 사용법은?",
        "JavaScript에서 화살표 함수(arrow function) 사용법은?",
        "JavaScript에서 객체 리터럴 사용법은?",
        "JavaScript에서 콜백 함수란 무엇인가?",
        "JavaScript에서 Logical Operator && || 사용법은?",
        "Vue.js에서 Composition API v-for 사용법은?",
        "Vue.js3 완벽가이드는 어떤 내용인가?",
    ]

    csharp_questions = [
        "C#에서 솔루션과 프로젝트 구성 방법은?",
        "C#에서 클래스(class) 사용법은?",
        "C#에서 new 연산자 사용법은?",
        "C#에서 프로퍼티(Property) 사용법은?",
        "C#에서 get/set 함수 사용법은?",
        "C#에서 생성자와 this 키워드 사용법은?",
        "C#에서 델리게이트(Delegate) 사용법은?",
        "C#에서 콜백함수(CallBack) 사용법은?",
    ]

    flutter_questions = [
        "Flutter에서 runApp과 main.dart 사용법은?",
        "Flutter에서 copyWith Method 사용법은?",
        "Flutter에서 Intl 다국어화 패키지 사용법은?",
        "Flutter에서 캘린더 언어 설정 방법은?",
        "Dart & Flutter 웹 온라인 IDE 사용법은?",
        "DartPad와 FlutLab 사용법은?",
    ]

    dataset: List[QuestionItem] = []
    dataset.extend(QuestionItem(q, "C++") for q in cpp_questions)
    dataset.extend(QuestionItem(q, "JavaScript") for q in js_questions)
    dataset.extend(QuestionItem(q, "C#") for q in csharp_questions)
    dataset.extend(QuestionItem(q, "Flutter") for q in flutter_questions)
    return dataset


# ----- 메트릭 계산 유틸 -----
def tokenize(text: str) -> set[str]:
    return set(
        token.lower()
        for token in text.replace("\n", " ").split(" ")
        if token.strip()
    )


def calculate_faithfulness(answer: str, contexts: List[str]) -> float:
    if not answer or not contexts:
        return 0.0

    answer_tokens = tokenize(answer)
    context_tokens: set[str] = set()
    for ctx in contexts:
        context_tokens.update(tokenize(ctx))

    if not answer_tokens:
        return 0.0

    overlap = len(answer_tokens & context_tokens)
    score = overlap / len(answer_tokens)
    return min(score, 1.0)


def calculate_answer_relevancy(answer: str, question: str) -> float:
    question_tokens = tokenize(question)
    answer_tokens = tokenize(answer)
    if not question_tokens:
        return 0.0
    overlap = len(question_tokens & answer_tokens)
    score = overlap / len(question_tokens)
    return min(score, 1.0)


def calculate_context_precision(contexts: List[str], question: str) -> float:
    if not contexts:
        return 0.0
    question_tokens = tokenize(question)
    relevant = 0
    for ctx in contexts:
        ctx_tokens = tokenize(ctx)
        if ctx_tokens & question_tokens:
            relevant += 1
    return relevant / len(contexts)


def calculate_context_recall(contexts: List[str], question: str) -> float:
    question_tokens = tokenize(question)
    if not question_tokens:
        return 0.0
    covered: set[str] = set()
    for ctx in contexts:
        covered.update(tokenize(ctx))
    overlap = len(covered & question_tokens)
    score = overlap / len(question_tokens)
    return min(score, 1.0)


# ----- 평가 로직 -----
def build_retriever():
    embeddings = HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL_NAME,
        encode_kwargs={"normalize_embeddings": True},
    )
    if USE_CHROMA_HTTP_CLIENT:
        client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    else:
        client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    chroma = Chroma(client=client, embedding_function=embeddings)
    retriever = chroma.as_retriever(
        search_type="similarity",
        search_kwargs={"k": RETRIEVER_K},
    )
    return retriever


def fetch_answer(question: str) -> str:
    payload = {"post_id": "default", "question": question}
    response = requests.post(CHAT_ENDPOINT, json=payload, timeout=60)
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
            docs = retriever.get_relevant_documents(item.question)
        except Exception as exc:
            print(f"  ❌ 컨텍스트 검색 실패: {exc}")
            docs = []

        contexts = []
        total_length = 0
        for doc in docs:
            snippet = (doc.page_content or "").strip()
            if not snippet:
                continue
            snippet = snippet[:400]
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

