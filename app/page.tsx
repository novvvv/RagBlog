import Link from 'next/link'
import Image from 'next/image'

async function getPosts() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/posts`, {
      next: { revalidate: 60 }, // 60초마다 재검증 (ISR)
    })
    if (!res.ok) return []
    return res.json()
  } catch (error) {
    return []
  }
}

export default async function Home() {
  const posts = await getPosts()

  return (
    <main className="min-h-screen px-6 py-12 bg-[#F7F7F4] dark:bg-[#26251E]">
      <div className="max-w-[95%]">
        <div className="flex flex-col md:flex-row gap-8">
          {/* 프로필 섹션 */}
          <div className="md:w-64 flex-shrink-0 md:ml-12">
            <div className="border border-[#26251E]/20 dark:border-[#F7F7F4]/20 p-6 bg-[#F7F7F4] dark:bg-[#26251E]">
              <div className="flex flex-col items-center text-center space-y-4">
                {/* 프로필 이미지 */}
                <div className="w-40 h-40 overflow-hidden relative">
                  <Image
                    src="/profile.png"
                    alt="doil Choi"
                    width={160}
                    height={160}
                    className="object-cover"
                  />
                </div>
                
                {/* 이름 */}
                <h2 className="text-lg font-bold text-[#26251E] dark:text-[#F7F7F4]">doil Choi</h2>
                
                {/* 이메일 */}
                <p className="text-[#26251E]/60 dark:text-[#F7F7F4]/60 text-xs break-all">dohana1205@gmail.com</p>
                
                {/* 링크 */}
                <div className="flex gap-4 text-sm">
                  <a 
                    href="https://github.com/novvvv" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#26251E] dark:text-[#F7F7F4] hover:opacity-70 transition-opacity"
                  >
                    github
                  </a>
                  <span className="text-[#26251E]/40 dark:text-[#F7F7F4]/40">|</span>
                  <a 
                    href="/resume" 
                    className="text-[#26251E] dark:text-[#F7F7F4] hover:opacity-70 transition-opacity"
                  >
                    resume
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* 글 목록 섹션 */}
          <div className="flex-1 md:mr-12">
            <h1 className="text-2xl font-bold text-[#26251E] dark:text-[#F7F7F4] mb-8">최근 글</h1>
            
            {posts.length === 0 ? (
              <div className="text-[#26251E]/60 dark:text-[#F7F7F4]/60 py-12 text-center">
                작성된 글이 없습니다.
              </div>
            ) : (
              <div className="space-y-6">
                {posts.slice(0, 5).map((post: any) => (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}`}
                    className="block border-b border-[#26251E]/20 dark:border-[#F7F7F4]/20 pb-6 hover:opacity-70 transition-opacity"
                  >
                    <h2 className="text-xl font-semibold text-[#26251E] dark:text-[#F7F7F4] mb-2">
                      {post.title}
                    </h2>
                    <p className="text-[#26251E]/60 dark:text-[#F7F7F4]/60 text-sm">
                      {new Date(post.createdAt).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </Link>
                ))}
                {posts.length > 5 && (
                  <div className="pt-4">
                    <Link
                      href="/posts"
                      className="inline-block text-[#26251E] dark:text-[#F7F7F4] hover:opacity-70 transition-opacity"
                    >
                      더보기 →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

