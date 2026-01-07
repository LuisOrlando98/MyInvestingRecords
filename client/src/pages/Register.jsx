// src/pages/Register.jsx
import { Link } from "react-router-dom";

export default function Register() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">

      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#1d4ed8_0,_transparent_55%),radial-gradient(circle_at_bottom,_#0f766e_0,_transparent_55%)] opacity-60" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px] opacity-40" />

      <div className="relative z-10 w-full max-w-lg p-8 bg-slate-900/80 border border-slate-700/60 rounded-2xl backdrop-blur-xl shadow-xl shadow-emerald-900/25 text-center">

        <div className="mb-4 inline-flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-500/15 border border-emerald-400/40">
          <span className="text-emerald-300 font-bold text-lg">MI</span>
        </div>

        <h2 className="text-2xl font-semibold text-slate-50 mb-2">
          Registrations are currently closed
        </h2>

        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          MyInvestingRecords is currently in a private access phase.
          New accounts are created by invitation only.
        </p>

        <p className="text-xs text-slate-500 mb-8">
          If you believe you should have access, please contact the administrator.
        </p>

        <Link
          to="/login"
          className="inline-flex items-center justify-center w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm py-2.5 shadow-lg shadow-emerald-900/40 transition"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
