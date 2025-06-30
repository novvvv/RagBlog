import { connectDB } from "@/util/database"

// console.log(request.body)
export default async function handler(request, response) {

    // /api/test로 GET/POST/PUT/DELETE/PATCH 요청시 해당 코드 실행
    // console.log(123)
    if (request.method == 'POST') {
        
        // 예외처리
        if (request.body.title == '') {
            return response.status(500).json("Title is Blanked")
        }

        // DB 연동 
        const db = (await connectDB).db("forum") 
            
        // 사용자 입력 정보 request parsing
        const { title, content } = request.body; 
            
        // MongoDB에 삽입
        // insertOne(Object-Type) post collection에 document를 생성하여 data를 발행한다
        await db.collection("post").insertOne({
            title,
            content,
            createdAt: new Date()
        });
        return response.redirect(302, "/list"); 
        
    } 

    
}

