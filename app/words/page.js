'use client'

import React, { useState } from 'react'
import {
  useReactTable, // table Hook
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import './Words.css'

const columnHelper = createColumnHelper()

export default function Words() {

  const [word, setWord] = useState('')
  const [meaning, setMeaning] = useState('')
  const [data, setData] = useState([])

  const columns = [
    columnHelper.accessor('word', {
      header: '영단어',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('meaning', {
      header: '뜻',
      cell: info => info.getValue(),
    }),
  ]

  // useReactTable Hook 
  // react-table library에서 제공하는 테이블 상태를 관리하는 훅 
  // data(필수) : 실제 테이블에 보여줄 데이터 배열 (단어 리스트)
  // columns(필수) : 각 컬럼에 대한 정의 (컬럼 헤더, 셀에 표시할 내용, 필터링, 정렬 등)
  // getCoreRowModel() : 행 모델을 만들어 테이블 상태에 반영하는 함수. 자동으로 행을 계산하고 반환해준다. 
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!word || !meaning) return
    setData(prev => [...prev, { word, meaning }])
    setWord('')
    setMeaning('')
  }

  return (
    <div className="words-container">
      <h1 className="words-title">단어장</h1>
      <form onSubmit={handleSubmit} className="words-form">
        <input
          type="text"
          placeholder="단어"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          className="words-input"
        />
        <input
          type="text"
          placeholder="뜻"
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          className="words-input"
        />
        <button type="submit" className="words-button">
          추가
        </button>
      </form>

      <table className="words-table">
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
