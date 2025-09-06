'use client'

import { useState } from 'react'

export default function RecordImage() {
  const [isSpinning, setIsSpinning] = useState(false)

  const handleClick = () => {
    setIsSpinning(!isSpinning)
  }

  return (
    <div style={{ 
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%'
    }}>
      <img 
        src="/record2.png" 
        alt="Record" 
        onClick={handleClick}
        style={{ 
          width: '300px', 
          height: '300px',
          borderRadius: '50%',
          animation: isSpinning ? 'spin 5s linear infinite' : 'none',
          cursor: 'pointer',
          transition: 'transform 0.3s ease',
          objectFit: 'cover'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.05)'
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)'
        }}
      />
      
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
