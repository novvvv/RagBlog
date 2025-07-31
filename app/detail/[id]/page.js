import { connectDB } from "@/util/database"
import { ObjectId } from "mongodb"
import './button.css'
import Comment from "./Comment"
import Link from "next/link"
import styles from '../../Home.module.css'


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
        <div>
            <hr className={styles.newsLine} />
            <h1>{result.title}</h1>
            <Link href={`/edit/${id}`} prefetch={false} className="btn-link">수정</Link>
            <hr className={styles.newsLine} />

            <p> {result.content} </p>

            <Comment _id={result._id.toString()}/>

            

        </div>
    )
}

