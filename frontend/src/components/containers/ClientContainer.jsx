import React from 'react'
import Header from '../headers/Header'

export default function ClientContainer({ children }) {
  return (
    <div className='min-h-screen relative'>
      <Header />
      {children}
    </div>
  )
}
