'use client'

import { useRouter } from "next/navigation"

export default function DetailLink() {
    let router = useRouter()
    let a = usePathName() 
    let b = userSearchParams() 
    return (
        <button onClick={()=>{ router.push('/') }}>Button</button>
    )
}

// 뒤로가기 router.back
// 앞으로가기 router.forward
// 새로고침 router.refresh