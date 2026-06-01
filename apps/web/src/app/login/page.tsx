"use client";

import { FormEvent, useEffect, useState } from "react";
import { useLogin } from "@/features/auth/use-auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();

  // Asynchronously pre-fetch Cognito identity library and warm up DB pool
  useEffect(() => {
    // 1. Pre-fetch Cognito library in the background while user is typing
    void import("@/lib/cognito").catch(() => {});

    // 2. Wake up database serverless instance (Neon DB warm-up)
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
    void fetch(`${apiBaseUrl}/health`).catch(() => {});
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <main className="app-background grid place-items-center px-6 py-12">
      <div className="ambient-orb -top-36 -left-32 h-[520px] w-[520px] bg-teal-300/22" />
      <div className="ambient-orb -right-28 bottom-8 h-[460px] w-[460px] bg-sky-300/18 [animation-delay:1.5s]" />
      <div className="ambient-orb left-[48%] top-[18%] h-[360px] w-[360px] bg-emerald-200/16 [animation-delay:3s]" />

      <form
        className="content-layer grid w-full max-w-[440px] gap-6 rounded-3xl border border-white/80 bg-white/72 p-9 shadow-2xl shadow-teal-950/10 backdrop-blur-2xl transition-all duration-500 animate-rise-in hover:-translate-y-1 hover:shadow-teal-950/15"
        onSubmit={handleSubmit}
      >
        <div className="text-center">
          {/* Custom Squircle Brand Mark */}
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-500 text-base font-black text-white shadow-lg shadow-teal-700/25 transition-transform duration-500 hover:rotate-3 hover:scale-105">
            SF
          </div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-teal-700">
            StockFlow Cloud
          </p>
          <h1 className="m-0 text-3xl font-black tracking-tight text-slate-900">Welcome Back</h1>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Sign in to manage your multi-branch operations
          </p>
        </div>

        <div className="grid gap-5">
          <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Email Address</span>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-slate-400">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </span>
              <input
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white/90 pl-12 pr-4.5 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 shadow-sm shadow-slate-100/50"
                autoComplete="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
                placeholder="name@company.com"
              />
            </div>
          </label>

          <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Password</span>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-slate-400">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </span>
              <input
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white/90 pl-12 pr-12 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 shadow-sm shadow-slate-100/50"
                autoComplete="current-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type={showPassword ? "text" : "password"}
                value={password}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 cursor-pointer text-slate-400 transition-colors hover:text-teal-600 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M1 1l22 22"
                    />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </label>
        </div>

        {login.error ? (
          <p className="m-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-xs font-bold text-red-700 animate-slide-down">
            {login.error instanceof Error ? login.error.message : String(login.error)}
          </p>
        ) : null}

        <button
          className="min-h-11 cursor-pointer rounded-xl bg-teal-700 font-bold text-white shadow-lg shadow-teal-700/20 transition-all duration-200 hover:bg-teal-800 hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-75 disabled:hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-500/10"
          disabled={login.isPending}
          type="submit"
        >
          {login.isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
