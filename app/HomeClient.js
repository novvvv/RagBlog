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
          <p className={`${styles.profileText} ${styles.profileTextGreeting}`}>About Me</p>
          <p>안녕하세요! 웹어플리케이션 개발자 Do2입니다.<br></br>
          일본어 학습자를 위한 다양한 서비스를 개발중에 있습니다.</p>
          <p><b>Tech Stack</b></p>
          <p>- FrontEnd : HTML, CSS, JavaScript, React <br></br>
          - BackEnd : NextJS, NestJS, Spring</p>
          <p><b>Certificate</b></p>
          <p>- JLPT N1 150<br></br>
          - SJPT Level 6<br></br>
          - SQLD<br></br>
          - AWS Free Tier
          </p>
          <p>일본어 번역, 어플리케이션 개발 외주 의뢰는 하단의 메일로 연락 부탁드립니다.</p>

        </div>

        {/* 오른쪽 프로필 카드 */}
        <div className={styles.profileCard}>
          <div className={styles.profileCardTop}>
            <img src="/profile_.png" alt="Profile" className={styles.profileImageRect} />
            <p>Do2<br></br>
            @novslog</p>
            <button>Book Mark</button>
          </div>

          <div className={styles.profileCardBottom}>
            <p><b>Category</b></p>
            <p>Programming</p>
            <p>- React</p>
            <p>Japanese</p>
          </div>
        </div>

      </div>
{/*       
      <h2 className={styles.newsHeading}>News</h2>
      <hr className={styles.newsLine} /> */}
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
