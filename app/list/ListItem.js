'use client'

import Link from "next/link"

export default function ListItem(props) {
  return (
    <>
      {props.result.map((item, index) => (
        <div className="list-item" key={item._id}>

          <Link prefetch={false} href={`/detail/${item._id}`}>
            <h4>{item.title}</h4>
          </Link>

          <Link
            href={`/edit/${item._id}`}
            prefetch={false}
            className="btn-link"
          >
            ✏️
          </Link> 

          <span onClick = {() => {
            fetch('/api/post/delete', {
                method: 'DELETE',
                body: item._id
            }).then((r) => {
                return r.json()
            }).then((r) => {
              console.log(r)
            })
          }}>🗑️</span>

          <p>{item.content}</p>
        </div>
      ))}
    </>
  )
}