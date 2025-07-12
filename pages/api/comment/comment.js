import { connectDB } from "@/util/database"

export default async function handler(request, response) {
    if (request.method == 'POST') {

        let comment = {
            content: '댓글내용',
            parent: '부모게시물_id',
            author: '유저 이메일'
        }
        const db = (await connectDB).db('forum') // db 연동 
        let result = await db.collection('comment').insertOne(request.body)
    }
}