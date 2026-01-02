import Link from 'next/link'

export default function Header() {
  return (
    <header className="w-full border-b border-[#26251E]/20">
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-[#26251E] hover:opacity-80 transition-opacity">
            novvv
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-[#26251E] hover:opacity-70 transition-opacity">
              Home
            </Link>
            <Link href="/posts" className="text-[#26251E] hover:opacity-70 transition-opacity">
              Posts
            </Link>
            <Link href="/write" className="text-[#26251E] hover:opacity-70 transition-opacity">
              Write
            </Link>
            <Link href="https://novlog.tistory.com/" target="_blank" className="text-[#26251E] hover:opacity-70 transition-opacity">
              Tistory
            </Link>
          </div>
        </div>
      </nav>
    </header>
  )
}

