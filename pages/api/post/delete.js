import { connectDB } from "@/util/database"
import { ObjectId } from "mongodb"

export default async function handler(request, response) {
    if (request.method == 'DELETE') {
        console.log(request.body)
        const db = (await connectDB).db('forum')
        let result = await db.collection('post').deleteOne({ _id : new ObjectId(request.body)})
        response.status(200).json("Delete Compelete")
    }
} 