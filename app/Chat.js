
'use client'

import { useState } from 'react'
import styles from './Chat.module.css'

export default function Chat({ postId = "default" }) {
  
  const [chatVisible, setChatVisible] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { text: input, sender: 'me' };
    const loadingMessage = { sender: 'bot', loading: true };

    const newMessages = [...messages, userMessage, loadingMessage];ㅌ
    setMessages(newMessages);
    setInput('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_CHAT_API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: postId,
          question: input
        }),
      });

      // 백엔드 채팅 서버로부터 받아온 응답 데이터를 JSON 형식으로 파싱한다. 
      const data = await res.json();

      // 반드시 data.answer만 메시지로 사용
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
    <div>
      <button
        className={styles.chatToggleButton}
        onClick={() => setChatVisible(!chatVisible)}
      >
        💬
      </button>

      {chatVisible && (
        <div className={styles.chatBox}>
          <div className={styles.chatMessages}>
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
