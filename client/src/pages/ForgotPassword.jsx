import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      await api.post("/api/auth/forgot-password", { email });
      setMessage("If the email exists, a reset code has been sent.");
    } catch (err) {
      setError("An error occurred");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#1d4ed8_0,_transparent_55%),radial-gradient(circle_at_bottom,_#0f766e_0,_transparent_55%)] opacity-60" />

      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px] opacity-40" />

      <div className="relative z-10 max-w-md w-full p-8 bg-slate-900/80 border border-slate-700/60 rounded-2xl shadow-xl shadow-emerald-900/25 backdrop-blur-xl">

        <h2 className="text-2xl font-semibold text-slate-50 mb-2">Forgot Password</h2>
        <p className="text-sm text-slate-400 mb-6">Enter your email to reset your password</p>

        {message && (
          <div className="mb-4 text-xs rounded-lg border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 px-3 py-2">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-4 text-xs rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 px-3 py-2">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs text-slate-300 mb-1 block">Email</label>
            <input
              type="email"
              className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-700 text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500"
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm py-2.5 shadow-lg shadow-emerald-900/40 transition"
          >
            Send reset code
          </button>
        </form>

        <div className="mt-6 text-xs text-slate-400 text-center">
          <Link
            to="/login"
            className="text-emerald-300 hover:underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
