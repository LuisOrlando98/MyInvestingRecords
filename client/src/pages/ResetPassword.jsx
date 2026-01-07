// src/pages/ResetPassword.jsx
import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "../services/api";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // token puede venir por link (?token=...)
  const tokenFromUrl = searchParams.get("token") || "";

  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      return setError("Reset token is required.");
    }

    if (password.length < 8) {
      return setError("Password must be at least 8 characters long.");
    }

    if (password !== confirm) {
      return setError("Passwords do not match.");
    }

    try {
      setLoading(true);

      await api.post("/api/auth/reset-password", {
        token,
        newPassword: password,
      });

      setMessage("Your password has been reset successfully.");

      setTimeout(() => {
        navigate("/login");
      }, 1800);
    } catch (err) {
      setError(
        err.response?.data?.msg ||
          "The reset link is invalid or has expired. Please request a new one."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#1d4ed8_0,_transparent_55%),radial-gradient(circle_at_bottom,_#0f766e_0,_transparent_55%)] opacity-60" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px] opacity-40" />

      <div className="relative z-10 max-w-md w-full p-8 bg-slate-900/80 border border-slate-700/60 rounded-2xl shadow-xl shadow-emerald-900/25 backdrop-blur-xl">

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center">
            <span className="text-emerald-300 font-bold text-lg">MI</span>
          </div>

          <h2 className="text-2xl font-semibold text-slate-50 mb-2">
            Set a new password
          </h2>

          <p className="text-sm text-slate-400 leading-relaxed">
            Choose a strong password to secure your account.
          </p>
        </div>

        {/* Success */}
        {message && (
          <div className="mb-4 text-xs rounded-lg border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 px-3 py-2">
            {message}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 text-xs rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 px-3 py-2">
            {error}
          </div>
        )}

        {/* Form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Token (solo visible si no viene por URL) */}
          {!tokenFromUrl && (
            <div>
              <label className="text-xs text-slate-300 mb-1 block">
                Reset code
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-700 text-slate-100 text-sm outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-400"
                placeholder="Enter the reset code"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>
          )}

          {/* New password */}
          <div>
            <label className="text-xs text-slate-300 mb-1 block">
              New password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-700 text-slate-100 text-sm outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-400"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Confirm password */}
          <div>
            <label className="text-xs text-slate-300 mb-1 block">
              Confirm new password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-700 text-slate-100 text-sm outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-400"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm py-2.5 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/40"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 border-2 border-slate-900/40 border-t-slate-900 rounded-full animate-spin" />
                Updating password…
              </>
            ) : (
              "Update password"
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-xs text-slate-400 text-center">
          <Link
            to="/login"
            className="text-emerald-300 hover:text-emerald-200 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
