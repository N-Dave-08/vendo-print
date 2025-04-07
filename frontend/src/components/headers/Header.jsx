import React from 'react'
import { ezlogo } from '../../assets/Icons'

export default function Header() {
  return (
    <div className="navbar bg-base-100 rounded-box shadow-sm mb-6 px-4">
      <div className="flex flex-row items-center gap-3">
        <img src={ezlogo} alt="EZ Logo" className="w-14 h-14" />
        <h1 className="text-2xl font-bold text-primary">
          Kiosk Vendo Printer
        </h1>
      </div>
    </div>
  )
}
