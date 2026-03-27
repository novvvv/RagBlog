import { connectDB } from "@/util/database"
import { ObjectId } from "mongodb"
import './button.css'
import Comment from "./Comment"
import Link from "next/link"
import styles from '../../components/home/Home.module.css'
import CodeContentRenderer from './CodeContentRenderer';
import Chat from '../../components/chat/Chat';

export default async function Page({ params }) {

    const db = (await connectDB).db("forum")
    const { id } = params;
    let result = await db.collection('post').findOne({ _id: new ObjectId(id)})

    if (result == null) {
        return notFound()
    }

    return(
        <div className="detailPageWrapper">
            <hr className={styles.newsLine} />
            <h1>{result.title}</h1>
            <Link href={`/edit/${id}`} prefetch={false} className="btn-link">수정</Link>
            <hr className={styles.newsLine} />

            <CodeContentRenderer content={result.content} /> 
            <Comment _id={result._id.toString()}/>
            <Chat postId={result._id.toString()} />

        </div>
    )
    
}
