'use client'

import { useState, useRef, useEffect } from 'react'
import styles from './Chat.module.css'

export default function Chat({ postId = "default" }) {
  const [phoneVisible, setPhoneVisible] = useState(false)
  const [screen, setScreen] = useState('home')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleToggle = () => {
    if (phoneVisible) {
      setPhoneVisible(false)
      setTimeout(() => setScreen('home'), 300)
    } else {
      setPhoneVisible(true)
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return
    const userMessage = { text: input, sender: 'me' }
    const loadingMessage = { sender: 'bot', loading: true }
    const newMessages = [...messages, userMessage, loadingMessage]
    setMessages(newMessages)
    setInput('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_CHAT_API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, question: input }),
      })
      const data = await res.json()
      setMessages(newMessages.map(m => m.loading ? { text: data.answer, sender: 'bot' } : m))
    } catch {
      setMessages(newMessages.map(m => m.loading ? { text: '응답 중 오류가 발생했습니다.', sender: 'bot' } : m))
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div>
      <button className={styles.chatToggleButton} onClick={handleToggle} aria-label="채팅">
        {phoneVisible ? '✕' : '↗'}
      </button>

      {phoneVisible && (
        <div className={styles.iphoneFrame}>
          <div className={styles.statusBar}>
            <span className={styles.statusBarTime}></span>
            <span className={styles.statusBarIcons}></span>
          </div>
          <div className={styles.dynamicIsland} />
          <div className={styles.screenContent}>
            {screen === 'home' ? (
              <div className={styles.homeScreen}>
                <p className={styles.homeGreeting}>질문하기</p>
                <p className={styles.homeSubtitle}>이 글에 대해 물어보세요</p>
                <div className={styles.appGrid}>
                  <div className={styles.appIcon} onClick={() => setScreen('chat')}>
                    <div className={styles.appIconSvg}>
                      <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                        <defs><linearGradient id="cg2" x1="0" y1="0" x2="60" y2="60"><stop offset="0%" stopColor="#34c759"/><stop offset="100%" stopColor="#248a3d"/></linearGradient></defs>
                        <rect width="60" height="60" rx="14" fill="url(#cg2)"/>
                        <path d="M30 16C21.2 16 14 22 14 29.5C14 33.6 16.2 37.2 19.6 39.5L18 44L23.2 41.4C25.3 42.1 27.6 42.5 30 42.5C38.8 42.5 46 36.5 46 29.5C46 22 38.8 16 30 16Z" fill="white"/>
                      </svg>
                    </div>
                    <span className={styles.appIconLabel}>AI Chat</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.chatScreen}>
                <div className={styles.chatHeader}>
                  <button className={styles.chatBackBtn} onClick={() => setScreen('home')}>‹</button>
                  <p className={styles.chatHeaderTitle}>AI Chat</p>
                </div>
                <div className={styles.chatMessages}>
                  {messages.length === 0 && (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>📝</div>
                      <p className={styles.emptyTitle}>이 글에 대해 질문하세요</p>
                      <p className={styles.emptyDesc}>AI가 글 내용을 기반으로<br/>답변해 드립니다</p>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div key={i} className={msg.sender === 'me' ? styles.myMessage : styles.otherMessage}>
                      {msg.loading
                        ? <div className={styles.typingBubble}><span></span><span></span><span></span></div>
                        : msg.text}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className={styles.chatInputArea}>
                  <textarea className={styles.textarea} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="메시지 입력..." rows="1" />
                  <button className={styles.sendButton} onClick={handleSend}>↑</button>
                </div>
              </div>
            )}
          </div>
          <div className={styles.homeIndicator} />
        </div>
      )}
    </div>
  )
}
