"use client";

import { FormEvent, useEffect, useState } from "react";
import { useLogin } from "@/features/auth/use-auth";
import { ThemeToggle } from "@/components/ThemeToggle";

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
    <main className="app-background grid place-items-center px-6 py-12 min-h-screen">
      {/* Floating Theme Toggle in top-right */}
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <form
        className="content-layer grid w-full max-w-[440px] gap-7 p-9 surface animate-rise-in"
        onSubmit={handleSubmit}
      >
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-lg bg-[var(--color-accent-solid)] text-base font-semibold text-white">
            SF
          </div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            StockFlow Cloud
          </p>
          <h1 className="m-0 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Welcome Back
          </h1>
          <p className="mt-2 text-xs font-normal text-slate-500 dark:text-slate-400">
            Sign in to manage your multi-branch operations
          </p>
        </div>

        <div className="grid gap-5">
          <label className="field">
            <span>Email Address</span>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-slate-400 dark:text-slate-500">
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
                className="input pl-12"
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

          <label className="field">
            <span>Password</span>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-slate-400 dark:text-slate-500">
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
                className="input pl-12 pr-12"
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
                className="absolute right-4 cursor-pointer text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200 focus:outline-none"
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
          <p className="m-0 rounded-lg border border-red-200/70 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-center text-xs font-medium text-red-700 dark:text-red-400 animate-slide-down">
            {login.error instanceof Error ? login.error.message : String(login.error)}
          </p>
        ) : null}

        <button className="button-primary w-full" disabled={login.isPending} type="submit">
          {login.isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
