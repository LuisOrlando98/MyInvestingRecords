import React from "react";
import { Routes, Route } from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";
import Dashboard from "../pages/Dashboard";
import TickerDetails from "../pages/TickerDetails";
import Positions from "../pages/Positions";
import NewPosition from "../pages/NewPosition";
import EditPosition from "../pages/EditPosition";
import Performance from "../pages/Performance";

// 🔥 Nuevas rutas de usuario
import Login from "../pages/Login";
import Register from "../pages/Register";
import ForgotPassword from "../pages/ForgotPassword";
import ProtectedRoute from "../components/ProtectedRoute";

export default function AppRoutes() {
  return (
    <Routes>

      {/* 🟢 Rutas públicas (sin estar logueado) */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* 🔒 Rutas protegidas (requieren login) */}
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>

        <Route path="/" element={<Dashboard />} />
        <Route path="/ticker/:symbol" element={<TickerDetails />} />

        <Route path="/positions" element={<Positions />} />
        <Route path="/positions/new" element={<NewPosition />} />
        <Route path="/positions/:id/edit" element={<EditPosition />} />
        <Route path="/performance" element={<Performance />} />

      </Route>
    </Routes>
  );
}
