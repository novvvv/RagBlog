import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// -- api/auth/ endpoint POST(LOGIN), GET(인증 상태 확인) 지원 -- 

export async function POST(request: NextRequest) {

  // [Logic1] PW 추출 (Default admin) & 검증
  const { password } = await request.json()
  const correctPassword = process.env.WRITE_PASSWORD || 'admin'

  // [Logic2] 성공처리 
  // -- Cookie : httpOnly: true ... Js 접근 불가 (XSS) -- 
  // -- secure : Production 에서만 HTTPS 전송? -- 
  // -- samSite: 'lax' CSRF 완화? -- 
  // -- maxAge : 쿠키 유효기간 (7일) -- 
  if (password === correctPassword) {
    const response = NextResponse.json({ success: true })

    response.cookies.set('auth', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, 
    })

    return response
  }

  // [Logic2.1] 실패처리 
  return NextResponse.json({ success: false }, { status: 401 })
}

// -- api/auth GET -- 
export async function GET() {
  const cookieStore = await cookies()
  const auth = cookieStore.get('auth')
  
  return NextResponse.json({ 
    authenticated: auth?.value === 'authenticated' 
  })
}


