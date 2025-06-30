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