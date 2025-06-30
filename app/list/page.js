import { connectDB } from "@/util/database"
import Link from "next/link"
import DetailLink from "./DetailLink"

export default async function List() {

    const db = (await connectDB).db("forum") // DB 연동 
    let result = await db.collection('post').find().toArray() // post Collection의 모든 Document를 꺼내온다. 
    // const { id } = await props.params;
    console.log(result)
    // let result = await db.collection('post').findOne({ _id: new ObjectId(id)})

    return(
        <div className="list-bg">
            {
                result.map((item, index) => 
                
                        <div className="list-item" key={item._id}>
                            <Link prefetch={false} href={`/detail/${item._id}`}>
                                <h4>{item.title}</h4>
                            </Link>
                            <p>{item.content}</p>
                        </div>
                )
            }
        </div>
    )
}