"use client";

import { FormEvent, useState } from "react";
import { useLogin } from "@/features/auth/use-auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <main className="grid min-h-screen place-items-center p-8">
      <form
        className="grid w-[min(100%,420px)] gap-5 rounded-lg border border-border bg-white p-7"
        onSubmit={handleSubmit}
      >
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-normal text-accent">
            StockFlow Cloud
          </p>
          <h1 className="m-0 text-3xl tracking-normal">Sign in</h1>
        </div>

        <label className="grid gap-2 text-sm font-bold text-muted">
          <span>Email</span>
          <input
            className="min-h-11 w-full rounded-md border border-border px-3 font-[inherit] text-foreground"
            autoComplete="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-muted">
          <span>Password</span>
          <input
            className="min-h-11 w-full rounded-md border border-border px-3 font-[inherit] text-foreground"
            autoComplete="current-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        {login.error ? (
          <p className="m-0 text-sm font-bold text-red-700">
            Invalid email or password.
          </p>
        ) : null}

        <button
          className="min-h-11 cursor-pointer rounded-md bg-accent font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
          disabled={login.isPending}
          type="submit"
        >
          {login.isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
