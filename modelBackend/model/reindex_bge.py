"""
재임베딩 스크립트
------------------
Chroma 컬렉션을 비운 뒤, `public/novlog` 안의 HTML 파일을 모두 읽어
FastAPI `/index` 엔드포인트로 전송하여 `BAAI/bge-m3` 임베딩으로 다시 색인합니다.

사전 준비:
- `chroma run --path ... --port 8001`으로 서버 실행
- `python modelBackend/model/chat_server.py`로 FastAPI 서버 실행
"""

from __future__ import annotations

import os
import pathlib
import time
from typing import Iterator

import requests

WORKSPACE_ROOT = pathlib.Path(__file__).resolve().parents[2]
HTML_ROOT = WORKSPACE_ROOT / "public" / "novlog"
INDEX_ENDPOINT = "http://localhost:8002/index"


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
    html_files = sorted(iterate_html_files(HTML_ROOT))

    if not html_files:
        print(f"⚠️  HTML 파일을 찾지 못했습니다: {HTML_ROOT}")
        return

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
            response = requests.post(INDEX_ENDPOINT, json=payload, timeout=30)
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

