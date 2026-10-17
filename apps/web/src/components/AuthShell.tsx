import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

// Resistor colour code (brown, black, red, orange, gold) used as a decorative rule.
const RESISTOR_BANDS = ["#7a4a2b", "#211b14", "#b3342a", "#d9822b", "#c9a227"];

function ShelfLabel() {
  return (
    <div className="surface relative max-w-sm rotate-[-1.5deg] p-5">
      <span
        aria-hidden="true"
        className="absolute -top-2.5 left-6 h-5 w-5 rounded-full border border-[var(--color-card-border)] bg-[var(--color-bg-muted)]"
      />
      <p className="m-0 text-xs text-[var(--color-text-muted)]">Nhãn kệ mẫu</p>
      <p className="code m-0 mt-1.5 text-sm">RAM-D5-32-KNG</p>
      <p className="m-0 mt-0.5 text-sm text-[var(--color-text-secondary)]">
        Kingston Fury Beast DDR5 32GB
      </p>
      <div className="mt-4 flex items-end justify-between gap-6 border-t border-dashed border-[var(--color-border-subtle)] pt-3">
        <div>
          <p className="m-0 text-xs text-[var(--color-text-muted)]">Tồn tại Cầu Giấy</p>
          <p className="m-0 font-display text-2xl font-semibold tabular-nums">38</p>
        </div>
        <span className="badge badge-ok">Đủ hàng</span>
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] p-12 lg:flex">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: "radial-gradient(var(--color-grid-dot) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="relative">
        <BrandLogo markClassName="h-11 w-11" caption="StockFlow Cloud" />
      </div>

      <div className="relative grid gap-10">
        <div className="grid gap-4">
          <h2 className="m-0 max-w-[14ch] font-display text-[3.4rem] font-semibold leading-[1.02] tracking-tight">
            Hàng nằm ở kệ nào, biết ngay.
          </h2>
          <p className="m-0 max-w-[44ch] text-base leading-relaxed text-[var(--color-text-secondary)]">
            Tồn kho linh kiện của từng chi nhánh, chuyển kho có duyệt, nhập hàng bằng Excel và đối
            soát số liệu trong cùng một nơi.
          </p>
        </div>
        <ShelfLabel />
      </div>

      <div className="relative flex items-center gap-3" aria-hidden="true">
        {RESISTOR_BANDS.map((color) => (
          <span key={color} className="h-8 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
        ))}
        <span className="ml-2 font-mono text-xs text-[var(--color-text-muted)]">1 kΩ ± 5%</span>
      </div>
    </aside>
  );
}

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="grid min-h-screen bg-[var(--color-bg-base)] lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <main className="relative flex flex-col px-6 py-8 sm:px-12" id="main">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="lg:hidden">
            <BrandLogo markClassName="h-9 w-9" />
          </div>
          <ThemeToggle />
        </div>

        <div className="mx-auto grid w-full max-w-[400px] flex-1 content-center gap-8 py-10 animate-rise-in">
          <header className="grid gap-2">
            <h1 className="m-0 font-display text-[2rem] font-semibold leading-tight tracking-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="m-0 max-w-[48ch] text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {subtitle}
              </p>
            ) : null}
          </header>
          {children}
        </div>

        {footer ? (
          <footer className="text-center text-xs text-[var(--color-text-muted)]">{footer}</footer>
        ) : null}
      </main>
    </div>
  );
}
