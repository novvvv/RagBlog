import { connectDB } from "@/util/database"
import { MongoClient } from "mongodb"

// DB 입출력 코드는 가능하면 Server Component 내부에서만 작성하자
export default async function Home() {

  const db = (await connectDB).db("forum") // DB 연동 
  let result = await db.collection('post').find().toArray() // post Collection의 모든 Document를 꺼내온다. 
  console.log(result[0].title)

  return (
    <div></div>
  )

}
