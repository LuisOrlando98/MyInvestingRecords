// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/api/auth/login", {
        email: email.trim(),
        password,
        ip: window.location.hostname,
      });

      login(
        res.data.accessToken,
        res.data.refreshToken,
        res.data.user,
        remember
      );

      navigate("/");
    } catch (err) {
      const msg = err.response?.data?.msg;

      if (msg === "Account suspended") {
        setError(
          "Your account has been suspended. Please contact support for assistance."
        );
      } else if (msg === "User not found" || msg === "Incorrect password") {
        setError("Invalid email or password. Please try again.");
      } else if (
        msg === "Registrations are currently closed. Please contact the administrator."
      ) {
        setError(
          "Access is currently limited. New accounts are available by invitation only."
        );
      } else {
        setError(
          "We couldn’t sign you in right now. Please check your details and try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#1d4ed8_0,_transparent_55%),radial-gradient(circle_at_bottom,_#0f766e_0,_transparent_55%)] opacity-60" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px] opacity-40" />

      <div className="relative z-10 w-full max-w-5xl px-4 md:px-8">
        <div className="grid md:grid-cols-2 gap-8 items-center">

          {/* LEFT — Branding */}
          <div className="hidden md:flex flex-col gap-6 text-slate-100">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-700 bg-slate-900/60 w-fit backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs uppercase tracking-wide text-slate-300">
                MyInvestingRecords • Secure Access
              </span>
            </div>

            <h1 className="text-4xl lg:text-5xl font-semibold leading-tight">
              Welcome back,
              <span className="block text-emerald-400">
                manage your investments with confidence.
              </span>
            </h1>

            <p className="text-sm text-slate-300 max-w-md leading-relaxed">
              Sign in to access your real-time portfolio, advanced options
              analytics, and professional-grade trading tools inspired by
              platforms like Webull.
            </p>

            <div className="flex gap-6 text-xs text-slate-300 mt-2">
              <div className="flex flex-col">
                <span className="font-semibold text-slate-50 text-base">24/7</span>
                <span>Access from anywhere</span>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-slate-50 text-base">
                  Encrypted
                </span>
                <span>Secure authentication</span>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-slate-50 text-base">
                  Pro Tools
                </span>
                <span>Multi-leg strategies</span>
              </div>
            </div>
          </div>

          {/* RIGHT — Login Card */}
          <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl shadow-2xl shadow-emerald-900/20 backdrop-blur-xl p-6 md:p-8">

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-50">
                  Sign in
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Use your MyInvestingRecords account
                </p>
              </div>

              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center">
                <span className="text-emerald-300 text-lg font-bold">MI</span>
              </div>
            </div>

            {error && (
              <div className="mb-4 text-xs rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 px-3 py-2">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="text-xs text-slate-300 mb-1 block">
                  Email address
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-700 text-slate-100 text-sm outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-400"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="text-xs text-slate-300 mb-1 block">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-700 text-slate-100 text-sm outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-400"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500/70"
                  />
                  <span>Keep me signed in on this device</span>
                </label>

                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-emerald-300 hover:text-emerald-200 hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-sm font-semibold py-2.5 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/40"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 border-2 border-slate-900/40 border-t-slate-900 rounded-full animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            <div className="mt-6 text-xs text-slate-400 flex items-center justify-between">
              <span>Don’t have access yet?</span>
              <Link
                to="/register"
                className="text-emerald-300 hover:text-emerald-200 hover:underline"
              >
                Request access
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
