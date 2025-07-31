'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'; // Prism.js 
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Theme 

const CodeContentRenderer = ({ content }) => {

  // react-markdown에 전달할 형식을 정의 
  const components = {

    // react-markdown이 코드 블록(```)을 만날때 마다 호출된다. 
    code({ node, inline, className, children, ...props }) {

      // className에서 'language-js' 와 같은 언어 정보를 정규표현식을 사용해 추출.
      // React Markdown은 CommonMark라는 표준 마크다운 명세를 따른다. 
      const match = /language-(\w+)/.exec(className || '');
      
      // 인라인 코드가 아니고(별도의 블록이고), 언어 정보가 있다면
      if (!inline && match) {
        return (
          <SyntaxHighlighter
            style={vscDarkPlus} // 적용할 테마
            language={match[1]} // 감지된 언어 (e.g., 'javascript')
            PreTag="div" // 코드를 감싸는 태그
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        );
      } else {
        
        // 언어 정보가 없는 일반 코드 블록이나 인라인 코드는 기본 <code> 태그로 렌더링
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      }
    },
  };

  return (
    // prose 클래스는 tailwindcss-typography 플러그인에서 제공하는 스타일로, 
    // 마크다운 컨텐츠를 보기 좋게 만들어줍니다. 만약 tailwindcss를 사용하지 않는다면 이 클래스는 제거해도 됩니다.
    <div className="prose dark:prose-invert">
      <ReactMarkdown components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default CodeContentRenderer;
