'use client'

import styles from './Home.module.css'

export default function HomeClient({ children }) {

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.homeShell}>{children}</div>
    </div>
  )
}
