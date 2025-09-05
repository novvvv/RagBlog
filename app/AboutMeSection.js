import styles from './AboutMeSection.module.css'

export default function AboutMeSection() {
    return (
        <>
            <div className={styles.profileTextContainer}>

                {/* <p className={`${styles.profileText} ${styles.profileTextGreeting}`}>About Me</p>
                <hr className="solidLine" /> */}
                
                {/* <img src="/profile.png" alt="Profile" className={styles.profileImage} /> */}
                
                <p>안녕하세요! 웹어플리케이션 개발자 Do2입니다.<br></br>
                일본어 학습자를 위한 다양한 서비스를 개발중에 있습니다.</p>
                <p><b>Tech Stack</b></p>
                <p>FrontEnd : HTML, CSS, JavaScript, TypeScript, React <br></br>
                BackEnd : SpringBoot</p>
                <p><b>Certificate</b></p>
                <p>- JLPT N1 150<br></br>
                - SQLD<br></br>
                - AWS Certified Cloud Practitioner
                </p>
                <p>일본어 번역, 어플리케이션 개발 외주 의뢰는 하단의 메일로 연락 부탁드립니다.</p>

            </div>
        </>
        
    )
}
