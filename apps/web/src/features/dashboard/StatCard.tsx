import { Icon, IconName } from "@/components/Icon";

type StatTone = "neutral" | "accent" | "danger";

type StatCardProps = {
  label: string;
  value: string;
  caption: string;
  icon: IconName;
  tone?: StatTone;
};

const TONE_STYLES: Record<StatTone, { band: string; icon: string; value: string }> = {
  neutral: {
    band: "bg-[var(--color-text-muted)]",
    icon: "bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]",
    value: "text-[var(--color-text-primary)]",
  },
  accent: {
    band: "bg-[var(--color-accent-solid)]",
    icon: "bg-indigo-600/10 text-[var(--color-accent-solid)]",
    value: "text-[var(--color-text-primary)]",
  },
  danger: {
    band: "bg-rose-700",
    icon: "bg-rose-700/10 text-rose-700 dark:text-rose-300",
    value: "text-rose-800 dark:text-rose-300",
  },
};

export function StatCard({ label, value, caption, icon, tone = "neutral" }: StatCardProps) {
  const styles = TONE_STYLES[tone];

  return (
    <article className="surface grid gap-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-2.5">
          <span aria-hidden="true" className={`h-1 w-7 rounded-full ${styles.band}`} />
          <h3 className="m-0 font-sans text-sm font-medium text-[var(--color-text-secondary)]">
            {label}
          </h3>
        </div>
        <span className={`grid h-9 w-9 place-items-center rounded-md ${styles.icon}`}>
          <Icon className="h-[18px] w-[18px]" name={icon} />
        </span>
      </div>
      <div className="grid gap-1.5">
        <p
          className={`m-0 font-display text-[2rem] font-semibold leading-none tabular-nums ${styles.value}`}
        >
          {value}
        </p>
        <p className="m-0 border-t border-dashed border-[var(--color-border-subtle)] pt-2 text-xs text-[var(--color-text-muted)]">
          {caption}
        </p>
      </div>
    </article>
  );
}
