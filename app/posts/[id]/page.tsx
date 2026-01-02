import Link from 'next/link'
import { notFound } from 'next/navigation' // 404 

async function getPost(id: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    const res = await fetch(`${baseUrl}/api/posts/${id}`, {
      next: { revalidate: 3600 }, // 1시간마다 재검증 (ISR)
    })

    if (!res.ok) return null

    return res.json()

  } 
  
  catch (error) {
    return null
  }
}

export default async function PostPage({ params }: { params: { id: string } }) {
  const post = await getPost(params.id)

  if (!post) {
    notFound()
  }

  return (
    <main className="min-h-screen px-6 py-12 bg-[#F7F7F4] dark:bg-[#26251E]">
      <div className="max-w-3xl mx-auto"> 
        <Link
          href="/posts"
          className="inline-block text-[#26251E]/60 dark:text-[#F7F7F4]/60 hover:text-[#26251E] dark:hover:text-[#F7F7F4] mb-8 transition-colors"
        >
          ← 목록으로
        </Link>
        
        <article className="space-y-6">
          <header className="border-b border-[#26251E]/20 dark:border-[#F7F7F4]/20 pb-6">
            <h1 className="text-3xl font-bold text-[#26251E] dark:text-[#F7F7F4] mb-4">
              {post.title}
            </h1>
            <time className="text-[#26251E]/60 dark:text-[#F7F7F4]/60 text-sm">
              {new Date(post.createdAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </header>
          
          <div className="text-[#26251E] dark:text-[#F7F7F4] whitespace-pre-wrap leading-relaxed">
            {post.content}
          </div>
        </article>
      </div>
    </main>
  )
}

