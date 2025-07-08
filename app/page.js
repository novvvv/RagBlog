'use client'

import { useState, useEffect } from 'react'
import styles from './Home.module.css'

export default function Home() {
  const [post, setPost] = useState([])
  const [chatVisible, setChatVisible] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')

  useEffect(() => {
    fetch('/api/post/list')
      .then(res => res.json())
      .then(data => setPost(data))
  }, [])

 
  // python back-end chat server로 메시지 전송 
const handleSend = async () => {
  if (!input.trim()) return

  const newMessages = [...messages, { text: input, sender: 'me' }]
  setMessages(newMessages)
  setInput('')

  try {
    const res = await fetch('http://127.0.0.1:8000/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: input }),
    })

    const data = await res.json()
    setMessages([...newMessages, { text: data.answer, sender: 'bot' }])
  } catch (err) {
    console.error("챗봇 응답 오류:", err)
    setMessages([...newMessages, { text: "에러가 발생했어요.", sender: 'bot' }])
  }
}

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.introText}>
        안녕하세요! 일본어 블로그를 운영하고 있는 Yomo 입니다.{"\n"}
        다음 블로그는 아래와 같은 기술 스택을 사용해 구현되었습니다.{"\n"}
        MongoDB, NextJS, LangChain, RAG
      </div>

      <button
        className={styles.chatToggleButton}
        onClick={() => setChatVisible(!chatVisible)}
      >
        💬
      </button>

      {chatVisible && (
        <div className={styles.chatBox}>
          <div className={styles.chatMessages}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={
                  msg.sender === 'me'
                    ? styles.myMessage
                    : styles.otherMessage
                }
              >
                {msg.text}
              </div>
            ))}
          </div>

          <div className={styles.chatInputArea}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={styles.textarea}
              placeholder="메시지를 입력하세요"
            />
            <button onClick={handleSend} className={styles.sendButton}>
              전송
            </button>
          </div>
        </div>
      )}
    </div>
  )
}