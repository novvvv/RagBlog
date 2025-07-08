export default async function handler(request, response) {
    if (request.method == 'POST') {
        console.log(request.body)
        response.status(200).json("Post Request Compelete")
    }
} 