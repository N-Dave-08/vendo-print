import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, User } from "lucide-react";

const Sidebar = () => {
  const location = useLocation(); // Get the current route

  return (
    <div className="h-screen w-20 bg-base-300 flex flex-col items-center py-6 shadow-lg">

      {/* Menu Items */}
      <div className="flex flex-col gap-4">

        {/* Printer Icon */}
        <Link to="/printer" className="w-full flex justify-center">
          <div
            className={`w-14 h-14 flex items-center justify-center btn btn-primary
              ${
                location.pathname === "/printer" 
                  ? "btn-active" 
                  : "btn-outline"
              }
            `}
          >
            <Home className="w-6 h-6" />
          </div>
        </Link>
      </div>

      {/* Admin Icon at Bottom */}
      {/* <div className="mt-auto mb-6">
        <Link to="/settings" className="w-full flex justify-center">
          <div
            className={`w-14 h-14 flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-base-100
              ${
                location.pathname === "/settings" 
                  ? "bg-primary text-primary-content rounded-xl shadow-md" 
                  : "text-base-content rounded-xl hover:shadow"
              }
            `}
          >
            <User className="w-6 h-6" />
          </div>
        </Link>
      </div> */}
    </div>
  );
};

export default Sidebar;
