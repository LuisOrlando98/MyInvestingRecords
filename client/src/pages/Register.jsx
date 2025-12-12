import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

export default function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [marketing, setMarketing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirm) {
      return setError("Passwords do not match");
    }

    try {
      setLoading(true);

      await api.post("/api/auth/register", {
        name,
        email,
        password,
        acceptsMarketing: marketing,
      });

      setSuccess("Account created. Please login.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err.response?.data?.msg || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">

      {/* Fondo degradado */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#1d4ed8_0,_transparent_55%),radial-gradient(circle_at_bottom,_#0f766e_0,_transparent_55%)] opacity-60" />

      {/* Patrón */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px] opacity-40" />

      <div className="relative z-10 w-full max-w-xl p-8 bg-slate-900/80 border border-slate-700/60 rounded-2xl backdrop-blur-xl shadow-xl shadow-emerald-900/25">

        <h2 className="text-2xl font-semibold text-slate-50 mb-2">Create Account</h2>
        <p className="text-sm text-slate-400 mb-6">Join MyInvestingRecords for free</p>

        {error && (
          <div className="mb-4 text-xs rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 px-3 py-2">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 text-xs rounded-lg border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 px-3 py-2">
            {success}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleRegister}>
          <div>
            <label className="text-xs text-slate-300 mb-1 block">Full name</label>
            <input
              className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-700 text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs text-slate-300 mb-1 block">Email</label>
            <input
              type="email"
              className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-700 text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs text-slate-300 mb-1 block">Password</label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-700 text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs text-slate-300 mb-1 block">Confirm password</label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-700 text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-slate-600 bg-slate-900 text-emerald-500"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
            />
            Receive premium market insights
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm py-2.5 shadow-lg shadow-emerald-900/40 transition"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="mt-6 text-xs text-slate-400 flex items-center justify-between">
          <span>Already have an account?</span>
          <Link to="/login" className="text-emerald-300 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
