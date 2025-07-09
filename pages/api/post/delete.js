import { connectDB } from "@/util/database"
import { ObjectId } from "mongodb"
import { authOptions } from "../auth/[...nextauth]"
import { getServerSession } from "next-auth"


export default async function handler(request, response) {

    let session = await getServerSession(request, response, authOptions)

    if (!session) {
        console.log("세션 정보가 존재하지 않습니다.")
        return;
    }

    if (request.method == 'DELETE'){

        const db = (await connectDB).db('forum')
        let userInfo = await db.collection('post').findOne({ _id : new ObjectId(request.body)})
        console.log(userInfo)

        if (userInfo.author == session.user.email) {
            let result = await db.collection('post').deleteOne({ _id : new ObjectId(request.body)})
            return response.status(200).json("Delete Compelete")
        } else {
            return response.status(500).json("유저 정보 불일치")
        }

    }

    /* 

    if (request.method == 'DELETE') {
        
        let result = await db.collection('post').deleteOne({ _id : new ObjectId(request.body)})
        response.status(200).json("Delete Compelete")
    } */

} 

