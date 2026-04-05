"""
공식 RAGAS 라이브러리를 사용한 RAG 평가 스크립트
-------------------------------------------------
생성 지표
  - Faithfulness / Answer relevancy (ResponseRelevancy)

검색 관련 (Ground Truth 답변 없이 가능한 RAGAS 변형)
  - LLMContextPrecisionWithoutReference : 각 검색 청크가 «생성 답»을 만들 때 유용했는지 (LLM)
  - ContextRelevance (nv_context_relevance) : 질문 대비 검색 컨텍스트 관련도 (LLM)

Ground Truth(reference)가 있을 때 추가
  - ContextRecall : 검색된 컨텍스트가 정답 답(reference)을 얼마나 포괯하는지
  - ContextPrecision : 검색 컨텍스트 중 정답 답에 실제로 유용한 비율

정답 문장은 `golden_references.json`(기본) 또는 환경변수 RAGAS_REFERENCE_JSON 경로의
JSON 배열 [{ "question", "category", "reference" }, ...] 에서 로드합니다.
파일이 없으면 인라인 질문만 사용하며, 위 두 메트릭은 계산하지 않습니다.

사전 준비:
  pip install ragas langchain-openai python-dotenv
  프로젝트 루트 .env 에 OPENAI_API_KEY 설정 (또는 export)
  chroma run --path ./chroma_db --host 0.0.0.0 --port 8001
  python chat_server.py   # FastAPI 서버 (포트 8002)
"""

from __future__ import annotations

import json
import math
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List

WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
EVAL_DIR = Path(__file__).resolve().parent
DEFAULT_GOLDEN_PATH = EVAL_DIR / "golden_references.json"

_CITE_RE = re.compile(r"\s*\[cite:\s*\d+\]", re.IGNORECASE)


def _clean_reference(text: str) -> str:
    """제미나이 등에서 붙은 [cite: N] 마커 제거."""
    return _CITE_RE.sub("", text or "").strip()
try:
    from dotenv import load_dotenv

    load_dotenv(WORKSPACE_ROOT / ".env")
except ImportError:
    pass

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

# ── 설정 ──
RESULT_DIR = WORKSPACE_ROOT / "modelBackend" / "model" / "evaluation" / "results"
RESULT_DIR.mkdir(parents=True, exist_ok=True)

CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8001"))
CHAT_ENDPOINT = os.getenv("CHAT_ENDPOINT", "http://localhost:8002/chat")

EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "mixedbread-ai/mxbai-embed-large-v1")
EVAL_EMBEDDING_TOP_K = int(os.getenv("EVAL_EMBEDDING_TOP_K", "8"))
EVAL_BM25_TOP_K = int(os.getenv("EVAL_BM25_TOP_K", "12"))
EVAL_FINAL_TOP_K = int(os.getenv("EVAL_FINAL_TOP_K", "4"))

OPENAI_MODEL = os.getenv("RAGAS_LLM_MODEL", "gpt-4o-mini")


def _truncate_text(text: str, max_len: int) -> str:
    text = (text or "").strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."


def _row_metric(row, *keys: str, default: float = 0.0) -> float:
    for k in keys:
        if k not in row.index:
            continue
        v = row.get(k)
        if v is None:
            continue
        try:
            x = float(v)
            if math.isnan(x):
                continue
            return x
        except (TypeError, ValueError):
            continue
    return default


RELEVANCY_COL_ALIASES = ("answer_relevancy", "response_relevancy")


# ── 질문셋 ──
@dataclass
class QuestionItem:
    question: str
    category: str
    reference: str = ""


