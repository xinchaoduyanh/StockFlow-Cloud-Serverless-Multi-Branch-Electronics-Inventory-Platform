"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";

type ModalProps = {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  /** Tailwind max-width class; dialogs for short forms use the default. */
  widthClassName?: string;
};

export function Modal({
  title,
  description,
  onClose,
  children,
  widthClassName = "max-w-md",
}: ModalProps) {
  // Portal to <body>: ancestors with transform animations would otherwise trap position: fixed.
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(document.body);
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  if (!container) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        aria-label="Đóng hộp thoại"
        className="animate-backdrop absolute inset-0 cursor-default bg-[var(--color-text-primary)]/40 backdrop-blur-[2px]"
        onClick={onClose}
        type="button"
      />
      <div
        aria-modal="true"
        className={`surface animate-modal-in relative max-h-[92vh] w-full overflow-y-auto p-6 ${widthClassName}`}
        role="dialog"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <h2 className="m-0 font-display text-lg font-semibold tracking-tight">{title}</h2>
            {description ? (
              <p className="m-0 text-sm text-[var(--color-text-secondary)]">{description}</p>
            ) : null}
          </div>
          <button
            aria-label="Đóng"
            className="icon-button -mr-2 -mt-1"
            onClick={onClose}
            type="button"
          >
            <Icon className="h-5 w-5" name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    container,
  );
}
