import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import fs from 'fs'
import path from 'path'

const postsFilePath = path.join(process.cwd(), 'data', 'posts.json')

// GET: 특정 글 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!fs.existsSync(postsFilePath)) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const fileData = fs.readFileSync(postsFilePath, 'utf8')
    const posts = JSON.parse(fileData)
    const post = posts.find((p: any) => p.id === params.id)

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    return NextResponse.json(post)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 })
  }
}

// DELETE: 글 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const auth = cookieStore.get('auth')
    
    if (auth?.value !== 'authenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!fs.existsSync(postsFilePath)) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const fileData = fs.readFileSync(postsFilePath, 'utf8')
    const posts = JSON.parse(fileData)
    const filteredPosts = posts.filter((p: any) => p.id !== params.id)

    if (posts.length === filteredPosts.length) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    fs.writeFileSync(postsFilePath, JSON.stringify(filteredPosts, null, 2))

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}