def load_questions() -> List[QuestionItem]:
    """golden_references.json(또는 RAGAS_REFERENCE_JSON)이 있으면 reference 포함 로드."""
    path = Path(os.getenv("RAGAS_REFERENCE_JSON", str(DEFAULT_GOLDEN_PATH)))
    if path.is_file():
        with path.open(encoding="utf-8") as f:
            rows = json.load(f)
        out: List[QuestionItem] = []
        for row in rows:
            ref = _clean_reference(str(row.get("reference", "") or ""))
            out.append(
                QuestionItem(
                    question=row["question"],
                    category=str(row.get("category", "")),
                    reference=ref,
                )
            )
        return out

    # public/novlog 에 색인된 10개 게시글(386, 388, 390, 391, 394, 395, 397, 399, 401, 402) 기준
    questions_data = [
        ("RAGAS로 RAG 파이프라인을 평가할 때 필요한 데이터셋 구성요소와 Ground Truth의 역할은 무엇인가요?", "RAG"),
        ("BOJ 1431처럼 C++에서 sort 비교 함수로 문자열 길이·자릿수 합·사전순 조건을 어떻게 정의하나요?", "Algorithm"),
        ("React에서 state와 일반 변수의 차이는 무엇이며, useState와 useEffect는 각각 어떤 역할인가요?", "React"),
        ("docker exec과 docker run의 차이는 무엇이고, 실행 중인 컨테이너에 명령을 넣을 때 왜 docker exec를 쓰나요?", "Docker"),
        ("JPA Auditing에서 @EnableJpaAuditing과 @EntityListeners(AuditingEntityListener)는 무엇을 하나요?", "JPA"),
        ("JPA에서 BaseTimeEntity로 created_at·updated_at을 한곳에서 관리하는 이유와 리팩터링 포인트는 무엇인가요?", "JPA"),
        ("Spring에서 ResponseEntity란 무엘이며 HttpMessageConverter·상태 코드와 어떻게 연결되나요?", "Spring"),
        ("Spring Security의 UserDetails 인터페이스와 Domain Entity 대신 CustomUserDetails를 쓰는 이유는 무엇인가요?", "SpringSecurity"),
        ("Spring에서 @Configuration이 빈 정의에 주는 역할과 @Value로 외부 설정을 주입하는 방식을 설명해 주세요.", "Spring"),
        ("Jackson의 @JsonProperty는 JSON 직렬화에서 어떤 문제를 해결하고 필드명 매핑에 어떻게 쓰이나요?", "Spring"),
    ]
    return [QuestionItem(question=q, category=c, reference="") for q, c in questions_data]


# ── 검색기 구축 ──
def build_retriever():
    embeddings_model = HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL_NAME,
        model_kwargs={"trust_remote_code": True},
        encode_kwargs={"normalize_embeddings": True},
    )
    client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    db = Chroma(client=client, embedding_function=embeddings_model)
    collection = client.get_collection(name=db._collection.name)
    existing_documents = load_all_documents_from_chroma_collection(collection)
    print(f"Chroma 문서 수: {len(existing_documents)}")

    cross_encoder = CrossEncoderReranker(model_name="mixedbread-ai/mxbai-rerank-large-v1")
    return HybridRetriever(
        chroma_store=db,
        initial_documents=existing_documents,
        embedding_k=EVAL_EMBEDDING_TOP_K,
        bm25_k=EVAL_BM25_TOP_K,
        final_k=EVAL_FINAL_TOP_K,
        embedding_weight=0.65,
        bm25_weight=0.35,
        reranker=cross_encoder,
    )


def fetch_answer(question: str) -> str:
    payload = {"post_id": "default", "question": question}
    timeout = int(os.getenv("CHAT_REQUEST_TIMEOUT", "300"))
    response = requests.post(CHAT_ENDPOINT, json=payload, timeout=timeout)
    response.raise_for_status()
    return response.json().get("answer", "")


def collect_contexts(retriever, question: str) -> List[str]:
    docs = retriever.get_relevant_documents(question, final_k=EVAL_FINAL_TOP_K)
    contexts = []
    total_length = 0
    for doc in docs:
        content = (doc.page_content or "").strip()
        if not content:
            continue
        summary = doc.metadata.get("summary")
        section = doc.metadata.get("section_path")
        parts = []
        if summary:
            parts.append(f"[요약] {summary}")
        if section:
            parts.append(f"[위치] {section}")
        parts.append(content[:500])
        snippet = "\n".join(parts)
        if total_length + len(snippet) > 1200:
            break
        contexts.append(snippet)
        total_length += len(snippet)
    return contexts


