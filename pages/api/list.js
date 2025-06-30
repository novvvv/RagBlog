import { connectDB } from "@/util/database"

export default async function handler(request, response) {

    // /api/list GET 요청 시 Database에 저장되어있는 모든 post collection data 출력 
    if (request.method == 'GET') {
        const db = (await connectDB).db("forum") // DB 연동 
        let result = await db.collection('post').find().toArray() // post Collection의 모든 Document를 꺼내온다. 
        console.log(result)
    }
    
}