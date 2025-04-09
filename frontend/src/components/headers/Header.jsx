import React from 'react'
import { ezlogo } from '../../assets/Icons'

export default function Header() {
  return (
    <div className="navbar bg-base-100 shadow-lg rounded-box mb-6">
      <div className="navbar-start">
        <div className="flex items-center gap-4">
          <img src={ezlogo} alt="EZ Logo" className="w-12 h-12" />
          <h1 className="text-2xl font-bold text-primary">
            Kiosk Vendo Printer
          </h1>
        </div>
      </div>
    </div>
  )
}
