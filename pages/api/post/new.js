import { connectDB } from "@/util/database"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]"

// console.log(request.body)
export default async function handler(request, response) {

    let session = await getServerSession(request, response, authOptions)
    console.log(session)

    // session이 존재하는 경우에만 작성 요청 처리 
    // 요청 바디에 유저 이메일 정보 (글쓴이) 추가
    if (session) {
        request.body.author = session.user.email
    }

    // /api/test로 GET/POST/PUT/DELETE/PATCH 요청시 해당 코드 실행
    // console.log(123)
    if (request.method == 'POST') {
        
        // 예외처리
        if (request.body.title == '') {
            return response.status(500).json("Title is Blanked")
        }

        const db = (await connectDB).db("forum")    
        // const { title, content, author } = request.body; 
        // MongoDB에 삽입
        // insertOne(Object-Type) post collection에 document를 생성하여 data를 발행한다
        // await db.collection("post").insertOne({
        //     title,
        //     content,
        //     createdAt: new Date()
        // });
        let result = await db.collection('post').insertOne(request.body)
        return response.redirect(302, "/list"); 
        
    } 

    
}

