'use client'

import styles from './Home.module.css'

export default function HomeClient({ children }) {

  return (
    <div className={styles.pageWrapper}>

      {children}


    </div>
  )
}
