import Link from "next/link";

export default async function RecentPosts() {
    const response = await fetch('http://localhost:3000/api/post/recent', { cache: 'no-store' });
    const posts = await response.json();

    return (
        <div>
            <ul>
                {posts.map((post) => (
                    <li key={post._id}>
                        <Link href={`/detail/${post._id}`}>{post.title}</Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
