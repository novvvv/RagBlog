import { connectDB } from "@/util/database"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]"
import { ObjectId } from "mongodb"


export default async function handler(request, response) {

    let session = await getServerSession(request, response, authOptions)

    // 예외처리 
    // 1. 댓글 빈칸 체크
    // 2. 댓글 길이 체크
    // 3. 댓글 로그인 여부 

    if (request.method == 'POST') {
 
        request.body = JSON.parse(request.body) // Json 문자열을 객체 형식으로 변환
        let comment = {
            content: request.body.comment, 
            parent : new ObjectId(request.body._id),
            author : session.user.email
        };

        const db = (await connectDB).db('forum')
        let result = await db.collection('comment').insertOne(comment)
        response.status(200).json('저장완료')

        
        
    } 

    
}
