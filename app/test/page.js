'use client'
export default function ClientComponent() {
  return (
    <span onClick = {(r) => {
      fetch('/api/test', {
          method: 'POST',
          body: "Hello Nov"
      }).then((r) => {
          return r.json()
      })
    }}>Send</span>
  );
}

