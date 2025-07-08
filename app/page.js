'use client'

import { useState, useEffect } from 'react'

export default function Home() {
  const [post, setPost] = useState([])
  const [chatVisible, setChatVisible] = useState(false)

  useEffect(() => {
    fetch('/api/post/list')
      .then(res => res.json())
      .then(data => setPost(data))
  }, [])

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '90vh',
      flexDirection: 'column',
      textAlign: 'center',
      whiteSpace: 'pre-line',
      padding: '2rem'
    }}>
      안녕하세요! 일본어 블로그를 운영하고 있는 Yomo 입니다.{"\n"}
      다음 블로그는 아래와 같은 기술 스택을 사용해 구현되었습니다.{"\n"}
      MongoDB, NextJS, LangChain, RAG

      {/* 우측 하단 챗봇 버튼 */}
      <button
        onClick={() => setChatVisible(!chatVisible)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          fontSize: '24px',
          cursor: 'pointer'
        }}>
        💬
      </button>

      {/* 챗봇 창 */}
      {chatVisible && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          right: '20px',
          width: '350px',
          height: '500px',
          backgroundColor: '#fff',
          border: '1px solid #ccc',
          borderRadius: '10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          padding: '1rem',
          zIndex: 999
        }}>
          <h4>챗봇</h4>
          <p>무엇을 도와드릴까요?</p>
          <textarea
            placeholder="메시지를 입력하세요"
            style={{ width: '100%', height: '80px', marginTop: '10px' }}
          />
          <button style={{
            marginTop: '10px',
            width: '100%',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            padding: '0.5rem',
            borderRadius: '5px'
          }}>
            전송
          </button>
        </div>
      )}
    </div>
  )
}