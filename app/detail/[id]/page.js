import { connectDB } from "@/util/database"
import { ObjectId } from "mongodb"
import './button.css'
import Comment from "./Comment"
import Link from "next/link"
<<<<<<< HEAD
import styles from '../../Home.module.css'
import CodeContentRenderer from './CodeContentRenderer';
import Chat from '../../Chat'; // 경로는 실제 구조에 맞게 조정
=======
import styles from '../../components/home/Home.module.css'
import CodeContentRenderer from './CodeContentRenderer';
import Chat from '../../components/chat/Chat';
>>>>>>> ace024c (fix: 블로그 구조 변경)

export default async function Page({ params }) {

    const db = (await connectDB).db("forum")
    const { id } = params;
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
            <Chat postId={result._id.toString()} /> {/* postId prop 전달 */}

        </div>
    )
    
}
