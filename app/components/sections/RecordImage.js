'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import styles from './RecordImage.module.css'

const TRACKS = [
  { title: 'sleepy wood', videoId: 'pyY3jaHaMx4' },
  { title: 'アナイダアカデミア', videoId: 'JT4QLe_XH2s' },
]

export default function RecordImage() {
  const playerRef = useRef(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [volume, setVolume] = useState(35)
  const [isShuffle, setIsShuffle] = useState(false)
  const [isRepeat, setIsRepeat] = useState(false)
  const stableId = useId()
  const playerId = useMemo(() => `yt-mini-player-${stableId.replace(/:/g, '')}`, [stableId])

  useEffect(() => {
    const loadPlayer = () => {
      if (!window.YT || !window.YT.Player || playerRef.current) return
      playerRef.current = new window.YT.Player(playerId, {
        width: '1',
        height: '1',
        videoId: TRACKS[0].videoId,
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0 },
        events: {
          onReady: (event) => {
            setIsPlayerReady(true)
            event.target.setVolume(volume)
            event.target.cueVideoById(TRACKS[0].videoId)
          },
          onStateChange: (event) => {
            const YTState = window.YT?.PlayerState
            if (!YTState) return
            if (event.data === YTState.PLAYING) setIsPlaying(true)
            if (event.data === YTState.PAUSED || event.data === YTState.CUED) setIsPlaying(false)
            if (event.data === YTState.ENDED) playNext()
          },
        },
      })
    }

    if (window.YT && window.YT.Player) { loadPlayer(); return }

    const existing = document.getElementById('youtube-iframe-api')
    if (!existing) {
      const tag = document.createElement('script')
      tag.id = 'youtube-iframe-api'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(tag)
    }

    const previousReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === 'function') previousReady()
      loadPlayer()
    }
  }, [playerId, volume])

  const getPlayer = () => {
    const player = playerRef.current
    if (!isPlayerReady || !player) return null
    if (typeof player.loadVideoById !== 'function') return null
    return player
  }

  useEffect(() => {
    const player = getPlayer()
    if (player && typeof player.setVolume === 'function') player.setVolume(volume)
  }, [volume, isPlayerReady])

  const playByIndex = (idx, forcePlay = true) => {
    const player = getPlayer()
    if (!player) return
    const safeIdx = (idx + TRACKS.length) % TRACKS.length
    setCurrentIndex(safeIdx)
    forcePlay ? player.loadVideoById(TRACKS[safeIdx].videoId) : player.cueVideoById(TRACKS[safeIdx].videoId)
  }

  const playNext = () => {
    const player = getPlayer()
    if (!player) return
    if (isRepeat) { playByIndex(currentIndex, true); return }
    if (isShuffle) { playByIndex(Math.floor(Math.random() * TRACKS.length), true); return }
    playByIndex(currentIndex + 1, true)
  }

  const playPrev = () => playByIndex(currentIndex - 1, true)

  const togglePlayPause = () => {
    const player = getPlayer()
    if (!player) return
    isPlaying ? player.pauseVideo() : player.playVideo()
  }

  return (
    <div className={styles.playerWrap}>
      <div className={styles.hiddenPlayer}><div id={playerId} /></div>

      {/* Record */}
      <div
        className={`${styles.record} ${isPlaying ? styles.spinning : ''}`}
        onClick={togglePlayPause}
      >
        <div className={styles.grooves} />
        <div className={styles.recordCenter}>
          <span className={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</span>
        </div>
      </div>

      {/* Now Playing Bar */}
      <div className={styles.nowBar}>
        <div className={styles.nowInfo}>
          <span className={styles.nowIndex}>{String(currentIndex + 1).padStart(2, '0')}</span>
          <span className={styles.nowTitle}>{TRACKS[currentIndex].title}</span>
        </div>

        <div className={styles.nowControls}>
          <button onClick={playPrev} disabled={!isPlayerReady}>‹</button>
          <button onClick={togglePlayPause} disabled={!isPlayerReady} className={styles.playBtn}>
            {isPlaying ? '||' : '▶'}
          </button>
          <button onClick={playNext} disabled={!isPlayerReady}>›</button>
        </div>
      </div>

      {/* Volume + Options */}
      <div className={styles.subRow}>
        <div className={styles.volWrap}>
          <input
            type="range" min="0" max="100" value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Track List */}
      <div className={styles.trackList}>
        {TRACKS.map((track, idx) => (
          <button
            key={track.videoId}
            className={idx === currentIndex ? styles.activeTrack : ''}
            disabled={!isPlayerReady}
            onClick={() => playByIndex(idx, true)}
          >
            <span className={styles.tNum}>{String(idx + 1).padStart(2, '0')}</span>
            <span>{track.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
