export default function Write() {
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