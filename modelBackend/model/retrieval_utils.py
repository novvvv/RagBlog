from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import torch
from langchain.schema import Document
from langchain_community.retrievers import BM25Retriever
from transformers import AutoModelForSequenceClassification, AutoTokenizer


@dataclass
class RankedDocument:
    document: Document
    score: float


class CrossEncoderReranker:
    """
    BAAI/bge-reranker-base 기반 Cross-Encoder 재정렬기.
    검색된 후보 문서를 입력으로 받아 질문과의 관련도를 산출합니다.
    """

    def __init__(
        self,
        model_name: str = "BAAI/bge-reranker-base",
        device: Optional[torch.device | str] = None,
        max_length: int = 512,
    ) -> None:
        resolved_device: str
        if device is None:
            resolved_device = (
                "cuda"
                if torch.cuda.is_available()
                else "mps"
                if torch.backends.mps.is_available()
                else "cpu"
            )
        else:
            resolved_device = str(device)

        self.device = torch.device(resolved_device)
        self.max_length = max_length
        self.tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            model_name,
            trust_remote_code=True,
        ).to(self.device)
        self.model.eval()

    def rerank(
        self,
        query: str,
        documents: Sequence[Document],
        top_k: int,
    ) -> List[RankedDocument]:
        if not documents:
            return []

        pairs = [(query, doc.page_content) for doc in documents]
        inputs = self.tokenizer(
            pairs,
            padding=True,
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt",
        )
        inputs = {key: value.to(self.device) for key, value in inputs.items()}

        with torch.no_grad():
            logits = self.model(**inputs).logits.squeeze(-1)

        scores = logits.detach().cpu().tolist()
        ranked_indices = sorted(
            range(len(documents)),
            key=lambda idx: scores[idx],
            reverse=True,
        )[:top_k]

        return [
            RankedDocument(document=documents[idx], score=float(scores[idx]))
            for idx in ranked_indices
        ]


