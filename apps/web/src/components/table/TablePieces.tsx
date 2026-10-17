import { Icon } from "@/components/Icon";

const SKELETON_ROWS = 6;

export function TableHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-table-border)] px-5 py-4">
      <h2 className="m-0 font-display text-base font-semibold tracking-tight">{title}</h2>
      <span className="font-mono text-xs text-[var(--color-text-muted)]">{count} mục</span>
    </div>
  );
}

type TableStateProps = {
  colSpan: number;
  text: string;
};

/** Loading rows when `text` starts with "Đang", otherwise a composed empty state. */
export function TableState({ colSpan, text }: TableStateProps) {
  if (text.startsWith("Đang")) {
    return (
      <>
        {Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
          <tr key={rowIndex}>
            {Array.from({ length: colSpan }, (_, colIndex) => (
              <td key={colIndex}>
                <div
                  className={`skeleton-shimmer h-4 ${colIndex === 0 ? "w-36" : colIndex === colSpan - 1 ? "w-16" : "w-24"}`}
                />
              </td>
            ))}
          </tr>
        ))}
      </>
    );
  }

  return (
    <tr>
      <td className="py-14" colSpan={colSpan}>
        <div className="mx-auto grid max-w-sm justify-items-center gap-3 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-[var(--color-bg-muted)] text-[var(--color-text-muted)]">
            <Icon className="h-5 w-5" name="inbox" />
          </span>
          <p className="m-0 text-sm text-[var(--color-text-secondary)]">{text}</p>
        </div>
      </td>
    </tr>
  );
}
