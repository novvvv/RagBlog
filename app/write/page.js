'use client'
import { useState, useRef } from "react";
import './Write.css';

export default function Write() {

    let [src, setSrc] = useState('')
    const [imageName, setImageName] = useState('');
    const fileInputRef = useRef(null);
    const [showPublish, setShowPublish] = useState(false); // 발행 시 출력되는 컨테이너를 관리하는 상태

    const handleImageChange = async (e) => {
        let file = e.target.files[0]
        if (!file) return;

        setImageName(file.name);

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
            setImageName('');
        }
    }

    // applyAlignment 정렬 콜백 함수 
    const applyAlignment = (alignment) => {

        const textarea = document.querySelector('textarea[name="content"]');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;

        // 텍스트를 줄을 기준으로 나누어, 사용자가 선택한 텍스트가 몇 번째 라인부터 몇 번째 라인까지인지 계산한다. 
        const selectionStartLine = text.substring(0, start).split('\n').length - 1;
        const selectionEndLine = text.substring(0, end).split('\n').length - 1;

        const lines = text.split('\n');
        const alignRegex = /<div style="text-align: (left|center|right);">([\s\S]*)<\/div>/;

        for (let i = selectionStartLine; i <= selectionEndLine; i++) {
            if (lines[i].trim() === '') continue;

            const match = lines[i].match(alignRegex);
            if (match) {
                lines[i] = `<div style="text-align: ${alignment};">${match[2]}</div>`;
            } else {
                lines[i] = `<div style="text-align: ${alignment};">${lines[i]}</div>`;
            }
        }

        const newText = lines.join('\n');
        textarea.value = newText;
        textarea.focus();
    };

    return (
        <div className="writePageWrapper p-20">
            <div className="write-container">
                <form action="/api/post/new" method="POST">

                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
                        {/* 사진 추가 UI */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current.click()}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                        >
                            <img src="/write/picture.png" alt="사진 추가" style={{ width: '32px', height: '32px' }} />
                        </button>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleImageChange}
                        />
                        {imageName && <span>{imageName}</span>}
                        
                        {/* name이 content인 textArea 즉, 내용 입력 TextArea를 가져와, 
                        사용자가 작성한 텍스트의 시작 인덱스(selectionStart), 종료 인덱스(selectionEnd) 위치를 가져와
                        마우스 커서 기준 선택 영역 전후로 마크다운 블록을 삽인한다. */}
                        
                        <button type="button" onClick={() => {
                            const textarea = document.querySelector('textarea[name="content"]'); 
                            const start = textarea.selectionStart; 
                            const end = textarea.selectionEnd;
                            const text = textarea.value; 
                            const newText = text.substring(0, start) + '\n```javascript\n// 여기에 코드를 입력하세요\n```\n' + text.substring(end);
                            textarea.value = newText;
                            textarea.focus();
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                        >
                            <img src="/write/code_icon.png" alt="코드 블록 추가" style={{ width: '32px', height: '32px' }} />
                        </button>

                        <button type="button" onClick={() => {
                            const textarea = document.querySelector('textarea[name="content"]');
                            const start = textarea.selectionStart;
                            const end = textarea.selectionEnd;
                            const text = textarea.value;
                            const selectedText = text.substring(start, end);
                            const newText = text.substring(0, start) + '**' + selectedText + '**' + text.substring(end);
                            textarea.value = newText;
                            textarea.focus();
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                        >
                            <img src="/write/bold_icon.png" alt="굵게" style={{ width: '32px', height: '32px' }} />
                        </button>

                        <button type="button" onClick={() => applyAlignment('left')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}>
                            <img src="/write/left_align_icon.png" alt="왼쪽 정렬" style={{ width: '32px', height: '32px' }} />
                        </button>
                        <button type="button" onClick={() => applyAlignment('center')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}>
                            <img src="/write/center_align_icon.png" alt="가운데 정렬" style={{ width: '32px', height: '32px' }} />
                        </button>
                        <button type="button" onClick={() => applyAlignment('right')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}>
                            <img src="/write/right_align_icon.png" alt="오른쪽 정렬" style={{ width: '32px', height: '32px' }} />
                        </button>

                    </div>

                    {src && (
                        <div style={{ marginBottom: '1rem' }}>
                            <img src={src} alt="Preview" style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', border: '1px solid #eee', borderRadius: '5px' }}/>
                            <input type="hidden" name="image_url" value={src} />
                        </div>
                    )}

                    <select
                        name="category"
                        className="select-category"
                        required
                        defaultValue=""
                        >
                        <option value="" disabled hidden>카테고리</option>
                        <option value="programming">Programming</option>
                        <option value="Japan">Japanese</option>
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

                    
                    <button type="button" onClick={() => setShowPublish(true)}>Save</button>

                    {showPublish && (
                        <div className="publish-container">
                            <div className="publish-content">
                                <button type="button" className="add-image-button" onClick={() => fileInputRef.current.click()}>사진 추가</button>
                                <button type="submit" className="publish-button">발행</button>
                                <button type="button" className="cancel-button" onClick={() => setShowPublish(false)}>취소</button>
                            </div>
                        </div>
                    )}

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