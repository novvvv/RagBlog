'use client'

/**
 * error.js는 반드시 client Component로 정의해야 한다.
 * 같은 경로에 error.js가 존재하지 않다면 page.js는 상위 폴더로 error.js를 탐색해서 랜더링한다.  
 * 단, error.js는 layout.js에서 발생하는 에러는 탐지하지 못하며,
 * layout.js에서 발생하는 에러를 예외처리 하기 위해서는 global-error.js 파일을 사용해야 한다. 
 */

export default function error({error, reset}) {
    return(
        <div>
            <h1>Error!</h1>
            <button onClick={() => reset() }></button>
        </div>
    )
}