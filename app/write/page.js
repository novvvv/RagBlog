'use client'
import { useState } from "react";
export default function Write() {

    let [src, setSrc] = useState('')

    return (
        <div className="p-20">
            <div className="write-container">
                <form action="/api/post/new" method="POST">
                    <select
                        name="category"
                        className="select-category"
                        required
                        defaultValue=""
                        >
                        <option value="" disabled hidden>카테고리</option>
                        <option value="vocab">단어</option>
                        <option value="grammar">문법</option>
                    </select>

                    <input 
                        type="text" 
                        name="title" 
                        placeholder="제목을 입력하세요" 
                        className="title-input"
                        required />

                    <textarea 
                        type="text" 
                        name="content" 
                        placeholder="내용을 입력하세요" 
                        className="content-input"
                        rows={6}
                        required />
                    
                    <input type="file" accept="image/*"
                        onChange={async (e) => {
                            let file = e.target.files[0]
                            let filename = encodeURIComponent(file.name)
                            let res = await fetch('/api/post/image?file=' + filename)
                            res = await res.json()
                            console.log(res)


                            // S3 Upload
                            // 이미지 Url도 DB에 같이 저장
                            // CreateURL JavaScript Function 사용해서 AWS S3 Storage 용량 최적화
                            // 글을 실제로 발행하지 않으면 스토리지 공간이 낭비되기 떄문 
                            const formData = new FormData() // 자바스크립트 가상 폼 생성 
                            Object.entries({ ...res.fields, file }).forEach(([key, value]) => {
                                formData.append(key, value)
                            })
                            let 업로드결과 = await fetch(res.url, {
                                method: 'POST',
                                body: formData, // form tag에 넣어서 보내는게 좋다. 왜?
                            })

                            console.log(업로드결과)

                            if (업로드결과.ok) {
                                setSrc(업로드결과.url + '/' + filename)
                            } else {
                                console.log('실패')
                            }
                        }}
                    />
                    <img src={src} />


                    <button type="submit">Save</button>

                </form>
            </div>
        </div>
    )
}

// /api/test로 Post요청 
// input-required 유효성 검사 (필드가 비어있을 떄 제출 제한)

// 수정기능 API
// 1. 글 마다 수정 버튼, 누르면 수정 페이지로 이동한다. 
// 2. 수정 페이지 만들기 (본문을 DB에서 가져와서 미리 채워둔다.)
// 3. 발행 버튼 누르면 DB에 있던 글을 수정한다. 