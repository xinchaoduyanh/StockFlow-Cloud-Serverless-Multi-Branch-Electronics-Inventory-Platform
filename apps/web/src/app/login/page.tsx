"use client";

import { FormEvent, useState } from "react";
import { useLogin } from "@/features/auth/use-auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-tr from-[#f1f5f9] via-[#f0fdfa] to-[#ecfdf5] p-6">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[20%] left-[30%] h-96 w-96 rounded-full bg-teal-200/30 blur-3xl" />
        <div className="absolute bottom-[20%] right-[30%] h-96 w-96 rounded-full bg-emerald-200/20 blur-3xl" />
      </div>

      <form
        className="grid w-full max-w-[420px] gap-6 rounded-2xl border border-white/40 bg-white/70 p-8 shadow-xl backdrop-blur-md transition-all duration-300 hover:shadow-2xl"
        onSubmit={handleSubmit}
      >
        <div className="text-center">
          <p className="mb-1 text-xs font-black uppercase tracking-wider text-teal-700">
            StockFlow Cloud
          </p>
          <h1 className="m-0 text-3xl font-extrabold tracking-tight text-[#0f172a]">
            Welcome Back
          </h1>
          <p className="mt-2 text-sm text-[#475569]">
            Sign in to manage your multi-branch operations
          </p>
        </div>

        <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-[#475569]">
          <span>Email Address</span>
          <input
            className="min-h-11 w-full rounded-lg border border-[#cbd5e1] bg-white/90 px-3 text-sm font-medium text-[#0f172a] outline-none transition-all focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10"
            autoComplete="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
            placeholder="name@company.com"
          />
        </label>

        <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-[#475569]">
          <span>Password</span>
          <div className="relative flex items-center">
            <input
              className="min-h-11 w-full rounded-lg border border-[#cbd5e1] bg-white/90 pl-3 pr-10 text-sm font-medium text-[#0f172a] outline-none transition-all focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10"
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
              className="absolute right-3 cursor-pointer text-[#64748b] transition-colors hover:text-teal-600 focus:outline-none"
              tabIndex={-1}
            >
              {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>
        </label>

        {login.error ? (
          <p className="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-700">
            {login.error instanceof Error ? login.error.message : String(login.error)}
          </p>
        ) : null}

        <button
          className="min-h-11 cursor-pointer rounded-lg bg-teal-700 font-bold text-white shadow-lg shadow-teal-700/10 transition-all duration-200 hover:bg-teal-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-75 disabled:hover:bg-teal-700"
          disabled={login.isPending}
          type="submit"
        >
          {login.isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" x2="23" y1="1" y2="23" />
    </svg>
  );
}
