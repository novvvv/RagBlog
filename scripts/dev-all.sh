#!/usr/bin/env bash
# 한 번에: Chroma(8001) → chat_server(8002) → Next.js(3000)
# 종료: 터미널에서 Ctrl+C (백그라운드 프로세스도 같이 정리됨)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL_DIR="$ROOT/modelBackend/model"

if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
elif [[ -x "$MODEL_DIR/.venv/bin/python" ]]; then
  PYTHON="$MODEL_DIR/.venv/bin/python"
else
  PYTHON="${PYTHON:-python3}"
fi

CHROMA_PID=""
CHAT_PID=""

cleanup() {
  echo ""
  echo "[dev-all] 종료 중…"
  if [[ -n "$CHAT_PID" ]] && kill -0 "$CHAT_PID" 2>/dev/null; then
    kill "$CHAT_PID" 2>/dev/null || true
    wait "$CHAT_PID" 2>/dev/null || true
  fi
  if [[ -n "$CHROMA_PID" ]] && kill -0 "$CHROMA_PID" 2>/dev/null; then
    kill "$CHROMA_PID" 2>/dev/null || true
    wait "$CHROMA_PID" 2>/dev/null || true
  fi
  echo "[dev-all] 정리 완료"
}

trap cleanup EXIT INT TERM

if ! command -v chroma &>/dev/null; then
  echo "오류: chroma 명령을 찾을 수 없습니다. (pip install chromadb 후 PATH 확인)"
  exit 1
fi

cd "$MODEL_DIR"
echo "[dev-all] Chroma 시작 (8001)…"
chroma run --path ./chroma_db --host 0.0.0.0 --port 8001 &
CHROMA_PID=$!
sleep 2

echo "[dev-all] chat_server 시작 (8002)…"
"$PYTHON" chat_server.py &
CHAT_PID=$!
sleep 4

cd "$ROOT"
echo "[dev-all] Next.js 시작 (3000)…"
echo "[dev-all] 브라우저: http://localhost:3000  |  API: http://localhost:8002"
npm run dev
