import { connectDB } from "@/util/database"
import { ObjectId } from "mongodb"
import './button.css'
import Comment from "./Comment"
import Link from "next/link"

export default async function Detail(props){

    const db = (await connectDB).db("forum")
    const { id } = await props.params;
    let result = await db.collection('post').findOne({ _id: new ObjectId(id)})

    /**
     * notFound 함수가 실행되면, page.js가 아닌 not-found.js가 실행된다. 
     */
    if (result == null) {
        return notFound()
    }

    return(
        <div>
            <h4>상세페이지</h4>
            <h4>{result.title}</h4>
            <p>{result.content}</p>
            <Comment _id={result._id.toString()}/>
            <Link href={`/edit/${id}`} prefetch={false} className="btn-link">
                수정
            </Link>

        </div>
    )
}

