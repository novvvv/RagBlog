import { connectDB } from "@/util/database.js";
import { ObjectId } from "mongodb";

export default async function handler(request, response) {

    if (request.method == 'GET') {

        const db = (await connectDB).db('forum');
        let result = await db.collection('comment').find(
            { parent: new ObjectId(request.query.id) }
        )

    } else {
        return response.satus(405).json({ mesage : '허용되지 않는 메소드입니다. '})
    }

}