'use client'

import { useState, useRef, useEffect } from 'react'
import styles from './Chat.module.css'

function useCurrentTime() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }))
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [])
  return time
}

function StatusBarIcons() {
  return (
    <span className={styles.statusBarIcons}>
      <svg width="17" height="12" viewBox="0 0 17 12" fill="white">
        <rect x="0" y="7" width="3" height="5" rx="0.7"/>
        <rect x="4.5" y="4.5" width="3" height="7.5" rx="0.7"/>
        <rect x="9" y="2" width="3" height="10" rx="0.7"/>
        <rect x="13.5" y="0" width="3" height="12" rx="0.7" opacity="0.35"/>
      </svg>
      <svg width="16" height="12" viewBox="0 0 16 12" fill="white">
        <path d="M8 3C10.7 3 13.1 4.2 14.7 6.1L16 4.7C14 2.4 11.2 1 8 1S2 2.4 0 4.7L1.3 6.1C2.9 4.2 5.3 3 8 3Z" opacity="0.35"/>
        <path d="M8 6C9.8 6 11.4 6.8 12.4 8.1L13.7 6.7C12.3 5.1 10.3 4 8 4S3.7 5.1 2.3 6.7L3.6 8.1C4.6 6.8 6.2 6 8 6Z"/>
        <circle cx="8" cy="10.5" r="1.5"/>
      </svg>
      <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
        <rect x="0.5" y="0.5" width="22" height="12" rx="2.5" stroke="white" strokeOpacity="0.35"/>
        <rect x="24" y="3.5" width="2.5" height="5" rx="1" fill="white" fillOpacity="0.4"/>
        <rect x="2" y="2" width="17" height="9" rx="1.5" fill="#30d158"/>
      </svg>
    </span>
  )
}

function ChatAppIcon() {
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
      <rect width="60" height="60" rx="14" fill="linear"/>
      <defs>
        <linearGradient id="chatGrad" x1="0" y1="0" x2="60" y2="60">
          <stop offset="0%" stopColor="#34c759"/>
          <stop offset="100%" stopColor="#248a3d"/>
        </linearGradient>
      </defs>
      <rect width="60" height="60" rx="14" fill="url(#chatGrad)"/>
      <path d="M30 16C21.2 16 14 22 14 29.5C14 33.6 16.2 37.2 19.6 39.5L18 44L23.2 41.4C25.3 42.1 27.6 42.5 30 42.5C38.8 42.5 46 36.5 46 29.5C46 22 38.8 16 30 16Z" fill="white"/>
    </svg>
  )
}

export default function GlobalChat() {
  const [phoneVisible, setPhoneVisible] = useState(false)
  const [screen, setScreen] = useState('home')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const time = useCurrentTime()

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
        body: JSON.stringify({ post_id: 'global_rag', question: input }),
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
          {/* Status Bar */}
          <div className={styles.statusBar}>
            <span className={styles.statusBarTime}>{time || '00:00'}</span>
            <StatusBarIcons />
          </div>

          {/* Dynamic Island */}
          <div className={styles.dynamicIsland} />

          {/* Screen */}
          <div className={styles.screenContent}>
            {screen === 'home' ? (
              /* ── Home Screen ── */
              <div className={styles.homeScreen}>
                <p className={styles.homeGreeting}>Do2Dev</p>
                <p className={styles.homeSubtitle}>무엇이든 물어보세요</p>

                <div className={styles.appGrid}>
                  <div className={styles.appIcon}>
                    <img src="/icon/img_1.png" alt="App 1" className={styles.appIconImage} />
                    <span className={styles.appIconLabel}>Nekko</span>
                  </div>
                  <div className={styles.appIcon}>
                    <img src="/icon/img_2.png" alt="App 2" className={styles.appIconImage} />
                    <span className={styles.appIconLabel}>Kuro</span>
                  </div>
                  <div className={styles.appIcon} onClick={() => setScreen('chat')}>
                    <div className={styles.appIconSvg}>
                      <ChatAppIcon />
                    </div>
                    <span className={styles.appIconLabel}>AI Chat</span>
                  </div>
                </div>

              </div>
            ) : (
              /* ── Chat Screen ── */
              <div className={styles.chatScreen}>
                <div className={styles.chatHeader}>
                  <button className={styles.chatBackBtn} onClick={() => setScreen('home')}>‹</button>
                  <p className={styles.chatHeaderTitle}>AI Chat</p>
                </div>
                <div className={styles.chatMessages}>
                  {messages.length === 0 && (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>💬</div>
                      <p className={styles.emptyTitle}>무엇이든 물어보세요</p>
                      <p className={styles.emptyDesc}>AI가 블로그 내용을 기반으로<br/>답변해 드립니다</p>
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
                  <textarea
                    className={styles.textarea}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="메시지 입력..."
                    rows="1"
                  />
                  <button className={styles.sendButton} onClick={handleSend}>↑</button>
                </div>
              </div>
            )}
          </div>

          {/* Home Indicator */}
          <div className={styles.homeIndicator} />
        </div>
      )}
    </div>
  )
}
