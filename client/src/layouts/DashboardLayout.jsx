import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = (name) =>
    name
      ?.split(" ")
      .map((n) => n[0]?.toUpperCase()) 
      .join("") || "U";

  const isActive = (p) => location.pathname === p;

  const navLinks = [
    { to: "/", label: "Dashboard" },
    { to: "/screener", label: "Screener" },
    { to: "/positions", label: "Positions" },
    { to: "/performance", label: "Performance" },
    { to: "/ticker/SPY", label: "Ticker Details" },
  ];

  return (
    <div className="w-full h-screen overflow-hidden bg-[#f4f7fb]">

      {/* ============================
          APP GRID
      ============================= */}
      <div className="flex h-full">

        {/* ============================
            LEFT SIDEBAR (fixed width)
        ============================= */}
        <aside className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col">

          {/* LOGO */}
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
              MyInvesting
            </h1>
            <p className="text-xs text-gray-400 mt-1">Premium Dashboard</p>
          </div>

          {/* NAV (independent scroll) */}
          <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`
                  flex items-center px-4 py-3 rounded-lg text-sm font-medium transition
                  ${
                    isActive(to)
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }
                `}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* FOOTER */}
          <div className="p-4 border-t border-gray-200 text-xs text-gray-400">
            © 2025 MyInvesting
          </div>
        </aside>

        {/* ============================
            MAIN COLUMN
        ============================= */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* ============================
              TOP BAR (no horizontal shift)
          ============================= */}
          <header className="shrink-0 bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900 truncate">
              {isActive("/")
                ? "Dashboard Overview"
                : location.pathname.startsWith("/screener")
                ? "Market Screener"
                : location.pathname.startsWith("/positions")
                ? "Your Positions"
                : location.pathname.startsWith("/performance")
                ? "Performance"
                : location.pathname.startsWith("/ticker")
                ? "Ticker Details"
                : "MyInvesting"}
            </h2>

            {/* USER MENU */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-3 bg-gray-100 px-3 py-2 rounded-full hover:bg-gray-200 transition border border-gray-300"
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold shadow">
                  {initials(user?.name)}
                </div>

                <span className="text-sm font-medium text-gray-800 hidden md:block max-w-[140px] truncate">
                  {user?.name}
                </span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-3 w-72 bg-white border border-gray-200 shadow-xl rounded-xl overflow-hidden z-50">
                  <div className="px-5 py-4 border-b">
                    <p className="font-semibold text-gray-900 truncate">
                      {user?.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user?.email}
                    </p>
                  </div>

                  <div className="py-2">
                    <Link
                      to="/account"
                      className="block px-5 py-3 hover:bg-gray-100 text-sm"
                    >
                      Account Information
                    </Link>

                    <Link
                      to="/settings"
                      className="block px-5 py-3 hover:bg-gray-100 text-sm"
                    >
                      Settings
                    </Link>

                    <button
                      onClick={logout}
                      className="block w-full text-left px-5 py-3 text-red-600 hover:bg-red-50 text-sm border-t"
                    >
                      Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* ============================
              PAGE CONTENT (only vertical scroll)
          ============================= */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-8">
            <Outlet />
          </main>

        </div>
      </div>
    </div>
  );
}
