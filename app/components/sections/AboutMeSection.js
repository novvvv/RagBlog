import styles from './AboutMeSection.module.css'
import path from 'path'
import { readdir } from 'fs/promises'

export default async function AboutMeSection() {
    let iconFiles = []
    try {
        const iconDir = path.join(process.cwd(), 'public', 'icon')
        const files = await readdir(iconDir)
        iconFiles = files
            .filter((f) => /\.(png|jpe?g|gif|webp|svg)$/i.test(f))
            .sort((a, b) => a.localeCompare(b))
    } catch {
        iconFiles = []
    }

    return (
        <>
            <div className={styles.profileTextContainer}>

                {/* <p className={`${styles.profileText} ${styles.profileTextGreeting}`}>About Me</p>
                <hr className="solidLine" /> */}
                
                {/* <img src="/profile.png" alt="Profile" className={styles.profileImage} /> */}
                
                <p>안녕하세요! 웹어플리케이션 개발자 Do2입니다.<br></br>
                일본어 학습자를 위한 다양한 서비스를 개발중에 있습니다.</p>

                <p>일본어 번역, 어플리케이션 개발 외주 의뢰는 하단의 메일로 연락 부탁드립니다.</p>


                {iconFiles.length > 0 && (
                    <div className={styles.iconRow} aria-label="아이콘">
                        {iconFiles.map((file) => (
                            <img
                                key={file}
                                src={`/icon/${file}`}
                                alt={file}
                                className={styles.iconImg}
                                loading="lazy"
                            />
                        ))}
                    </div>
                )}

            </div>
        </>
        
    )
}
