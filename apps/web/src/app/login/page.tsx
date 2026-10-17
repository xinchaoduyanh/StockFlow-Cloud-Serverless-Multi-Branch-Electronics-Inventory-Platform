"use client";

import Link from "next/link";
import type { CognitoUser } from "amazon-cognito-identity-js";
import { FormEvent, useEffect, useState } from "react";
import { useLogin } from "@/features/auth/use-auth";
import { AuthShell } from "@/components/AuthShell";
import { FieldInput, PasswordInput } from "@/components/FieldInput";
import { Icon } from "@/components/Icon";

const MIN_PASSWORD_LENGTH = 8;

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Set when Cognito asks a first-time user to choose a new password.
  const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [isSubmittingNewPassword, setIsSubmittingNewPassword] = useState(false);

  const login = useLogin();

  // Warm up the Cognito bundle and the serverless DB while the user is typing.
  useEffect(() => {
    void import("@/lib/cognito").catch(() => {});

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
    void fetch(`${apiBaseUrl}/health`).catch(() => {});
  }, []);

  async function submitNewPassword(user: CognitoUser) {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setCustomError(`Mật khẩu mới phải dài ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setCustomError("Mật khẩu xác nhận không trùng khớp.");
      return;
    }

    setIsSubmittingNewPassword(true);
    try {
      const { completeNewPassword } = await import("@/lib/cognito");
      await completeNewPassword(user, newPassword);
      window.location.href = "/dashboard";
    } catch (error) {
      setCustomError(toMessage(error, "Không thể thiết lập mật khẩu mới."));
    } finally {
      setIsSubmittingNewPassword(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCustomError(null);

    if (cognitoUser) {
      void submitNewPassword(cognitoUser);
      return;
    }

    login.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          if (data.newPasswordRequired && data.cognitoUser) {
            setCognitoUser(data.cognitoUser);
          }
        },
      },
    );
  }

  function backToLogin() {
    setCognitoUser(null);
    setNewPassword("");
    setConfirmPassword("");
    setCustomError(null);
  }

  const isPending = login.isPending || isSubmittingNewPassword;
  const errorMessage =
    customError ?? (login.error ? toMessage(login.error, "Đăng nhập thất bại.") : null);
  const isFirstLogin = cognitoUser !== null;

  return (
    <AuthShell
      footer="DuyAnhShop · StockFlow Cloud"
      subtitle={
        isFirstLogin
          ? "Đây là lần đăng nhập đầu tiên của tài khoản. Hãy đặt mật khẩu mới trước khi vào hệ thống."
          : "Đăng nhập để xem tồn kho và duyệt chuyển kho của chi nhánh bạn phụ trách."
      }
      title={isFirstLogin ? "Đặt mật khẩu mới" : "Đăng nhập"}
    >
      <form className="grid gap-5" onSubmit={handleSubmit}>
        {isFirstLogin ? (
          <p className="m-0 flex items-center gap-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-3.5 py-2.5 text-sm text-[var(--color-text-secondary)]">
            <Icon name="mail" className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{email}</span>
          </p>
        ) : null}

        {isFirstLogin ? (
          <>
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
        ) : (
          <>
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
            <label className="field">
              <span>Mật khẩu</span>
              <PasswordInput
                autoComplete="current-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                value={password}
              />
            </label>
          </>
        )}

        {errorMessage ? (
          <p className="error-text animate-slide-down" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="grid gap-3">
          <button className="button-primary w-full" disabled={isPending} type="submit">
            {isPending ? "Đang xử lý…" : isFirstLogin ? "Lưu mật khẩu và đăng nhập" : "Đăng nhập"}
          </button>

          {isFirstLogin ? (
            <button
              className="button-secondary w-full"
              disabled={isPending}
              onClick={backToLogin}
              type="button"
            >
              Quay lại đăng nhập
            </button>
          ) : (
            <Link
              className="mx-auto text-sm font-medium text-[var(--color-text-secondary)] underline decoration-[var(--color-border-subtle)] underline-offset-4 transition-colors hover:text-[var(--color-accent-solid)] hover:decoration-current"
              href="/forgot-password"
            >
              Quên mật khẩu?
            </Link>
          )}
        </div>
      </form>
    </AuthShell>
  );
}
