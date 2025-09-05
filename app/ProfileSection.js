import styles from './ProfileSection.module.css'

export default function ProfileSection() {
    return (
        <div>
        <div className={styles.profileSection}>

        {/* 오른쪽 프로필 카드 */}
        <div className={styles.profileCard}>
          <div className={styles.profileCardTop}>
            <img src="/234.jpg" alt="Profile"  className={styles.profileImageRect}/>
            <p>Do2<br></br>
            @novslog</p>
          </div>

          <div className={styles.profileCardBottom}>
            <h4>Category</h4>
            <ul className={styles.categoryList}>
              <li><a href="/list/programming">Programming</a></li>
              <li><a href="/list/react">- React</a></li>
              <li><a href="/list/Japan">Japanese</a></li>
              <li><a href="/list/devlog">DevLog</a></li>
            </ul>
          </div>

          {/* <img src="/234.jpg" alt="Profile"  /> */}
        </div>

      </div>
      </div>
    )
}
