import Link from 'next/link'

// [Logic] * /api/posts EndPoint 호출 *
async function getPosts() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/posts`, {
      next: { revalidate: 60 }, // 60초마다 재검증 (ISR)
    })
    
    if (!res.ok) return []
    return res.json()
  } 
  
  catch (error) {
    return []
  }
}

export default async function PostsPage() {
  const posts = await getPosts()

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-[#26251E] mb-8">글 목록</h1>
        
        {posts.length === 0 ? (
          <div className="text-[#26251E]/60 py-12 text-center">
            작성된 글이 없습니다.
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post: any) => (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="block border-b border-[#26251E]/20 pb-6 hover:opacity-70 transition-opacity"
              >
                <h2 className="text-xl font-semibold text-[#26251E] mb-2">
                  {post.title}
                </h2>
                <p className="text-[#26251E]/60 text-sm">
                  {new Date(post.createdAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}


