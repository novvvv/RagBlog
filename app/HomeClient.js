'use client'

import { useState } from 'react'
import styles from './Home.module.css'

export default function HomeClient({ children }) {

  const [chatVisible, setChatVisible] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')

 
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

      {/* News Header */}
      <h1 className={styles.newsHeading}>Do2Dev</h1>
      <br />
      <hr className={styles.newsLine} />
      <div className={styles.profileSection}>


        <div className={styles.profileTextContainer}>
          {/* <img src="/profile.png" alt="Profile" className={styles.profileImage} /> */}
          <p className={styles.profileText}>[ Developer. Do2 ]</p>
                    <p className={styles.profileText}><img src="/instagram.png" alt="Instagram" style={{width: "24px", marginRight: "8px"}} />@doil_0213</p>
          <p className={styles.profileText}><img src="/envelope.png" alt="Email" style={{width: "24px", marginRight: "8px"}} />novslog@gmail.com</p>
        </div>

        <div className={styles.profileTextContainer}>
          <p className={`${styles.profileText} ${styles.profileTextGreeting}`}>こんにちは。</p>
          <p className={styles.profileText}>人生をゲームでデザインするプログラマーDo2です<br></br>
          </p>
        </div>
      </div>
      
      <h2 className={styles.newsHeading}>News</h2>
      <hr className={styles.newsLine} />
      {children}

      {/* <h2 className={styles.newsHeading}>Project</h2>
      <hr className={styles.newsLine} />
      <div className={styles.profileSection}>
        <img src="/Vocoon.png" alt="Vocoon" className={styles.profileImage} />
        <div className={styles.profileTextContainer}>
          <p className={`${styles.profileText} ${styles.profileTextGreeting}`}>Vocoon</p>
          <p className={styles.profileText}>制作期間 : 2025.07.21~ 2025.08.xx</p>
          <p className={styles.profileText}>使用技術 : React, MongoDB(NoSql), ReactNative, Electron</p>
          <p className={styles.profileText}>人員 : 1人</p>
          <p className={styles.profileText}>Github : https://github.com/novvvv/Voca</p>
          <p className={styles.profileText}>単語帳にゲーミフィケーション要素を導入したウェブアプリアプリケーションです。</p>
        </div>
      </div> */}

      
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