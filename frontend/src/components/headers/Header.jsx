import React from 'react'
import { ezlogo } from '../../assets/Icons'

export default function Header() {
  return (
    <div className="flex items-center gap-2 mb-6">
      <img src={ezlogo} alt="EZ Logo" className="size-14" />
      <h1 className="text-2xl font-bold text-[#31304D]">
        Kiosk Vendo Printer
      </h1>
    </div>
  )
}
