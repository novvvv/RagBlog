'use client'

import { useState } from 'react';

export default function Comment() {

    let [comment, setComment] = useState('')

    return (
        <div>
            <div>댓글 목록 보여줄 부분</div>
            <input onChange={(e)=>{ setComment(e.target.value) }}/>
            <button onClick={()=>{
                console.log(comment)
                fetch('/URL', {metohd: 'POST', body: comment} )
            }}>댓글전송</button>
        </div>
    )
}

// React 에서는 유저가 입력한 값을 State에 저장해두고 씀.
// ObjectId('~)
// cotent : "댓글내용"
// author : "email"
// parent : "ObjectId("부모게시물 ID")