'use client'

import { useState, useEffect } from 'react';
import styles from '../../components/home/Home.module.css'

export default function Comment(props) {

    let [comment, setComment] = useState('')
    let [data, setData] = useState([])

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
                        <p key={i}>{a.content}</p>
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
