'use client'
import { useState, useRef } from "react";
import './Write.css';
import CodeContentRenderer from '../detail/[id]/CodeContentRenderer';

export default function Write() {

    let [src, setSrc] = useState('')
    const [imageName, setImageName] = useState('');
    const fileInputRef = useRef(null);
    const [showPublish, setShowPublish] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [content, setContent] = useState('');

    const handleImageChange = async (e) => {
        let file = e.target.files[0]
        if (!file) return;

        setImageName(file.name);

        let filename = encodeURIComponent(file.name)
        let res = await fetch('/api/post/image?file=' + filename)
        res = await res.json()
        console.log(res)

        const formData = new FormData()
        Object.entries({ ...res.fields, file }).forEach(([key, value]) => {
            formData.append(key, value)
        })
        let 업로드결과 = await fetch(res.url, {
            method: 'POST',
            body: formData,
        })

        if (업로드결과.ok) {
            setSrc(업로드결과.url + '/' + filename)
        } else {
            console.log('실패')
            setImageName('');
        }
    }

    const applyAlignment = (alignment) => {
        const textarea = document.querySelector('textarea[name="content"]');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;

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
        setContent(newText);
        textarea.focus();
    };

    return (
        <div className="writePageWrapper p-20">
            <div className="write-container">
                <form action="/api/post/new" method="POST">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button type="button" onClick={() => setShowPreview(!showPreview)}>
                            {showPreview ? '수정하기' : '미리보기'}
                        </button>
                    </div>

                    {showPreview ? (
                        <CodeContentRenderer content={content} />
                    ) : (
                        <>
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
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
                                
                                <button type="button" onClick={() => {
                                    const textarea = document.querySelector('textarea[name="content"]'); 
                                    const start = textarea.selectionStart; 
                                    const end = textarea.selectionEnd;
                                    const text = textarea.value; 
                                    const newText = text.substring(0, start) + '\n```javascript\n// 여기에 코드를 입력하세요\n```\n' + text.substring(end);
                                    setContent(newText);
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
                                    setContent(newText);
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
                                
                                {/* value - 실제로 DB에 저장되는 값 (카테고리 종류) */}
                                <option value="" disabled hidden>카테고리</option>
                                <option value="programming">Programming</option> 
                                <option value="Japan">Japanese</option>
                                <option value="devlog">DevLog</option>
                                
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
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                required />
                        </>
                    )}

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