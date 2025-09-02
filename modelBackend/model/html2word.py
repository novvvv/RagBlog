from html2docx import html2docx
from io import BytesIO 
import os

input_path = "./blog/43-C#고급문법.html" # 입력 HTML 파일 경로s

# 출력 디렉토리와 파일 경로
output_dir = "./html"
output_path = os.path.join(output_dir, "output.docx")

os.makedirs(output_dir, exist_ok=True) # 출력 디렉토리 없으면 생성

# HTML 파일 읽기
with open(input_path, "r", encoding="utf8") as f:
    html = f.read()

# Word 파일로 변환 처리
# html2docx 파일은 BytesIO 객체를 반환 
# 따라서 파일에 저장하기 위해선 getvalue()로 바이트 데이터를 추출
docx_buffer = html2docx(html, title="C#고급군법 블로그")

with open(output_path, "wb") as docx_file:
    docx_file.write(docx_buffer.getvalue())


print("✅ Word File Convert Complete! →", output_path)