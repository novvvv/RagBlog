import { NextRequest, NextResponse } from 'next/server' 
import { cookies } from 'next/headers'
import fs from 'fs' // File System
import path from 'path' // Path 

const postsFilePath = path.join(process.cwd(), 'data', 'posts.json')

// -- API 파일 기반으로 글 목록 조회 및 작성 처리 --
// 디렉토리와 파일 초기화
function ensureDataFile() {
  const dataDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  if (!fs.existsSync(postsFilePath)) {
    fs.writeFileSync(postsFilePath, JSON.stringify([]))
  }
}

// GET: 글 목록 조회
export async function GET() {
  try {
    ensureDataFile()
    const fileData = fs.readFileSync(postsFilePath, 'utf8')
    const posts = JSON.parse(fileData)
    
    // 최신순 정렬
    const sortedPosts = posts.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    
    return NextResponse.json(sortedPosts)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}

// POST: 새 글 작성
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const auth = cookieStore.get('auth')
    
    if (auth?.value !== 'authenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, content } = await request.json()

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    ensureDataFile()
    const fileData = fs.readFileSync(postsFilePath, 'utf8')
    const posts = JSON.parse(fileData)

    const newPost = {
      id: Date.now().toString(),
      title,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    posts.push(newPost)
    fs.writeFileSync(postsFilePath, JSON.stringify(posts, null, 2))

    return NextResponse.json(newPost, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}


