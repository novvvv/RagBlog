import { connectDB } from "@/util/database";

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { category } = req.query;

      if (!category) {
        return res.status(400).json({ message: 'Category is required' });
      }

      const db = (await connectDB).db("forum");
      const posts = await db.collection('post').find({ category: category }).sort({ _id: -1 }).toArray();
      
      return res.status(200).json(posts);

    } catch (error) {
      console.error('Error fetching posts by category:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
