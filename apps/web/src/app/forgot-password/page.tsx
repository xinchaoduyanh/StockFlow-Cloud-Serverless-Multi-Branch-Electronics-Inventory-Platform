"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { FieldInput, PasswordInput } from "@/components/FieldInput";
import { Icon } from "@/components/Icon";

type Step = "request" | "confirm" | "done";

const MIN_PASSWORD_LENGTH = 8;

const STEP_COPY: Record<Step, { title: string; subtitle: (email: string) => string }> = {
  request: {
    title: "Quên mật khẩu",
    subtitle: () =>
      "Nhập email tài khoản. Chúng tôi sẽ gửi một mã xác nhận để bạn đặt lại mật khẩu.",
  },
  confirm: {
    title: "Nhập mã xác nhận",
    subtitle: (email) => `Mã gồm các chữ số đã được gửi tới ${email}.`,
  },
  done: {
    title: "Đã đặt lại mật khẩu",
    subtitle: () => "Bạn có thể đăng nhập bằng mật khẩu mới.",
  },
};

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

  const copy = STEP_COPY[step];

  return (
    <AuthShell
      footer="DuyAnhShop · StockFlow Cloud"
      subtitle={copy.subtitle(email)}
      title={copy.title}
    >
      <form className="grid gap-5" onSubmit={handleSubmit}>
        {step === "request" ? (
          <label className="field">
            <span>Email</span>
            <FieldInput
              autoComplete="email"
              icon="mail"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ten@duyanhshop.vn"
              required
              type="email"
              value={email}
            />
          </label>
        ) : null}

        {step === "confirm" ? (
          <>
            <label className="field">
              <span>Mã xác nhận</span>
              <FieldInput
                autoComplete="one-time-code"
                className="font-mono tracking-[0.3em]"
                inputMode="numeric"
                name="code"
                onChange={(event) => setCode(event.target.value)}
                placeholder="000000"
                required
                value={code}
              />
            </label>
            <label className="field">
              <span>Mật khẩu mới</span>
              <PasswordInput
                autoComplete="new-password"
                name="newPassword"
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder={`Tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`}
                required
                value={newPassword}
              />
            </label>
            <label className="field">
              <span>Nhập lại mật khẩu mới</span>
              <PasswordInput
                autoComplete="new-password"
                name="confirmPassword"
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                value={confirmPassword}
              />
            </label>
          </>
        ) : null}

        {step === "done" ? (
          <p className="m-0 flex items-center gap-2.5 rounded-md border border-emerald-700/25 bg-emerald-700/10 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            <Icon name="checkCircle" className="h-5 w-5 shrink-0" />
            Mật khẩu của bạn đã được cập nhật.
          </p>
        ) : null}

        {error ? (
          <p className="error-text animate-slide-down" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3">
          {step !== "done" ? (
            <button className="button-primary w-full" disabled={isPending} type="submit">
              {isPending
                ? "Đang xử lý…"
                : step === "request"
                  ? "Gửi mã xác nhận"
                  : "Đặt lại mật khẩu"}
            </button>
          ) : null}
          <Link
            className={`${step === "done" ? "button-primary" : "button-secondary"} w-full`}
            href="/login"
          >
            {step === "done" ? "Đăng nhập" : "Quay lại đăng nhập"}
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
