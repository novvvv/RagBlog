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
  if (!input.trim()) return;

  const userMessage = { text: input, sender: 'me' };
  const loadingMessage = { sender: 'bot', loading: true };

  const newMessages = [...messages, userMessage, loadingMessage];
  setMessages(newMessages);
  setInput('');

  try {
    const res = await fetch('http://127.0.0.1:8000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input }),
    });

    const data = await res.json();

    const updatedMessages = newMessages.map((msg) =>
      msg.loading ? { text: data.answer, sender: 'bot' } : msg
    );
    setMessages(updatedMessages);

  } catch (err) {
    const updatedMessages = newMessages.map((msg) =>
      msg.loading ? { text: "⚠️ 응답 중 오류가 발생했습니다.", sender: 'bot' } : msg
    );
    setMessages(updatedMessages);
  }
};

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.introText}>
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

            {/* msg.loading이 true인 경우에만 typingBubble 출력 */}
            {messages.map((msg, idx) =>
              msg.loading ? (
                <div key={idx} className={`${styles.otherMessage} ${styles.typingBubble}`}></div>
              ) : (
                <div
                  key={idx}
                  className={
                    msg.sender === 'me' ? styles.myMessage : styles.otherMessage
                  }
                >
                  {msg.text}
                </div>
              )
            )}

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