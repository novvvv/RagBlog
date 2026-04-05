import "./globals.css";
import Link from "next/link"
import GlobalChat from "./components/chat/GlobalChat";
// import RecordImage from "./components/sections/RecordImage";

import LoginBtn from "./components/auth/login_btn.js"
import LogoutBtn from "./components/auth/logout_btn.js"
import { getServerSession } from "next-auth"
import { authOptions } from "@/pages/api/auth/[...nextauth]";

// import AboutMeSection from "./components/sections/AboutMeSection";

export const metadata = {
  title: "Do2Dev",
  description: "Do2Dev Blog",
};

export default async function RootLayout({ children }) {
  let session = await getServerSession(authOptions)

  return (
    <html lang="en">
      <body>
        <header className="navbar">
          <div className="navbar-left">
            <Link href="/">@Do2</Link>
          </div>
          <div className="navbar-right">
            <Link href="/list">Blog</Link>
            <Link href="/write">Write</Link>
            {session ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{session.user.name}</span>
                <LogoutBtn />
              </span>
            ) : (
              <LoginBtn />
            )}
          </div>
        </header>

        <div className="heroSection">
          <h1 className="newsHeading">Do2Dev</h1>
        </div>

        <nav className="subNav">
          <a href="/">Info</a>
          <a href="/list/programming">Programming</a>
          <a href="/list/Japan">Japanese</a>
          <a href="/list/devlog">DevLog</a>
        </nav>
        <hr className="newsLine" />

        {/*
        메인 랜딩은 app/page.js 의 RagLanding 으로 대체. 기존 소개·이미지 행은 비활성화.
        <div className="heroRow">
          <div><AboutMeSection /></div>
          <div><RecordImage /></div>
        </div>
        */}

        <div className="main-content-wrapper">
          <div className="main-page-content">
            {children}
          </div>
        </div>
        <footer className="footer">
          <p>&copy; 2025 Do2. All rights reserved.</p>
        </footer>

        <GlobalChat />
      </body>
    </html>
  );
}
