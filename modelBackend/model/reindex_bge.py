"""

HTML 목록을 돌며 /index API 호출하는 실행기 

재임베딩 스크립트
------------------
기본: `public/novlog-train-data` 아래 **하위 폴더 포함 전체**(`rglob`) HTML을 읽어 FastAPI `/index`로 전송하여
서버가 사용하는 임베딩 모델(mixedbread-ai/mxbai-embed-large-v1)로 다시 색인합니다.

다른 루트를 쓰려면 환경변수:
  HTML_INDEX_ROOT=/절대/또는/상대/경로

  HTML 

사전 준비:
- `chroma run --path ... --port 8001`으로 ChromaDB 서버 실행
- `python modelBackend/model/chat_server.py`로 FastAPI 서버 실행
"""

from __future__ import annotations

import os
import pathlib
import time
from typing import Iterator

import requests

WORKSPACE_ROOT = pathlib.Path(__file__).resolve().parents[2]
_DEFAULT_HTML = WORKSPACE_ROOT / "public" / "novlog-train-data"
HTML_ROOT = pathlib.Path(os.getenv("HTML_INDEX_ROOT", str(_DEFAULT_HTML))).resolve()
INDEX_ENDPOINT = os.getenv("INDEX_ENDPOINT", "http://localhost:8002/index")


def iterate_html_files(root: pathlib.Path) -> Iterator[pathlib.Path]:
    """주어진 루트 아래의 모든 HTML 파일 경로를 재귀적으로 반환."""
    for path in root.rglob("*.html"):
        if path.is_file():
            yield path


def build_post_id(path: pathlib.Path) -> str:
    """
    HTML 경로를 기반으로 post_id 생성.
    예: public/novlog/100/index.html -> 100__index
    """
    relative = path.relative_to(HTML_ROOT)
    without_suffix = relative.with_suffix("")
    return str(without_suffix).replace(os.sep, "__")


def main() -> None:
    if not HTML_ROOT.is_dir():
        print(f"⚠️  디렉터리가 없습니다: {HTML_ROOT}")
        return

    html_files = sorted(iterate_html_files(HTML_ROOT))

    if not html_files:
        print(f"⚠️  HTML 파일을 찾지 못했습니다: {HTML_ROOT}")
        return

    print(f"📂 HTML 루트: {HTML_ROOT}")
    print(f"📄 총 {len(html_files)}개의 HTML 파일을 발견했습니다. 재색인을 시작합니다.\n")

    success = 0
    failure = 0

    for idx, html_path in enumerate(html_files, start=1):
        post_id = build_post_id(html_path)

        try:
            html_content = html_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            html_content = html_path.read_text(encoding="cp949")

        payload = {
            "post_id": post_id,
            "content": html_content,
        }

        try:
            response = requests.post(INDEX_ENDPOINT, json=payload, timeout=120)  # 타임아웃 30초 -> 120초로 증가
            response.raise_for_status()
        except requests.RequestException as exc:
            failure += 1
            print(f"[{idx}/{len(html_files)}] ❌ {post_id} 색인 실패: {exc}")
            continue

        success += 1
        print(f"[{idx}/{len(html_files)}] ✅ {post_id} 색인 완료")
        time.sleep(0.2)  # 서버 부하 완화를 위해 약간의 지연

    print("\n=== 재색인 결과 ===")
    print(f"- 성공: {success}건")
    print(f"- 실패: {failure}건")


if __name__ == "__main__":
    main()