# ── 메인 ──
def main():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("OPENAI_API_KEY 환경변수가 필요합니다.")
        sys.exit(1)

    from ragas import SingleTurnSample, EvaluationDataset, evaluate, RunConfig
    from ragas.metrics import (
        ContextPrecision,
        ContextRecall,
        ContextRelevance,
        Faithfulness,
        LLMContextPrecisionWithoutReference,
        ResponseRelevancy,
    )
    from ragas.llms import LangchainLLMWrapper
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings

    evaluator_llm = LangchainLLMWrapper(ChatOpenAI(model=OPENAI_MODEL))
    evaluator_embeddings = LangchainEmbeddingsWrapper(OpenAIEmbeddings())
    faithfulness_metric = Faithfulness(llm=evaluator_llm)
    relevancy_metric = ResponseRelevancy(llm=evaluator_llm, embeddings=evaluator_embeddings)
    ctx_prec_noref = LLMContextPrecisionWithoutReference(llm=evaluator_llm)
    ctx_relevance = ContextRelevance(llm=evaluator_llm)
    ragas_metrics = [
        faithfulness_metric,
        relevancy_metric,
        ctx_prec_noref,
        ctx_relevance,
    ]

    questions = load_questions()
    use_ref_metrics = all((item.reference or "").strip() for item in questions)
    if use_ref_metrics:
        ragas_metrics.extend(
            [
                ContextRecall(llm=evaluator_llm),
                ContextPrecision(llm=evaluator_llm),
            ]
        )
        print(
            "Ground Truth(reference) 로드됨 — ContextRecall, ContextPrecision 포함 "
            f"({os.getenv('RAGAS_REFERENCE_JSON', str(DEFAULT_GOLDEN_PATH))})"
        )
    else:
        print(
            "reference 없음(golden_references.json 없거나 비어 있음) — "
            "ContextRecall/ContextPrecision 생략."
        )

    run_cfg = RunConfig(timeout=120, max_retries=2, max_wait=120, max_workers=2)
    retriever = build_retriever()
    n = len(questions)

    total_faithfulness = 0.0
    total_relevancy = 0.0
    total_ctx_prec = 0.0
    total_ctx_rel = 0.0
    total_ctx_recall = 0.0
    total_ctx_precision = 0.0
    answered = 0
    records_out = []

    for idx, item in enumerate(questions, start=1):
        print(f"[{idx}/{n}] 질문: {item.question}")

        try:
            contexts = collect_contexts(retriever, item.question)
        except Exception as exc:
            print(f"  컨텍스트 검색 실패: {exc}")
            contexts = []

        try:
            answer = fetch_answer(item.question)
        except Exception as exc:
            print(f"  답변 생성 실패: {exc}")
            answer = ""

        if not answer:
            print("  빈 응답 — 건너뜀\n")
            m_empty = {
                "faithfulness": 0.0,
                "answer_relevancy": 0.0,
                "llm_context_precision_without_reference": 0.0,
                "nv_context_relevance": 0.0,
            }
            if use_ref_metrics:
                m_empty["context_recall"] = 0.0
                m_empty["context_precision"] = 0.0
            records_out.append({
                "question": item.question,
                "category": item.category,
                "reference": item.reference if use_ref_metrics else None,
                "answer": "",
                "contexts": contexts,
                "metrics": m_empty,
            })
            continue

        print(f"  답변: {_truncate_text(answer, 200)}")

        sample = SingleTurnSample(
            user_input=item.question,
            response=answer,
            retrieved_contexts=contexts,
            reference=item.reference if use_ref_metrics else None,
        )
        dataset = EvaluationDataset(samples=[sample])
        result = evaluate(
            dataset=dataset,
            metrics=ragas_metrics,
            run_config=run_cfg,
        )
        pdf = result.to_pandas()
        row = pdf.iloc[0]
        fv = _row_metric(row, "faithfulness")
        rv = _row_metric(row, *RELEVANCY_COL_ALIASES)
        cp = _row_metric(row, "llm_context_precision_without_reference")
        cr_rel = _row_metric(row, "nv_context_relevance")
        cr_recall = _row_metric(row, "context_recall") if use_ref_metrics else 0.0
        cp_ref = _row_metric(row, "context_precision") if use_ref_metrics else 0.0

        if use_ref_metrics:
            print(
                f"  faithfulness={fv:.4f}, answer_relevancy={rv:.4f}, "
                f"context_precision_noref={cp:.4f}, context_relevance={cr_rel:.4f}, "
                f"context_recall={cr_recall:.4f}, context_precision={cp_ref:.4f}\n"
            )
        else:
            print(
                f"  faithfulness={fv:.4f}, answer_relevancy={rv:.4f}, "
                f"context_precision_noref={cp:.4f}, context_relevance={cr_rel:.4f}\n"
            )

        total_faithfulness += fv
        total_relevancy += rv
        total_ctx_prec += cp
        total_ctx_rel += cr_rel
        if use_ref_metrics:
            total_ctx_recall += cr_recall
            total_ctx_precision += cp_ref
        answered += 1

        rec_metrics = {
            "faithfulness": fv,
            "answer_relevancy": rv,
            "llm_context_precision_without_reference": cp,
            "nv_context_relevance": cr_rel,
        }
        if use_ref_metrics:
            rec_metrics["context_recall"] = cr_recall
            rec_metrics["context_precision"] = cp_ref

        records_out.append({
            "question": item.question,
            "category": item.category,
            "reference": item.reference if use_ref_metrics else None,
            "answer": answer,
            "contexts": contexts,
            "metrics": rec_metrics,
        })

    avg_f = total_faithfulness / answered if answered else 0.0
    avg_r = total_relevancy / answered if answered else 0.0
    avg_cp = total_ctx_prec / answered if answered else 0.0
    avg_cr_rel = total_ctx_rel / answered if answered else 0.0
    avg_ctx_recall = total_ctx_recall / answered if answered and use_ref_metrics else None
    avg_ctx_precision = total_ctx_precision / answered if answered and use_ref_metrics else None

    metrics_note = (
        "reference(GT)가 있으면 ContextRecall·ContextPrecision(RAGAS 공식, 정답 답 기준) 포함. "
        "항상 LLMContextPrecisionWithoutReference, ContextRelevance 포함."
    )
    if not use_ref_metrics:
        metrics_note += " 현재 실행은 golden_references 없이 질문만 사용했습니다."

    average_metrics = {
        "faithfulness": avg_f,
        "answer_relevancy": avg_r,
        "llm_context_precision_without_reference": avg_cp,
        "nv_context_relevance": avg_cr_rel,
    }
    if use_ref_metrics and avg_ctx_recall is not None and avg_ctx_precision is not None:
        average_metrics["context_recall"] = avg_ctx_recall
        average_metrics["context_precision"] = avg_ctx_precision

    summary = {
        "evaluation_time": datetime.now().isoformat(timespec="seconds"),
        "evaluation_method": "official_ragas",
        "ragas_llm": OPENAI_MODEL,
        "reference_dataset": str(Path(os.getenv("RAGAS_REFERENCE_JSON", str(DEFAULT_GOLDEN_PATH)))),
        "use_reference_metrics": use_ref_metrics,
        "metrics_note": metrics_note,
        "question_count": n,
        "evaluated_count": answered,
        "average_metrics": average_metrics,
        "records": records_out,
    }

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = RESULT_DIR / f"ragas_official_{timestamp}.json"
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    tail = (
        f"평균 — faithfulness: {avg_f:.4f}, answer_relevancy: {avg_r:.4f}, "
        f"context_precision_noref: {avg_cp:.4f}, context_relevance: {avg_cr_rel:.4f}"
    )
    if use_ref_metrics and avg_ctx_recall is not None and avg_ctx_precision is not None:
        tail += (
            f", context_recall: {avg_ctx_recall:.4f}, context_precision: {avg_ctx_precision:.4f}"
        )
    tail += f"  ({answered}/{n}건)  |  저장: {output_path}"
    print(tail)


if __name__ == "__main__":
    main()
