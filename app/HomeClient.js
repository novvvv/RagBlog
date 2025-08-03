'use client'

import styles from './Home.module.css'

export default function HomeClient({ children }) {

  return (
    <div className={styles.pageWrapper}>

      {/* News Header */}
      <h1 className={styles.newsHeading}>Do2Dev</h1>
      <br />
      <hr className={styles.newsLine} />
      <div className={styles.profileSection}>


        <div className={styles.profileTextContainer}>
          <img src="/profile_.png" alt="Profile" className={styles.profileImageRect} />
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

    </div>
  )
}
