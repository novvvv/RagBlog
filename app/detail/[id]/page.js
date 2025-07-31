import { connectDB } from "@/util/database"
import { ObjectId } from "mongodb"
import './button.css'
import Comment from "./Comment"
import Link from "next/link"
import styles from '../../Home.module.css'
import CodeContentRenderer from './CodeContentRenderer';

export default async function Detail(props){

    const db = (await connectDB).db("forum")
    const { id } = await props.params;
    let result = await db.collection('post').findOne({ _id: new ObjectId(id)})

    /**
     * Error Exception
     */

    if (result == null) {
        return notFound()
    }

    return(
        <div className="detailPageWrapper">
            <hr className={styles.newsLine} />
            <h1>{result.title}</h1>
            <Link href={`/edit/${id}`} prefetch={false} className="btn-link">수정</Link>
            <hr className={styles.newsLine} />

            {/* db에서 content를 불러와 Prop형태로 전달 */}
            <CodeContentRenderer content={result.content} /> 
            <Comment _id={result._id.toString()}/>

        </div>
    )
}
