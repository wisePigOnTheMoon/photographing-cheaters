import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-lg text-base font-semibold transition-colors ${
      isActive
        ? "bg-white text-gray-900 shadow-sm"
        : "text-gray-400 hover:text-white"
    }`;

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-2">
          <NavLink to="/upload" className={linkClass}>
            Upload
          </NavLink>
          <NavLink to="/leaderboard" className={linkClass}>
            Leaderboard
          </NavLink>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <img
              src={user.picture}
              alt={user.name}
              className="w-8 h-8 rounded-full"
              referrerPolicy="no-referrer"
            />
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
