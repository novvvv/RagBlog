import { ObjectId } from "mongodb"
import { connectDB } from "@/util/database" 

export default async function Edit(props) {

    const db = (await connectDB).db("forum")
    const { id } = await props.params;
    let result = await db.collection('post').findOne({ _id: new ObjectId(id)})
    console.log(result)

    return (
        <div className="writePageWrapper p-20" style={{ backgroundColor: '#e2e2de', color: 'black' }}>
            <h4>수정페이지</h4>
            <div className="write-container">
                <form action="/api/post/edit" method="POST">
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

                    <input style= {{display : 'none'}} name="_id" defaultValue={result._id.toString()}/>
                    
                    <input 
                        type="text" 
                        name="title" 
                        placeholder="제목을 입력하세요" 
                        className="title-input"
                        defaultValue={result.title}
                        required />

                    <textarea 
                        type="text" 
                        name="content" 
                        placeholder="내용을 입력하세요" 
                        className="content-input"
                        rows={6}
                        defaultValue={result.content}
                        required />

                    <button type="submit">Save</button>

                </form>
            </div>
        </div>
    )
}