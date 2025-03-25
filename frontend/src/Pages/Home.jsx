import React from "react";
import { Link, useLocation } from "react-router-dom";
import { FaPrint, FaUser } from "react-icons/fa";

const Sidebar = () => {
  const location = useLocation(); // Get the current route

  return (
    <div className="w-20  min-h-screen bg-gray-900 flex flex-col items-center py-4">
      {/* Logo */}
      <div className="w-10 h-10 rounded-lg mb-10 flex items-center justify-center">
        <span className="text-white text-xl font-bold"></span>
      </div>

      {/* Menu Items */}
      <div className="flex flex-col space-y-8">
        {/* Printer Icon - Fully Rounded When Active */}
        <Link to="/printer">
          <div
            className={`w-20 h-12 flex items-center justify-center cursor-pointer transition ml-11  
              ${location.pathname === "/printer" ? "bg-white rounded-full" : "rounded-l-full"}
            `}
          >
            <FaPrint
              className={`text-2xl ml-[-4px]  // Increased icon size
                ${location.pathname === "/printer" ? "text-gray-900" : "text-white"}
              `}
            />
          </div>
        </Link>

        {/* Settings Icon - Fully Rounded When Active */}
        <Link to="/settings">
          <div
            className={`w-20 h-12 flex items-center justify-center cursor-pointer transition ml-11
              ${location.pathname === "/settings" ? "bg-white rounded-full" : "rounded-l-full"}
            `}
          >
            <FaUser
              className={`text-2xl ml-[-4px] // Increased icon size
                ${location.pathname === "/settings" ? "text-gray-900" : "text-white"}
              `}
            />
          </div>
        </Link>
      </div>
    </div>
  );
};

export default Sidebar;