class HybridRetriever:
    """
    Chroma 임베딩 검색 + BM25 키워드 검색을 결합한 하이브리드 검색기.
    필요 시 Cross-Encoder 재정렬기를 통해 최종 문서 순위를 계산합니다.
    """

    def __init__(
        self,
        *,
        chroma_store,
        initial_documents: Optional[Sequence[Document]] = None,
        embedding_k: int = 8,
        bm25_k: int = 12,
        final_k: int = 4,
        embedding_weight: float = 0.6,
        bm25_weight: float = 0.4,
        reranker: Optional[CrossEncoderReranker] = None,
    ) -> None:
        self._lock = threading.RLock()
        self.chroma_store = chroma_store
        self.embedding_k = embedding_k
        self.bm25_k = bm25_k
        self.final_k = final_k
        self.embedding_weight = embedding_weight
        self.bm25_weight = bm25_weight
        self.reranker = reranker

        self._bm25_retriever: Optional[BM25Retriever] = None
        self._known_chunk_ids: Dict[str, bool] = {}

        if initial_documents:
            self._initialize_bm25(initial_documents)

    # ------------------------------------------------------------------ #
    # 초기화 / 추가
    # ------------------------------------------------------------------ #
    def _initialize_bm25(self, documents: Sequence[Document]) -> None:
        with self._lock:
            self._bm25_retriever = BM25Retriever.from_documents(list(documents))
            self._known_chunk_ids = {}
            for doc in documents:
                chunk_id = doc.metadata.get("chunk_id")
                if chunk_id:
                    self._known_chunk_ids[chunk_id] = True

    def add_documents(self, documents: Sequence[Document]) -> None:
        """
        새로운 문서를 BM25 인덱스에 추가합니다.
        BM25Retriever는 add_documents를 지원하지 않으므로,
        ChromaDB에서 전체 문서를 다시 로드하여 인덱스를 재구성합니다.
        """
        if not documents:
            return
        with self._lock:
            if self._bm25_retriever is None:
                # BM25 인덱스가 없으면 새로 생성
                self._bm25_retriever = BM25Retriever.from_documents(list(documents))
                self._known_chunk_ids = {}
                for doc in documents:
                    chunk_id = doc.metadata.get("chunk_id")
                    if chunk_id:
                        self._known_chunk_ids[chunk_id] = True
            else:
                # ChromaDB에서 전체 문서 다시 로드
                try:
                    collection = self.chroma_store._collection
                    all_docs = load_all_documents_from_chroma_collection(collection)
                    
                    # BM25 인덱스 재구성
                    self._bm25_retriever = BM25Retriever.from_documents(all_docs)
                    
                    # chunk_id 추적 업데이트
                    self._known_chunk_ids = {}
                    for doc in all_docs:
                        chunk_id = doc.metadata.get("chunk_id")
                        if chunk_id:
                            self._known_chunk_ids[chunk_id] = True
                except Exception as e:
                    # ChromaDB에서 로드 실패 시 새 문서만으로 인덱스 재구성
                    # (성능 저하 가능하지만 오류 방지)
                    import warnings
                    warnings.warn(f"BM25 인덱스 재구성 실패, 새 문서만 사용: {e}")
                    self._bm25_retriever = BM25Retriever.from_documents(list(documents))
                    self._known_chunk_ids = {}
                    for doc in documents:
                        chunk_id = doc.metadata.get("chunk_id")
                        if chunk_id:
                            self._known_chunk_ids[chunk_id] = True

    def rebuild_from_documents(self, documents: Sequence[Document]) -> None:
        self._initialize_bm25(list(documents))

    # ------------------------------------------------------------------ #
    # 내부 검색 헬퍼
    # ------------------------------------------------------------------ #
    def _embedding_candidates(
        self,
        query: str,
        *,
        post_id: Optional[str],
    ) -> List[Tuple[Document, float]]:
        where_filter = {"post_id": post_id} if post_id else None
        try:
            results = self.chroma_store.similarity_search_with_relevance_scores(
                query,
                k=self.embedding_k,
                filter=where_filter,
            )
        except Exception:
            docs = self.chroma_store.similarity_search(
                query,
                k=self.embedding_k,
                filter=where_filter,
            )
            results = [
                (doc, 1.0 - (idx / max(len(docs), 1)))
                for idx, doc in enumerate(docs)
            ]
        return list(results)

    def _bm25_candidates(
        self,
        query: str,
        *,
        post_id: Optional[str],
    ) -> List[Tuple[Document, float]]:
        with self._lock:
            if self._bm25_retriever is None:
                return []
            docs = self._bm25_retriever.get_relevant_documents(query)

        filtered: List[Tuple[Document, float]] = []
        for doc in docs:
            if post_id and doc.metadata.get("post_id") != post_id:
                continue
            score = float(doc.metadata.get("score", 0.0))
            filtered.append((doc, score))
            if len(filtered) >= self.bm25_k:
                break

        if not filtered:
            return []

        scores = [score for _, score in filtered]
        min_score, max_score = min(scores), max(scores)
        if max_score == min_score:
            normalized = [(doc, 1.0) for doc, _ in filtered]
        else:
            normalized = [
                (doc, (score - min_score) / (max_score - min_score))
                for doc, score in filtered
            ]
        return normalized

    # ------------------------------------------------------------------ #
    # 메인 검색
    # ------------------------------------------------------------------ #
    def get_relevant_documents(
        self,
        query: str,
        *,
        post_id: Optional[str] = None,
        final_k: Optional[int] = None,
    ) -> List[Document]:
        target_k = final_k or self.final_k

        embedding_results = self._embedding_candidates(query, post_id=post_id)
        bm25_results = self._bm25_candidates(query, post_id=post_id)

        combined: Dict[str, Dict[str, float]] = {}
        documents: Dict[str, Document] = {}

        def _register(doc: Document, key: str, kind: str, value: float) -> None:
            if key not in combined:
                combined[key] = {"embedding": 0.0, "bm25": 0.0}
            combined[key][kind] = max(combined[key][kind], value)
            documents[key] = doc

        for rank, (doc, score) in enumerate(embedding_results):
            chunk_id = doc.metadata.get("chunk_id") or f"embed_{rank}"
            normalized = score if score is not None else 0.0
            _register(doc, chunk_id, "embedding", normalized)

        for doc, score in bm25_results:
            chunk_id = doc.metadata.get("chunk_id") or doc.metadata.get("id")
            if not chunk_id:
                chunk_id = f"bm25_{len(combined)}"
            _register(doc, chunk_id, "bm25", score)

        if not combined:
            return []

        ranked_docs: List[Tuple[str, float]] = []
        for chunk_id, scores in combined.items():
            embedding_score = scores.get("embedding", 0.0)
            bm25_score = scores.get("bm25", 0.0)
            final_score = (
                self.embedding_weight * embedding_score
                + self.bm25_weight * bm25_score
            )
            ranked_docs.append((chunk_id, final_score))

        ranked_docs.sort(key=lambda item: item[1], reverse=True)
        candidates: List[Document] = [
            documents[chunk_id] for chunk_id, _ in ranked_docs
        ]

        if self.reranker:
            reranked = self.reranker.rerank(query, candidates, top_k=target_k)
            return [item.document for item in reranked]

        return candidates[:target_k]


def build_documents_from_raw(
    raw_documents: Iterable[str],
    raw_metadatas: Iterable[Dict],
) -> List[Document]:
    documents: List[Document] = []
    for text, metadata in zip(raw_documents, raw_metadatas):
        documents.append(Document(page_content=text, metadata=dict(metadata or {})))
    return documents


def load_all_documents_from_chroma_collection(collection) -> List[Document]:
    """
    Chroma Collection 객체에서 모든 Document/Metadata를 가져와 Document 리스트로 반환.
    """
    raw = collection.get(include=["documents", "metadatas"])
    documents = raw.get("documents", [])
    metadatas = raw.get("metadatas", [{} for _ in range(len(documents))])
    return build_documents_from_raw(documents, metadatas)

