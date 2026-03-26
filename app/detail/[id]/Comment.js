'use client'

import { useState, useEffect } from 'react';
<<<<<<< HEAD
import styles from '../../Home.module.css'
=======
import styles from '../../components/home/Home.module.css'
>>>>>>> ace024c (fix: 블로그 구조 변경)

export default function Comment(props) {

    let [comment, setComment] = useState('')
    let [data, setData] = useState([])

    // client Component 로드시 서버에 데이터를 요청하는 경우 
    // useEffect
    // 1. html이 재로드/렌더링 될때마다 실행된다.
    // 2. html을 보여준 후에 실행된다.
    // 원래는 Ajax 요청을 완료한 후에 Html을 랜더링 하는 것이 로직상으로는 맞지만 
    // Ajax 요청으로 댓글을 가져오는 동안 Html을 랜더링 해주지 않으면, 유저가 느린 사이트라고 인식하기에
    // 우선 Html을 먼저 로딩한 후 댓글 데이터를 가져와서 출력한다. 

    /* 
       1. Comment 컴포넌트 로드시 서버로 ajax 요청해서 데이터가져옴 
       2. 가져온 데이터를 변수나 state에 저장해두고 
       3. 변수나 state에 있던 댓글 데이터를 html에 꽂아서 보여줌 
     */

    useEffect(() => {
        fetch('/api/comment/list?id=' + props._id).then((result) => result.json() )
        .then((result) => setData(result))
    }, [])

    return (
        <div>

            <hr className={styles.newsLine} />
            {
                data.length > 0 ?
                data.map((a, i) => {
                    return(
                        <p>{a.content}</p>
                    )
                }) :
                ''
            }

            <input onChange={(e)=>{ setComment(e.target.value) }}/>

            <button onClick={()=> {
                fetch('/api/post/comment', {
                    method: 'POST', 
                    body: JSON.stringify({
                        comment: comment, 
                        _id: props._id,
                    }),
                })
            }}>
                댓글전송
            </button>

        </div>
    )
}

// React 에서는 유저가 입력한 값을 State에 저장해두고 씀.
// ObjectId('~)
// content : "댓글내용"
// author : "email"
// parent : "ObjectId("부모게시물 ID")

// 댓글 작성하면, ObjectId, Content를 같이 벡터화 시켜서 RAG DB에 저장해야하나?