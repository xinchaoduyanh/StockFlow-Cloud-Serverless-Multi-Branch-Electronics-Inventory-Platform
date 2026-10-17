"use client";

import { InputHTMLAttributes, useState } from "react";
import { Icon, IconName } from "@/components/Icon";

type FieldInputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: IconName;
};

/** Text input with an optional leading icon, styled by the shared `.input` class. */
export function FieldInput({ icon, className = "", ...inputProps }: FieldInputProps) {
  return (
    <div className="relative flex items-center">
      {icon ? (
        <span className="pointer-events-none absolute left-3.5 text-[var(--color-text-muted)]">
          <Icon name={icon} className="h-[18px] w-[18px]" />
        </span>
      ) : null}
      <input className={`input ${icon ? "pl-10" : ""} ${className}`} {...inputProps} />
    </div>
  );
}

type PasswordInputProps = Omit<FieldInputProps, "type" | "icon">;

export function PasswordInput({ className = "", ...inputProps }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-3.5 text-[var(--color-text-muted)]">
        <Icon name="lock" className="h-[18px] w-[18px]" />
      </span>
      <input
        className={`input pl-10 pr-11 ${className}`}
        type={isVisible ? "text" : "password"}
        {...inputProps}
      />
      <button
        aria-label={isVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        aria-pressed={isVisible}
        className="icon-button absolute right-1"
        onClick={() => setIsVisible((current) => !current)}
        type="button"
      >
        <Icon name={isVisible ? "eyeOff" : "eye"} className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
