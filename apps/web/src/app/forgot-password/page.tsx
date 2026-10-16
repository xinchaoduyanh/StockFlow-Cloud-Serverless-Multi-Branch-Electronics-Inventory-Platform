"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

type Step = "request" | "confirm" | "done";

const MIN_PASSWORD_LENGTH = 8;

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Đã xảy ra lỗi, vui lòng thử lại.";
}

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (step === "confirm") {
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        setError(`Mật khẩu mới phải dài ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Mật khẩu xác nhận không trùng khớp.");
        return;
      }
    }

    setIsPending(true);
    try {
      const cognito = await import("@/lib/cognito");
      if (step === "request") {
        await cognito.requestPasswordReset(email);
        setStep("confirm");
      } else {
        await cognito.confirmPasswordReset(email, code, newPassword);
        setStep("done");
      }
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <main className="app-background grid place-items-center px-6 py-12 min-h-screen">
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <form
        className="content-layer grid w-full max-w-[440px] gap-7 p-9 surface animate-rise-in"
        onSubmit={handleSubmit}
      >
        <div className="text-center">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            StockFlow Cloud
          </p>
          <h1 className="m-0 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Đặt lại mật khẩu
          </h1>
          <p className="mt-2 text-xs font-normal text-slate-500 dark:text-slate-400">
            {step === "request" && "Nhập email tài khoản, chúng tôi sẽ gửi mã xác nhận."}
            {step === "confirm" && `Mã xác nhận đã được gửi tới ${email}.`}
            {step === "done" && "Mật khẩu đã được đặt lại. Bạn có thể đăng nhập bằng mật khẩu mới."}
          </p>
        </div>

        {step === "request" && (
          <label className="field">
            <span>Địa chỉ Email</span>
            <input
              className="input"
              autoComplete="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ten@congty.com"
              required
              type="email"
              value={email}
            />
          </label>
        )}

        {step === "confirm" && (
          <div className="grid gap-5">
            <label className="field">
              <span>Mã xác nhận</span>
              <input
                className="input"
                autoComplete="one-time-code"
                inputMode="numeric"
                name="code"
                onChange={(event) => setCode(event.target.value)}
                required
                value={code}
              />
            </label>
            <label className="field">
              <span>Mật khẩu mới</span>
              <input
                className="input"
                autoComplete="new-password"
                name="newPassword"
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
                value={newPassword}
              />
            </label>
            <label className="field">
              <span>Xác nhận mật khẩu mới</span>
              <input
                className="input"
                autoComplete="new-password"
                name="confirmPassword"
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </label>
          </div>
        )}

        {error ? (
          <p className="m-0 rounded-lg border border-red-200/70 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-center text-xs font-medium text-red-700 dark:text-red-400 animate-slide-down">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3">
          {step !== "done" && (
            <button className="button-primary w-full" disabled={isPending} type="submit">
              {isPending
                ? "Đang xử lý..."
                : step === "request"
                  ? "Gửi mã xác nhận"
                  : "Đặt lại mật khẩu"}
            </button>
          )}
          <Link className="button-secondary w-full text-center" href="/login">
            {step === "done" ? "Đăng nhập" : "Quay lại đăng nhập"}
          </Link>
        </div>
      </form>
    </main>
  );
}
