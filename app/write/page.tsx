'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function WritePage() {

  const router = useRouter()
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false) // 제출 중에는 버튼을 비활성화하여 중복 제출 방지 

  // 인증되어 있는 경우에만 글쓰기 폼 표시 
  // 컴포넌트 마운트
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const res = await fetch('/api/auth')
    const data = await res.json()
    setAuthenticated(data.authenticated)
  }

  const handleLogin = async (e: React.FormEvent) => {

    e.preventDefault() // * 폼 제출 시 기본 동작은 페이지 새로고침이기에 막는다 * 
    setLoading(true) // * 로딩 상태를 True로 설정하여 버튼 비활성화 및 조건부 로딩 표시 * 
    
    // [Logic] Pw 직렬화 후 API 전송 
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    // [Logic] API 응답을 JSON으로 변환한다. 
    const data = await res.json()

    // * Success -> { success: true } *
    if (data.success) {
      setAuthenticated(true)
    } 

    // * fail -> { success : false } *
    else {
      alert('비밀번호가 올바르지 않습니다.')
    }
    setLoading(false)
  }

  // -- [Exception] : 제목/내용 빈칸 검증 --  
  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault() // ?
    
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.')
      return
    }

    setSubmitting(true) 

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })

      if (res.ok) {
        router.push('/posts')
        router.refresh() // ?
      } 
      
      else {
        alert('글 작성에 실패했습니다.')
      }
    } 
    
    catch (error) {
      alert('글 작성에 실패했습니다.')
    } 
    
    finally {
      setSubmitting(false)
    }
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-[#F7F7F4] dark:bg-[#26251E]">
        <div className="max-w-md w-full">
          <form onSubmit={handleLogin} className="space-y-4">
            <h1 className="text-2xl font-bold text-[#26251E] dark:text-[#F7F7F4] mb-6">글쓰기</h1>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              className="w-full px-4 py-3 border border-[#26251E]/20 dark:border-[#F7F7F4]/20 bg-[#F7F7F4] dark:bg-[#26251E] text-[#26251E] dark:text-[#F7F7F4] focus:outline-none focus:border-[#26251E]/40 dark:focus:border-[#F7F7F4]/40"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-[#26251E] dark:bg-[#F7F7F4] text-[#F7F7F4] dark:text-[#26251E] hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {loading ? '확인 중...' : '확인'}
            </button>

          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-6 py-12 bg-[#F7F7F4] dark:bg-[#26251E]">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-[#26251E] dark:text-[#F7F7F4] mb-8">글쓰기</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
              className="w-full px-4 py-3 border border-[#26251E]/20 dark:border-[#F7F7F4]/20 bg-[#F7F7F4] dark:bg-[#26251E] text-[#26251E] dark:text-[#F7F7F4] focus:outline-none focus:border-[#26251E]/40 dark:focus:border-[#F7F7F4]/40 text-xl"
              required
            />
          </div>
          
          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="내용"
              rows={20}
              className="w-full px-4 py-3 border border-[#26251E]/20 dark:border-[#F7F7F4]/20 bg-[#F7F7F4] dark:bg-[#26251E] text-[#26251E] dark:text-[#F7F7F4] focus:outline-none focus:border-[#26251E]/40 dark:focus:border-[#F7F7F4]/40 resize-none"
              required
            />
          </div>
          
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-[#26251E] dark:bg-[#F7F7F4] text-[#F7F7F4] dark:text-[#26251E] hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {submitting ? '작성 중...' : '작성하기'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/posts')}
              className="px-6 py-3 border border-[#26251E]/20 dark:border-[#F7F7F4]/20 text-[#26251E] dark:text-[#F7F7F4] hover:bg-[#26251E]/5 dark:hover:bg-[#F7F7F4]/5 transition-colors"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}


