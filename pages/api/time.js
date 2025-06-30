export default async function handler(request, response) {

  if (request.method === 'GET') {
    const now = new Date();

    // ISO 형식의 문자열 (예: 2025-06-27T12:34:56.789Z)
    const isoTime = now.toISOString();

    // 한국 시간 (UTC+9) 포맷 예시
    const krTime = now.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour12: false,
    });

    return response.status(200).json({
      utc: isoTime,
      korea: krTime,
    });
  } else {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }
    
}

// HW
// 1. /api/list로 GET Method 요청하면 Database에 저장된 post collection 모든 데이터 출력 
// 2. 특정 url로 GET Method 요청하면 현재시간 보내주는 서버기능
// 3. 글 발행 기능 완성 