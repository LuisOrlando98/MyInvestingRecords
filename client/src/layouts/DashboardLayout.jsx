import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Radar,
  Briefcase,
  TrendingUp,
  Search,
  ChevronRight,
  ChevronLeft,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);

  const initials = (name) =>
    name
      ?.split(" ")
      .map((n) => n[0]?.toUpperCase())
      .join("") || "U";

  const isActive = (path) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const navLinks = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/screener", label: "Screener", icon: Radar },
    { to: "/positions", label: "Positions", icon: Briefcase },
    { to: "/performance", label: "Performance", icon: TrendingUp },
    { to: "/ticker/SPY", label: "Ticker Details", icon: Search },
  ];

  return (
    <div className="w-full h-screen overflow-hidden bg-[#f5f7fb]">
      <div className="flex h-full">

        {/* ================= SIDEBAR ================= */}
        <aside
          className={`
            relative group transition-all duration-300
            ${collapsed ? "w-[84px]" : "w-72"}
            bg-white border-r border-gray-200 flex flex-col
          `}
        >
          {/* LOGO */}
          <div className="h-16 flex items-center justify-center border-b">
            <span className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
              {collapsed ? "MI" : "MyInvesting"}
            </span>
          </div>

          {/* NAV */}
          <nav className="flex-1 py-6 space-y-3">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`
                  mx-3 flex items-center gap-4 rounded-xl
                  px-4 py-3 text-sm font-medium transition-all
                  ${
                    isActive(to)
                      ? "bg-blue-100 text-blue-700"
                      : "text-slate-600 hover:bg-gray-100"
                  }
                `}
              >
                <Icon size={20} className="shrink-0 text-indigo-500" />
                {!collapsed && <span>{label}</span>}
              </Link>
            ))}
          </nav>

          {/* USER */}
          <div className="p-4 border-t space-y-3">
            <div className="flex flex-col items-center gap-2">
              <div
                className="
                  w-11 h-11 rounded-full flex items-center justify-center
                  bg-gradient-to-br from-blue-500 to-indigo-600
                  text-white font-bold shadow
                "
              >
                {initials(user?.name)}
              </div>

              {!collapsed && (
                <div className="text-center min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={logout}
              className="
                w-full flex items-center justify-center gap-2
                px-4 py-2 rounded-xl text-sm font-medium
                text-red-600 hover:bg-red-50 transition
              "
            >
              <LogOut size={16} />
              {!collapsed && <span>Sign out</span>}
            </button>
          </div>

          {/* COLLAPSE TOGGLE */}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="
              absolute top-1/2 -right-3 -translate-y-1/2
              w-7 h-7 rounded-full flex items-center justify-center
              bg-white border shadow-md
              opacity-0 group-hover:opacity-100 transition
            "
          >
            {collapsed ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )}
          </button>
        </aside>

        {/* ================= CONTENT ================= */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
