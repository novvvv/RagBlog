import { connectDB } from "@/util/database"
import { ObjectId } from "mongodb"
import './button.css'
import Link from "next/link"

export default async function Detail(props){

    const db = (await connectDB).db("forum")
    const { id } = await props.params;
    let result = await db.collection('post').findOne({ _id: new ObjectId(id)})

    return(
        <div>
            <h4>상세페이지</h4>
            <h4>{result.title}</h4>
            <p>{result.content}</p>
            
            <Link href={`/edit`} prefetch={false} className="btn-link">수정</Link>

        </div>
    )
}