import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";

type NoticeTone = "success" | "error";

const TONE_STYLES: Record<NoticeTone, string> = {
  success: "border-emerald-700/25 bg-emerald-700/10 text-emerald-800 dark:text-emerald-300",
  error: "border-rose-700/25 bg-rose-700/10 text-rose-800 dark:text-rose-300",
};

export function Notice({ tone, children }: { tone: NoticeTone; children: ReactNode }) {
  return (
    <p
      className={`animate-slide-down m-0 flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm ${TONE_STYLES[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0"
        name={tone === "success" ? "checkCircle" : "alertCircle"}
      />
      <span>{children}</span>
    </p>
  );
}
