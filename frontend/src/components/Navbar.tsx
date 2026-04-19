import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiUrl } from "../api";

export default function Navbar() {
  const { user, token, logout } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setIsAdmin(false);
      return;
    }

    fetch(apiUrl("/api/admin/admins"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (cancelled) return;
        setIsAdmin(res.ok);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

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
          <NavLink to="/submissions" className={linkClass}>
            Submissions
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={linkClass}>
              Admin
            </NavLink>
          )}
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
