"""
HTML 구조 무시·단순 overlap 청킹 전용 RAGAS 평가 (기존 코드 비수정)
================================================================
- chat_server.py 는 건드리지 않습니다.
- 질문·Ground Truth(reference)는 `golden_references.json`(또는 RAGAS_REFERENCE_JSON) —
  run_ragas_official.py 와 동일합니다.
- RAGAS 메트릭도 official 과 동일: Faithfulness, ResponseRelevancy,
  LLMContextPrecisionWithoutReference, ContextRelevance,
  (+ GT 있을 때) ContextRecall, ContextPrecision
- Chroma HTTP 서버(8001)에만 **임시 컬렉션** `ragas_eval_plain_temp` 를 만들었다가 끝에 삭제합니다.
- 본문: HTML → 태그 제거 → RecursiveCharacterTextSplitter(overlap) → 임베딩 → HybridRetriever
- 답변: chat_server 의 RAG 분기와 **동일한 프롬프트·생성 파라미터**로 로컬 LLM(EXAONE 등) 호출
- RAGAS 판정 LLM: OpenAI(gpt-4o-mini 등) — run_ragas_official.py 와 동일

사전 준비:
  chroma run --path ./chroma_db --host 0.0.0.0 --port 8001
  .env 에 OPENAI_API_KEY
  (권장) chat_server 는 끈 상태 — 같은 LLM을 이 스크립트가 다시 로드하므로 VRAM 절약

실행:
  cd modelBackend/model/evaluation && python run_ragas_official_plain.py
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
from typing import Any, List, Tuple

WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
EVAL_DIR = Path(__file__).resolve().parent
DEFAULT_GOLDEN_PATH = EVAL_DIR / "golden_references.json"

_CITE_RE = re.compile(r"\s*\[cite:\s*\d+\]", re.IGNORECASE)


def _clean_reference(text: str) -> str:
    return _CITE_RE.sub("", text or "").strip()


try:
    from dotenv import load_dotenv

    load_dotenv(WORKSPACE_ROOT / ".env")
except ImportError:
    pass

os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

import chromadb
import torch
from bs4 import BeautifulSoup
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

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
HTML_ROOT = WORKSPACE_ROOT / "public" / "novlog"

CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8001"))
PLAIN_COLLECTION = os.getenv("PLAIN_EVAL_CHROMA_COLLECTION", "ragas_eval_plain_temp")

EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "mixedbread-ai/mxbai-embed-large-v1")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "400"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))
SUMMARY_CHAR_LIMIT = int(os.getenv("CHUNK_SUMMARY_LIMIT", "180"))

EVAL_EMBEDDING_TOP_K = int(os.getenv("EVAL_EMBEDDING_TOP_K", "8"))
EVAL_BM25_TOP_K = int(os.getenv("EVAL_BM25_TOP_K", "12"))
EVAL_FINAL_TOP_K = int(os.getenv("EVAL_FINAL_TOP_K", "4"))

OPENAI_MODEL = os.getenv("RAGAS_LLM_MODEL", "gpt-4o-mini")
LLM_MODEL_ID = os.getenv("LLM_MODEL_ID", "LGAI-EXAONE/EXAONE-4.0-1.2B")

TEXT_SPLITTER = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=["\n\n", "\n", " ", ""],
    add_start_index=True,
)


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


def build_post_id(html_path: Path) -> str:
    relative = html_path.relative_to(HTML_ROOT)
    return str(relative.with_suffix("")).replace(os.sep, "__")


def plain_chunk_html(post_id: str, html_content: str) -> List[Document]:
    soup = BeautifulSoup(html_content, "html.parser")
    for tag in soup(["script", "style", "header", "footer", "nav"]):
        tag.decompose()

    title = soup.title.string.strip() if soup.title and soup.title.string else ""
    plain_text = " ".join(soup.get_text(" ", strip=True).split())
    if not plain_text:
        return []

    split_docs = TEXT_SPLITTER.create_documents(
        [plain_text],
        metadatas=[{"title": title}],
    )
    out: List[Document] = []
    for counter, chunk_doc in enumerate(split_docs, start=1):
        chunk_content = chunk_doc.page_content.strip()
        if not chunk_content:
            continue
        chunk_id = f"{post_id}__plain_{counter}"
        meta = {
            "post_id": post_id,
            "chunk_id": chunk_id,
            "chunk_type": "text",
            "title": title,
            "section_path": "",
            "summary": _summarize_text(chunk_content),
            "order": counter,
        }
        out.append(Document(page_content=chunk_content, metadata=meta))
    return out


# chat_server RAG 분기와 동일한 컨텍스트 조립 (700자 스니펫, 총 1200자 상한)
def build_context_block_for_llm(docs: List[Document]) -> Tuple[str, bool]:
    context_texts: List[str] = []
    total_length = 0
    max_context_length = 1200
    for idx, doc in enumerate(docs, start=1):
        content = (doc.page_content or "").strip()
        if not content:
            continue
        section = doc.metadata.get("section_path")
        summary = doc.metadata.get("summary")
        snippet_header: List[str] = []
        if summary:
            snippet_header.append(f"[요약] {summary}")
        if section:
            snippet_header.append(f"[위치] {section}")
        snippet_body = content[:700]
        snippet_parts = snippet_header + [snippet_body]
        snippet = f"[컨텍스트 {idx}]\n" + "\n".join(snippet_parts)
        if len(snippet) < 40:
            continue
        if total_length + len(snippet) > max_context_length:
            break
        context_texts.append(snippet)
        total_length += len(snippet)
    if not context_texts:
        return "", False
    return "\n\n".join(context_texts), True


def build_rag_messages(question: str, context_block: str) -> List[dict]:
    return [
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
                f"=== 질문 ===\n{question}\n\n"
                f"⚠️ 규칙:\n"
                f"1. 위 컨텍스트에 명시된 내용만 사용하세요.\n"
                f"2. 컨텍스트에 없는 정보는 절대 추가하지 마세요.\n"
                f"3. 각 문장 끝에 해당하는 [컨텍스트 n] 번호를 표시하세요.\n"
                f"4. 컨텍스트의 표현을 그대로 사용하세요."
            ),
        },
    ]


def build_fallback_messages(question: str) -> List[dict]:
    return [
        {
            "role": "system",
            "content": (
                "당신은 친절하고 정중한 한국어 어시스턴트입니다. "
                "사용자 질문에 정확하고 간결하게 답변하세요. "
                "블로그 검색 결과가 없으므로, 일반적인 지식으로 도울 수 있는 범위에서 답하세요."
            ),
        },
        {"role": "user", "content": question},
    ]


def load_generation_pipeline() -> Tuple[Any, Any]:
    print(f"로컬 생성 LLM 로딩: {LLM_MODEL_ID} …")
    tokenizer = AutoTokenizer.from_pretrained(LLM_MODEL_ID, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    if torch.cuda.is_available() and torch.cuda.is_bf16_supported():
        target_dtype = torch.bfloat16
    elif torch.cuda.is_available() or torch.backends.mps.is_available():
        target_dtype = torch.float16
    else:
        target_dtype = torch.float32

    model = AutoModelForCausalLM.from_pretrained(
        LLM_MODEL_ID,
        torch_dtype=target_dtype,
        trust_remote_code=True,
    )
    device = torch.device(
        "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
    )
    model = model.to(device)

    pipeline_kwargs = dict(
        model=model,
        tokenizer=tokenizer,
        device=device,
        max_new_tokens=320,
        temperature=0.1,
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
    return tokenizer, llm


def generate_answer(tokenizer, llm_pipe, messages: List[dict], **gen_kwargs) -> str:
    chat_prompt = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    merged = {
        "max_new_tokens": 320,
        "temperature": 0.1,
        "top_p": 0.85,
        "top_k": 40,
        "repetition_penalty": 1.1,
        "do_sample": True,
        "pad_token_id": tokenizer.pad_token_id,
        "eos_token_id": tokenizer.eos_token_id,
        "num_return_sequences": 1,
        "return_full_text": False,
        **gen_kwargs,
    }
    pipeline_only_keys = {"model", "tokenizer", "device", "return_full_text"}
    call_kwargs = {k: v for k, v in merged.items() if k not in pipeline_only_keys}
    outputs = llm_pipe(chat_prompt, **call_kwargs)
    if not outputs:
        return ""
    return (outputs[0].get("generated_text", "") or "").strip()


def answer_from_retriever(
    retriever: HybridRetriever,
    tokenizer,
    llm_pipe,
    question: str,
) -> str:
    docs = retriever.get_relevant_documents(question, post_id=None, final_k=EVAL_FINAL_TOP_K)
    block, ok = build_context_block_for_llm(docs)
    if not ok:
        messages = build_fallback_messages(question)
        return generate_answer(tokenizer, llm_pipe, messages)

    messages = build_rag_messages(question, block)
    return generate_answer(
        tokenizer,
        llm_pipe,
        messages,
        max_new_tokens=320,
        min_new_tokens=80,
        temperature=0.05,
        repetition_penalty=1.15,
    )


# run_ragas_official.py 와 동일한 RAGAS용 컨텍스트 스니펫
def collect_contexts_for_ragas(retriever: HybridRetriever, question: str) -> List[str]:
    docs = retriever.get_relevant_documents(question, final_k=EVAL_FINAL_TOP_K)
    contexts: List[str] = []
    total_length = 0
    for doc in docs:
        content = (doc.page_content or "").strip()
        if not content:
            continue
        summary = doc.metadata.get("summary")
        section = doc.metadata.get("section_path")
        parts: List[str] = []
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


@dataclass
class QuestionItem:
    question: str
    category: str
    reference: str = ""


def load_questions() -> List[QuestionItem]:
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

    data = [
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
    return [QuestionItem(q, c, "") for q, c in data]


def main() -> None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("OPENAI_API_KEY 가 필요합니다.")
        sys.exit(1)

    from ragas import EvaluationDataset, SingleTurnSample, evaluate, RunConfig
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from ragas.llms import LangchainLLMWrapper
    from ragas.metrics import (
        ContextPrecision,
        ContextRecall,
        ContextRelevance,
        Faithfulness,
        LLMContextPrecisionWithoutReference,
        ResponseRelevancy,
    )
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings

    print("=" * 60)
    print("plain 청킹 전용 RAGAS (기본 컬렉션·chat_server 미사용)")
    print("=" * 60)

    client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    try:
        client.delete_collection(name=PLAIN_COLLECTION)
    except Exception:
        pass
    client.get_or_create_collection(name=PLAIN_COLLECTION)

    embeddings_model = HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL_NAME,
        model_kwargs={"trust_remote_code": True},
        encode_kwargs={"normalize_embeddings": True},
    )
    db = Chroma(
        client=client,
        collection_name=PLAIN_COLLECTION,
        embedding_function=embeddings_model,
    )

    html_files = sorted(HTML_ROOT.rglob("*.html"))
    if not html_files:
        print(f"HTML 없음: {HTML_ROOT}")
        sys.exit(1)

    total_chunks = 0
    for html_path in html_files:
        post_id = build_post_id(html_path)
        try:
            raw = html_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            raw = html_path.read_text(encoding="cp949")
        docs = plain_chunk_html(post_id, raw)
        if not docs:
            continue
        db.add_texts(
            texts=[d.page_content for d in docs],
            metadatas=[d.metadata for d in docs],
            ids=[d.metadata["chunk_id"] for d in docs],
        )
        total_chunks += len(docs)

    print(f"plain 청킹 적재 완료: {total_chunks} 청크 → 컬렉션 '{PLAIN_COLLECTION}'")

    collection = client.get_collection(name=PLAIN_COLLECTION)
    existing = load_all_documents_from_chroma_collection(collection)
    cross = CrossEncoderReranker(model_name="mixedbread-ai/mxbai-rerank-large-v1")
    retriever = HybridRetriever(
        chroma_store=db,
        initial_documents=existing,
        embedding_k=EVAL_EMBEDDING_TOP_K,
        bm25_k=EVAL_BM25_TOP_K,
        final_k=EVAL_FINAL_TOP_K,
        embedding_weight=0.65,
        bm25_weight=0.35,
        reranker=cross,
    )

    tokenizer, llm_pipe = load_generation_pipeline()

    evaluator_llm = LangchainLLMWrapper(ChatOpenAI(model=OPENAI_MODEL))
    evaluator_embeddings = LangchainEmbeddingsWrapper(OpenAIEmbeddings())
    faith_m = Faithfulness(llm=evaluator_llm)
    rel_m = ResponseRelevancy(llm=evaluator_llm, embeddings=evaluator_embeddings)
    ctx_prec_noref = LLMContextPrecisionWithoutReference(llm=evaluator_llm)
    ctx_relevance = ContextRelevance(llm=evaluator_llm)
    ragas_metrics = [faith_m, rel_m, ctx_prec_noref, ctx_relevance]

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

    n = len(questions)
    total_f = 0.0
    total_r = 0.0
    total_ctx_prec = 0.0
    total_ctx_rel = 0.0
    total_ctx_recall = 0.0
    total_ctx_precision = 0.0
    answered = 0
    records_out: List[dict] = []

    for idx, item in enumerate(questions, start=1):
        print(f"[{idx}/{n}] 질문: {item.question}")
        try:
            contexts = collect_contexts_for_ragas(retriever, item.question)
        except Exception as exc:
            print(f"  컨텍스트 검색 실패: {exc}")
            contexts = []

        try:
            answer = answer_from_retriever(retriever, tokenizer, llm_pipe, item.question)
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
        ds = EvaluationDataset(samples=[sample])
        result = evaluate(dataset=ds, metrics=ragas_metrics, run_config=run_cfg)
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

        total_f += fv
        total_r += rv
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

    avg_f = total_f / answered if answered else 0.0
    avg_r = total_r / answered if answered else 0.0
    avg_cp = total_ctx_prec / answered if answered else 0.0
    avg_cr_rel = total_ctx_rel / answered if answered else 0.0
    avg_ctx_recall = total_ctx_recall / answered if answered and use_ref_metrics else None
    avg_ctx_precision = total_ctx_precision / answered if answered and use_ref_metrics else None

    metrics_note = (
        "reference(GT)가 있으면 ContextRecall·ContextPrecision 포함. "
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
        "chunking_mode": "plain_text_overlap_only",
        "chroma_collection": PLAIN_COLLECTION,
        "reference_dataset": str(Path(os.getenv("RAGAS_REFERENCE_JSON", str(DEFAULT_GOLDEN_PATH)))),
        "use_reference_metrics": use_ref_metrics,
        "note": "답변=로컬 LLM+plain 인덱스, RAGAS=OpenAI. 기본 blog 컬렉션·chat_server 미변경.",
        "metrics_note": metrics_note,
        "ragas_llm": OPENAI_MODEL,
        "generation_llm": LLM_MODEL_ID,
        "chunk_size": CHUNK_SIZE,
        "chunk_overlap": CHUNK_OVERLAP,
        "total_chunks_indexed": total_chunks,
        "question_count": n,
        "evaluated_count": answered,
        "average_metrics": average_metrics,
        "records": records_out,
    }

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = RESULT_DIR / f"ragas_official_plain_{ts}.json"
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    tail = (
        f"평균 — faithfulness: {avg_f:.4f}, answer_relevancy: {avg_r:.4f}, "
        f"context_precision_noref: {avg_cp:.4f}, context_relevance: {avg_cr_rel:.4f}"
    )
    if use_ref_metrics and avg_ctx_recall is not None and avg_ctx_precision is not None:
        tail += (
            f", context_recall: {avg_ctx_recall:.4f}, context_precision: {avg_ctx_precision:.4f}"
        )
    tail += f"  ({answered}/{n}건)  |  저장: {out_path}"
    print(tail)

    try:
        client.delete_collection(name=PLAIN_COLLECTION)
        print(f"임시 컬렉션 '{PLAIN_COLLECTION}' 삭제 완료")
    except Exception:
        pass


if __name__ == "__main__":
    main()
