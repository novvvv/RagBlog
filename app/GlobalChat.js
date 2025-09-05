'use client'

import { useState } from 'react'
import styles from './Chat.module.css'

export default function GlobalChat() {
  
  const [chatVisible, setChatVisible] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState('chat') // 'home', 'chat', 'settings'

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { text: input, sender: 'me' };
    const loadingMessage = { sender: 'bot', loading: true };

    const newMessages = [...messages, userMessage, loadingMessage];
    setMessages(newMessages);
    setInput('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_CHAT_API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: "default", // 전역 챗봇이므로 default로 설정
          question: input
        }),
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
    <div>
      <button
        className={styles.chatToggleButton}
        onClick={() => setChatVisible(!chatVisible)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          width: '60px',
          height: '60px',
          borderRadius: '20px',
          backgroundColor: '#1a1a1a',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease',
          fontSize: '24px'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.05)'
          e.target.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)'
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)'
          e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}
      >
        💬
      </button>

      {chatVisible && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          width: '400px',
          height: '600px',
          zIndex: 1000,
          borderRadius: '15px',
          backgroundColor: '#fff',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
          border: '1px solid #e0e0e0',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* 상단 헤더 */}
          <div style={{ 
            padding: '20px 20px 15px 20px',
            backgroundColor: '#fff',
            borderBottom: '1px solid #f0f0f0'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '10px'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#333', fontWeight: 'bold' }}>AI 어시스턴트</h3>
              <button 
                onClick={() => setChatVisible(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '16px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '5px',
                  borderRadius: '50%',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                ✕
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
              안녕하세요! 무엇을 도와드릴까요? 😊
            </p>
          </div>
          
          {/* 메인 콘텐츠 영역 */}
          <div style={{ 
            flex: 1,
            overflowY: 'auto', 
            padding: '15px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            backgroundColor: '#fff'
          }}>
            {activeTab === 'home' && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
          
                <p style={{ color: '#666', fontSize: '14px' }}>
                  안녕하세요! Do2Dev 블로그에 오신 것을 환영합니다.
                </p>
                <p style={{ color: '#666', fontSize: '14px' }}>
                  채팅 탭을 눌러서 AI 어시스턴트와 대화해보세요!
                </p>
              </div>
            )}
            
            {activeTab === 'chat' && (
              <>
                {messages.length === 0 && (
                  <div style={{ 
                    textAlign: 'center', 
                    color: '#aaa',
                    fontSize: '14px',
                    marginTop: '50px'
                  }}>
                    안녕하세요! 무엇을 도와드릴까요?
                  </div>
                )}
                {messages.map((message, index) => (
                  <div key={index} className={message.sender === 'me' ? styles.myMessage : styles.otherMessage}>
                    {message.loading ? (
                      <div className={styles.typingBubble}>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    ) : (
                      message.text
                    )}
                  </div>
                ))}
              </>
            )}
            
            {activeTab === 'settings' && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <h3 style={{ color: '#333', marginBottom: '15px' }}>설정</h3>
                <p style={{ color: '#666', fontSize: '14px' }}>
                  AI 어시스턴트 설정을 관리할 수 있습니다.
                </p>
                <div style={{ marginTop: '20px' }}>
                  <button style={{
                    backgroundColor: '#f0f0f0',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    cursor: 'pointer',
                    margin: '5px'
                  }}>
                    테마 변경
                  </button>
                  <button style={{
                    backgroundColor: '#f0f0f0',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    cursor: 'pointer',
                    margin: '5px'
                  }}>
                    알림 설정
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* 입력 영역 (채팅 탭에서만 표시) */}
          {activeTab === 'chat' && (
            <div className={styles.chatInputArea} style={{
              padding: '15px',
              backgroundColor: '#f8f9fa',
              borderTop: '1px solid #e0e0e0'
            }}>
              <textarea
                className={styles.textarea}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="메시지를 입력하세요..."
                rows="2"
                style={{
                  backgroundColor: '#fff',
                  color: '#333',
                  border: '1px solid #ddd',
                  borderRadius: '10px',
                  padding: '10px',
                  resize: 'none',
                  outline: 'none',
                  width: '100%',
                  marginBottom: '10px'
                }}
              />
              <button 
                className={styles.sendButton} 
                onClick={handleSend}
                style={{
                  backgroundColor: '#007AFF',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  transition: 'background-color 0.2s ease',
                  width: '100%'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#0056CC'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#007AFF'}
              >
                전송
              </button>
            </div>
          )}
          
          {/* 하단 네비게이션 */}
          <div style={{
            height: '60px',
            backgroundColor: '#f8f9fa',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around'
          }}>
            <div 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                transition: 'background-color 0.2s ease',
                backgroundColor: activeTab === 'home' ? '#e3f2fd' : 'transparent'
              }}
              onClick={() => setActiveTab('home')}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#e9ecef'}
              onMouseLeave={(e) => e.target.style.backgroundColor = activeTab === 'home' ? '#e3f2fd' : 'transparent'}
            >
              <span style={{ fontSize: '20px', marginBottom: '2px' }}>🏠</span>
              <span style={{ fontSize: '12px', color: activeTab === 'home' ? '#1976d2' : '#666' }}>홈</span>
            </div>
            
            <div 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                transition: 'background-color 0.2s ease',
                position: 'relative',
                backgroundColor: activeTab === 'chat' ? '#e3f2fd' : 'transparent'
              }}
              onClick={() => setActiveTab('chat')}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#e9ecef'}
              onMouseLeave={(e) => e.target.style.backgroundColor = activeTab === 'chat' ? '#e3f2fd' : 'transparent'}
            >
              <span style={{ fontSize: '20px', marginBottom: '2px' }}>💬</span>
              <span style={{ fontSize: '12px', color: activeTab === 'chat' ? '#1976d2' : '#666' }}>채팅</span>
              <div style={{
                position: 'absolute',
                top: '5px',
                right: '5px',
                width: '8px',
                height: '8px',
                backgroundColor: '#ff4444',
                borderRadius: '50%'
              }}></div>
            </div>
            
            <div 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                transition: 'background-color 0.2s ease',
                backgroundColor: activeTab === 'settings' ? '#e3f2fd' : 'transparent'
              }}
              onClick={() => setActiveTab('settings')}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#e9ecef'}
              onMouseLeave={(e) => e.target.style.backgroundColor = activeTab === 'settings' ? '#e3f2fd' : 'transparent'}
            >
              <span style={{ fontSize: '20px', marginBottom: '2px' }}>⚙️</span>
              <span style={{ fontSize: '12px', color: activeTab === 'settings' ? '#1976d2' : '#666' }}>설정</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
