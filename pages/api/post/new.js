import { connectDB } from "@/util/database"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]"

export default async function handler(request, response) {

    let session = await getServerSession(request, response, authOptions)
    
    // session이 존재하는 경우에만 작성 요청 처리 
    // 요청 바디에 유저 이메일 정보 (글쓴이) 추가
    if (session) {
        request.body.author = session.user.email
    }

    if (request.method == 'POST') {
        
        if (request.body.title == '') {
            return response.status(500).json("Title is Blanked")
        }

        try {
            const db = (await connectDB).db("forum")    
            let result = await db.collection('post').insertOne(request.body)

            // RAG 인덱싱을 위해 Python 백엔드로 요청 전송
            const postId = result.insertedId.toString();
            const postContent = request.body.content;

            fetch(`${process.env.NEXT_PUBLIC_CHAT_API_URL}/index`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    post_id: postId,
                    content: postContent 
                }),
            }).catch(err => {
                // 백그라운드에서 발생하는 에러이므로 로깅만 합니다.
                console.error("Failed to index post for RAG:", err);
            });

            return response.redirect(302, "/list"); 

        } catch (error) {
            console.error("Failed to save post:", error);
            return response.status(500).json("Failed to save post");
        }
    } 
}

