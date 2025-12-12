import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Watchlist from "../components/watchlist/Watchlist";

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = (name) =>
    name
      ?.split(" ")
      .map((n) => n[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "U";

  const isActive = (p) => location.pathname === p;

  const navLinks = [
    { to: "/", label: "Dashboard" },
    { to: "/positions", label: "Positions" },
    { to: "/ticker/SPY", label: "Ticker Details" },
  ];

  return (
    <div className="w-full h-screen flex bg-[#f4f7fb]">

      {/* ============================
          LEFT FIXED SIDEBAR
      =============================*/}
      <aside
        className="
          fixed left-0 top-0 bottom-0 
          w-72 bg-white shadow-xl border-r border-gray-200 
          z-40 flex flex-col
        "
      >
        {/* LOGO */}
        <div className="p-8 border-b border-gray-200">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
            MyInvesting
          </h1>
        </div>

        {/* NAV */}
        <nav className="flex-1 p-6 overflow-y-auto space-y-3">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`
                block px-5 py-3 rounded-xl text-[15px] font-medium transition-all
                ${
                  isActive(to)
                    ? "bg-blue-100 text-blue-700 shadow-md"
                    : "text-gray-700 hover:bg-gray-100"
                }
              `}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* FOOTER */}
        <div className="p-5 border-t border-gray-200 text-xs text-gray-500">
          © 2025 MyInvesting — Premium Edition
        </div>
      </aside>

      {/* ============================
          RIGHT FIXED WATCHLIST WRAPPER
      =============================*/}
      <aside
        className="
          fixed right-0 top-0 bottom-0
          w-72 bg-white shadow-xl border-l border-gray-200
          z-40 flex flex-col
        "
      >
        <Watchlist />
      </aside>

      {/* ============================
          MAIN CONTENT
      =============================*/}
      <div className="flex-1 ml-72 mr-72 flex flex-col h-screen overflow-y-auto">

        {/* NAVBAR */}
        <header
          className="
            sticky top-0 z-50 
            bg-white shadow-md border-b border-gray-200
            px-10 py-4 flex justify-between items-center
          "
        >
          <h2 className="text-2xl font-semibold text-gray-900">
            {isActive("/")
              ? "Dashboard Overview"
              : location.pathname.includes("positions")
              ? "Your Positions"
              : "MyInvesting"}
          </h2>

          {/* USER DROPDOWN */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="
                flex items-center gap-3
                bg-gray-100 shadow px-4 py-2 rounded-full 
                hover:bg-gray-200 transition border border-gray-300
              "
            >
              <div
                className="
                  w-11 h-11 rounded-full flex items-center justify-center
                  bg-gradient-to-br from-blue-500 to-indigo-600 
                  text-white font-bold text-lg shadow
                "
              >
                {initials(user?.name)}
              </div>

              <span className="font-medium text-gray-800">
                {user?.name}
              </span>
            </button>

            {menuOpen && (
              <div
                className="
                  absolute right-0 mt-3 w-80
                  bg-white border border-gray-200 shadow-xl 
                  rounded-2xl overflow-hidden z-[99999]
                "
              >
                <div className="px-5 py-4 border-b bg-white">
                  <p className="font-semibold text-gray-900 text-lg">{user?.name}</p>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>

                <div className="py-2">
                  <Link
                    to="/account"
                    className="block px-5 py-3 hover:bg-gray-100 text-sm text-gray-800"
                  >
                    Account Information
                  </Link>

                  <Link
                    to="/settings"
                    className="block px-5 py-3 hover:bg-gray-100 text-sm text-gray-800"
                  >
                    Settings
                  </Link>

                  <button
                    onClick={logout}
                    className="
                      block w-full text-left px-5 py-3 text-red-600
                      hover:bg-red-50 border-t text-sm
                    "
                  >
                    Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
