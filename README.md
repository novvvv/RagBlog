<div align="center">

**한국어** | [日本語](README.ja.md)

# RagBlog

**HTML 구조를 고려한 계층적 청킹 + 하이브리드 검색 기반 한국어 기술 블로그 RAG 챗봇**

_Optimizing Korean Tech RAG Performance via HTML-Aware Hierarchical Chunking and Hybrid Search_

블로그에 글을 올리면 자동으로 색인되고, 독자는 글을 읽다가 바로 질문할 수 있는 **RAG 내장형 기술 블로그**입니다.
코드 블록·표·헤더 구조를 보존하는 전처리와 BM25 + Dense + Cross-Encoder 재정렬 파이프라인으로,
**1.2B 경량 오픈소스 모델만으로 GPT-4o와 대등한 답변 품질**을 달성했습니다.

📄 [논문 (paper.pdf)](docs/paper.pdf) · 🖼️ [포스터 (poster.pdf)](docs/poster.pdf)

</div>

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [문제 정의](#2-문제-정의)
3. [시스템 아키텍처](#3-시스템-아키텍처)
4. [핵심 설계](#4-핵심-설계)
5. [평가 체계](#5-평가-체계-ragas-evaluation-framework)
6. [실험 결과](#6-실험-결과)
7. [기술 스택](#7-기술-스택)
8. [프로젝트 구조](#8-프로젝트-구조)
9. [실행 방법](#9-실행-방법)
10. [한계 및 향후 과제](#10-한계-및-향후-과제)

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|---|---|
| **핵심 성과** | Answer Relevancy **0.749 → 0.848 (+13.2%)**, Faithfulness **0.747 → 0.851** (RAGAS) |
| **데모** | 게시글 375개 → 청크 3,217개 색인, 글 상세 페이지 내 실시간 Q&A 챗봇 |

### 왜 만들었나

기술 블로그는 기업과 개발자의 **지식 자산**이지만, 검색 패러다임이 SEO에서 **GEO(Generative Engine Optimization)** 로 이동하면서 "AI가 인용하기 좋은 구조화된 콘텐츠"의 가치가 급부상했습니다. (AI 엔진 기반 유입 트래픽 YoY +4,700%, Adobe Digital Insights)

그런데 기존 RAG 방식을 한국어 기술 블로그에 그대로 적용하면 **코드 블록이 잘리고 표가 깨져** 답변 신뢰도가 떨어집니다. 이 프로젝트는 그 문제를 **전처리 단계에서** 해결하고, 새 글이 올라올 때마다 **자동으로 색인**되는 실서비스형 파이프라인을 구축했습니다.

---

## 2. 문제 정의

| 기존 방식의 한계 | 본 프로젝트의 접근 |
|---|---|
| `RecursiveCharacterTextSplitter` 단순 분할 → `<pre>`, `<table>` 중간이 잘려 문맥 파괴 | **특수 블록(코드·표)을 먼저 분리**한 뒤 텍스트만 계층적으로 청킹 |
| HtmlRAG 등 최신 연구는 영어 일반 웹 문서 중심 | **한국어 기술 블로그 도메인**에 특화된 전처리 + 임베딩/LLM 선정 |
| 고유 명사·기술 용어(예: `@EnableJpaAuditing`)에 Dense 검색이 약함 | **BM25 + Dense 가중 융합** 후 **Cross-Encoder 재정렬** |
| 새 글이 올라와도 색인이 갱신되지 않음 | 게시글 저장 시 **FastAPI `/index`로 즉시 색인** (자동화) |

---

## 3. 시스템 아키텍처

### 3.1 3단계 처리 전략

![Stage 01 소스코드·표 격리 / Stage 02 헤더 기반 계층 청킹 / Stage 03 하이브리드 재정렬](docs/images/method_stages.png)

| Stage | 무엇을 | 왜 |
|---|---|---|
| **01 소스코드 · 표 격리** | BeautifulSoup으로 `<pre>`, `<table>`을 본문에서 선제 분리 | 분할 과정에서 코드/표가 잘려 구조가 훼손되는 것을 원천 차단 |
| **02 헤더 기반 계층 청킹** | H1~H4 구조로 1차 분할 후 400자 단위 2차 분할, 각 청크에 상위 경로(`section_path`) 메타데이터 주입 | 문맥 단절 방지 + 검색 결과가 문서 내 어디에 위치하는지 LLM이 인지 |
| **03 하이브리드 재정렬** | 키워드(BM25)와 의미(Dense) 가중 스코어 결합 → Cross-Encoder로 컨텍스트 정제 | 기술 용어 정확 매칭과 의미 유사도를 상호 보완, 최종 Top-K 순도 확보 |

### 3.2 두 개의 파이프라인

![추론 파이프라인과 색인 파이프라인](docs/images/pipeline_all.png)

**① 추론 파이프라인 (Inference)** — 사용자가 글을 읽다가 질문하면 실시간으로 답변합니다.

| 단계 | 컴포넌트 | 포트 | 역할 |
|---|---|:---:|---|
| 1 | Next.js Chat UI | 3000 | 글 상세 페이지 내 챗 인터페이스, 질문 입력 |
| 2 | FastAPI Gateway | 8002 | `POST /chat` — `post_id` 유무에 따라 글 범위 / 전체 검색 분기 |
| 3 | ChromaDB 검색 | 8001 | Dense(Top-8) + BM25(Top-12) 하이브리드 검색 |
| 4 | Hybrid Reranker | — | `mxbai-rerank-large-v1` Cross-Encoder로 Top-4 정제 |
| 5 | 답변 생성 | — | EXAONE-4.0-1.2B (기본) 또는 OpenAI GPT-4o |

**② 색인 파이프라인 (Ingestion)** — 게시글이 저장되면 사용자 응답을 막지 않고 백그라운드로 색인합니다.

| 단계 | 컴포넌트 | 역할 |
|---|---|---|
| 1 | MongoDB 원천 | 원본 게시글(HTML) 및 유저 댓글 데이터 |
| 2 | 색인 엔진 (`/index`) | BS4 코드/표 격리 + H1~H4 계층 청킹 + 청크별 메타데이터(`post_id`, `chunk_type`, `section_path`, `summary`) 부여 |
| 3 | ChromaDB 적재 | `mxbai-embed-large-v1` 임베딩 벡터 및 계층 구조 메타데이터 영속화, BM25 인덱스 동시 갱신 |

### 3.3 런타임 구성

- **Next.js (3000)** — 블로그 UI, 글 CRUD, NextAuth 인증, 글 상세 페이지 내 챗봇 컴포넌트
- **FastAPI (8002)** — `/index`(색인), `/chat`(RAG 응답). LLM·임베딩·리랭커를 프로세스 내 상주 로드
- **ChromaDB (8001)** — HTTP 서버 모드로 분리 운영, 재시작에도 인덱스 유지
- **MongoDB** — 게시글/댓글 원본, NextAuth 세션 어댑터

---

## 4. 핵심 설계

### 4.1 HTML 구조 기반 계층적 청킹

```
HTML 원문
 ├─ [1] BeautifulSoup: 불필요 태그 제거 + <pre>/<table> 블록 분리 → chunk_type = code | table
 ├─ [2] HTMLHeaderTextSplitter: h1~h4 헤더 기준 1차 분할 → section_path 메타데이터 부여
 └─ [3] RecursiveCharacterTextSplitter: 400자 / 오버랩 100자 2차 분할
         └─ 각 청크에 post_id · chunk_type · section_path · summary 메타데이터 주입
```

- 코드/표는 **하나의 청크로 온전히 보존** → "예제 코드 보여줘" 류 질문에서 잘린 코드가 나오지 않음
- `section_path`(예: `H2: JPA Auditing > H3: BaseTimeEntity`)를 컨텍스트에 함께 주입해 LLM이 **문서 내 위치를 인지**
- 청크 크기는 200/400/800자 실험 결과 **400자**가 문맥 유지와 정밀도의 균형점

### 4.2 하이브리드 검색 + Cross-Encoder 재정렬

| 단계 | 구현 | 역할 |
|---|---|---|
| Dense | `mixedbread-ai/mxbai-embed-large-v1` + ChromaDB | 의미적 유사도 |
| Sparse | BM25 (in-memory, 색인 시 갱신) | 기술 용어·고유명사 정확 매칭 |
| 융합 | `0.65 × Dense + 0.35 × BM25` (0.5~0.7 구간 튜닝) | 상호 보완 |
| 재정렬 | `mixedbread-ai/mxbai-rerank-large-v1` Cross-Encoder | 최종 Top-4 정제 |

### 4.3 자동화된 색인 파이프라인

`pages/api/post/new.js`에서 MongoDB 저장 직후 **비동기로 `/index`를 호출**해 사용자 응답을 막지 않으면서 색인합니다. `/index`는 ChromaDB 적재 후 BM25 인덱스까지 함께 갱신하므로 새 글이 **즉시 하이브리드 검색에 반영**됩니다.

### 4.4 질의 범위 분기와 폴백

`/chat`은 `post_id`가 있으면 해당 글 범위로, 없으면(전역 챗) 전체 컬렉션에서 검색합니다. 검색 결과가 비어 있으면(인덱스 없음·매칭 없음) 일반 대화 모드로 폴백해 서비스가 끊기지 않도록 했습니다.

---

## 5. 평가 체계 (RAGAS Evaluation Framework)

RAG 시스템의 생성 품질을 다각도로 검증하기 위해 **RAGAS**의 Generation 지표 두 가지를 핵심 지표로 사용했습니다.

![RAGAS Faithfulness / Answer Relevancy 정의](docs/images/ragas_metrics.png)

| 지표 | 측정 대상 | 계산 방식 | 의미 |
|---|---|---|---|
| **Faithfulness** | 답변이 주어진 컨텍스트의 사실에 부합하는가 | 답변 내 전체 진술 수 대비 문맥에서 추론 가능한 진술 수 | **환각(Hallucination) 억제** — 시스템이 지식을 위조하지 않는지 |
| **Answer Relevancy** | 답변이 사용자의 질문 취지에 직접적으로 부합하는가 | 답변으로 역생성한 질문 q_i와 원 질문 q의 코사인 유사도 평균 | **질문 의도 부합** — 정보의 정확성보다 "물어본 것에 답했는가" |

### 5.1 평가 데이터셋 구성

실제 사용자 의도가 담긴 댓글·Q&A 데이터를 우선 반영하고, 다양성 확보를 위해 Gemini 3.0 Pro로 합성 질의를 병행 생성한 뒤 연구자가 직접 검수해 최종 **20문항**을 확정했습니다.

![평가 질의 출처 및 유형 분포](docs/images/eval_dataset.png)

- **질의 출처**: 블로그 댓글·Q&A 6 · 기타 실사용자 질의 4 · Gemini 3.0 Pro 합성 10
- **질의 유형**: Code-related 10 · Explanation 7 · Troubleshooting 2 · Configuration 1
- **코퍼스**: 프로그래밍 기술 블로그 포스트 375개 → 3,217 청크
- 평가 셋은 `modelBackend/model/evaluation/golden_references.json`, 실행은 `run_ragas*.py`로 재현 가능

---

## 6. 실험 결과

### 6.1 Retrieval 방식 비교 — 하이브리드 + 리랭커의 효과

Dense 단독 → BM25 가중 융합 → Cross-Encoder 재정렬 순으로 검색 전략을 누적 적용하며 RAGAS 점수를 비교했습니다.

![Retrieval 방식 RAGAS 비교 평가](docs/images/eval_retrieval.png)

| Retrieval | Faithfulness | Answer Relevancy |
|---|:---:|:---:|
| Dense Retrieval (단독 기본형) | 0.746 | 0.749 |
| Hybrid Retrieval (가중 융합형) | 0.777 | 0.796 |
| **Hybrid Reranker (본 연구 제안형)** | **0.794** | **0.848** |

> BM25와 Dense 스코어를 가중 융합한 뒤 Cross-Encoder Reranker를 거치는 제안 파이프라인이, 단순 Dense 단독 방식 대비 **Answer Relevancy +13.2%** 의 명확한 성능 향상을 입증했습니다.

### 6.2 LLM 모델별 성능 비교 — 경량 모델로 상용급 품질

정제된 HTML 청킹 기반 파이프라인을 고정한 채, 최종 생성부 LLM만 교체해 아키텍처의 실효성을 검증했습니다.

![LLM 모델별 성능 비교 평가](docs/images/eval_llm.png)

| 최종 생성 LLM | 파라미터 규모 | Faithfulness | Answer Relevancy |
|---|---|:---:|:---:|
| **EXAONE-4.0-1.2B (본 최적화 파이프라인 결합형)** | **1.2B · 경량 오픈소스** | **0.801** | **0.874** |
| GPT-4o-mini (Vanilla) | Commercial Mid Scale | 0.802 | 0.877 |
| GPT-4o (Vanilla) | Commercial Large Scale | 0.812 | 0.879 |

> **학술적 시사점** — 1.2B 초경량 오픈소스 모델에 본 최적화 파이프라인을 결합하면, 수백 배 더 큰 상용 거대 모델(GPT-4o)과 **통계적으로 대등한 수준의 생성 품질**을 달성해 인프라 비용을 혁신적으로 절감할 수 있습니다.

### 6.3 청킹 전략 비교

| 청킹 전략 | Faithfulness | Answer Relevancy |
|---|:---:|:---:|
| 단순 분할 (Baseline, RecursiveCharacterTextSplitter) | 0.832 | 0.843 |
| **HTML 계층적 청킹 (Proposed)** | **0.852** | **0.848** |

### 6.4 임베딩 모델 비교

| 모델 | Faithfulness | Answer Relevancy |
|---|:---:|:---:|
| BGE-M3 | 0.849 | 0.846 |
| nomic-embed-text | 0.834 | 0.847 |
| **mxbai-embed-large-v1 (채택)** | **0.851** | 0.844 |

### 6.5 하이퍼파라미터 탐색

| 파라미터 | 탐색 범위 | 채택 | 근거 |
|---|---|---|---|
| 청크 크기 | 200 / 400 / 800자 | **400 (오버랩 100)** | 200은 문맥 손실, 800은 정밀도 저하 |
| 하이브리드 가중치 | Dense 0.5 ~ 0.7 | **0.65 / 0.35** | 최고 RAGAS 점수 |
| Top-K | Dense 8 · BM25 12 → 최종 4 | — | 리랭커 입력 충분성 + 컨텍스트 길이 균형 |

---

## 7. 기술 스택

| 영역 | 기술 |
|---|---|
| **Frontend** | Next.js 14 (App Router + Pages API), React 18, Tailwind CSS 4, react-markdown, react-syntax-highlighter |
| **Auth / DB** | NextAuth 4 + MongoDB Adapter, MongoDB, AWS S3 (이미지 업로드) |
| **RAG Backend** | Python, FastAPI, LangChain, BeautifulSoup4 |
| **Vector / Search** | ChromaDB (HTTP server), BM25, `mxbai-embed-large-v1`, `mxbai-rerank-large-v1` |
| **LLM** | `LGAI-EXAONE/EXAONE-4.0-1.2B` (HuggingFace Transformers, bf16), OpenAI GPT-4o (비교군) |
| **Evaluation** | RAGAS, Gemini 3.0 Pro (합성 질의 생성) |

---

## 8. 프로젝트 구조

```
RagBlog/
├── app/                          # Next.js App Router
│   ├── components/
│   │   ├── chat/                 #   Chat.js · GlobalChat.js — RAG 챗봇 UI
│   │   ├── home/                 #   RagLanding · RecentPosts
│   │   └── auth/                 #   로그인/로그아웃 버튼
│   ├── detail/[id]/              # 글 상세 + 코드 렌더러 + 댓글 + 챗봇
│   ├── list/, write/, edit/      # 목록 · 작성 · 수정
│   └── words/                    # 용어 사전
├── pages/api/                    # REST API (글 CRUD, 댓글, 이미지)
│   └── post/new.js               #   저장 후 FastAPI /index 자동 호출
├── modelBackend/model/           # Python RAG 백엔드
│   ├── chat_server.py            #   FastAPI: /index, /chat · 청킹 · LLM 로딩
│   ├── retrieval_utils.py        #   HybridRetriever · CrossEncoderReranker
│   ├── reindex_bge.py            #   임베딩 교체 시 전체 재색인
│   ├── html2word.py              #   HTML → 문서 변환 유틸
│   ├── evaluation/
│   │   ├── golden_references.json  # 평가 셋 (질문 · 정답 · 카테고리)
│   │   ├── run_ragas.py            # RAGAS 평가 스크립트
│   │   └── results/                # 평가 결과 JSON (gitignored)
│   └── requirements.txt
├── scripts/dev-all.sh            # Chroma → FastAPI → Next.js 원클릭 실행
└── docs/                         # 논문 · 포스터 · README 도표(images/)
```

---

## 9. 실행 방법

### 9.1 사전 준비

```bash
# Node
npm install

# Python (3.10+ 권장, GPU 없으면 CPU fp32로 자동 폴백)
python -m venv .venv && source .venv/bin/activate
pip install -r modelBackend/model/requirements.txt
```

### 9.2 환경 변수

**루트 `.env.local`** (Next.js)

```env
NEXT_PUBLIC_CHAT_API_URL=http://localhost:8002
ACCESS_KEY=...          # AWS S3
SECRET_KEY=...
BUCKET_NAME=...
```

**`modelBackend/model/.env`** (FastAPI)

```env
LLM_MODEL_ID=LGAI-EXAONE/EXAONE-4.0-1.2B
CHUNK_SIZE=400
CHUNK_OVERLAP=100
EMBEDDING_TOP_K=8
BM25_TOP_K=12
HYBRID_FINAL_K=4
OPENAI_API_KEY=...      # RAGAS 평가 / GPT 비교군 사용 시
```

> `util/database.js`(MongoDB 연결)와 `pages/api/auth/[...nextauth].js`(NextAuth 설정)는 보안상 저장소에서 제외되어 있습니다. 로컬에서 각각 `MONGODB_URI`, OAuth 클라이언트 설정을 추가해 생성하세요.

### 9.3 실행

```bash
# 한 번에 실행 (Chroma 8001 → FastAPI 8002 → Next.js 3000)
./scripts/dev-all.sh
```

개별 실행:

```bash
# 1) Vector DB
cd modelBackend/model && chroma run --path ./chroma_db --host 0.0.0.0 --port 8001

# 2) RAG 서버
cd modelBackend/model && python chat_server.py

# 3) Frontend
npm run dev   # http://localhost:3000
```

### 9.4 평가 재현

```bash
cd modelBackend/model
python evaluation/run_ragas.py            # 제안 파이프라인
python evaluation/run_ragas_official_plain.py   # Baseline 비교
```

---

## 10. 한계 및 향후 과제

| 구분 | 내용 |
|---|---|
| **한계 1** | 평가 셋 20문항 규모로 실제 운영 환경의 다양한 질의 패턴을 완전히 포괄하지 못함 |
| **한계 2** | 정량 지표(RAGAS) 중심 평가로, 사용자가 체감하는 정성적 만족도 검증 미비 |
| **한계 3** | HtmlRAG 등 기존 방법론과의 동일 조건 직접 비교 부재 |
| **향후 1** | 실서비스 배포 후 사용자 로그 기반 Human Eval · Context Precision/Recall 정기 측정 |
| **향후 2** | AI 에이전트(검색 크롤러) 감지 시 정제된 **Markdown을 동적 서빙**하는 GEO 인프라 구축 |
| **향후 3** | 데이터셋 확장을 통한 일반화 성능 검증 및 한국어 웹 환경에서의 검색 알고리즘 한계 분석 |
