import { Icon } from "@/components/Icon";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

/** First page, last page and the neighbours of the current page; gaps become `null`. */
function visiblePages(currentPage: number, totalPages: number): Array<number | null> {
  const wanted = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const pages = [...wanted].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);

  return pages.flatMap((page, index) =>
    index > 0 && page - pages[index - 1] > 1 ? [null, page] : [page],
  );
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between gap-4 border-t border-[var(--color-table-border)] px-5 py-3 max-sm:flex-col">
      <p className="m-0 text-xs text-[var(--color-text-muted)]">
        Hiển thị <span className="code text-xs">{firstItem}</span> đến{" "}
        <span className="code text-xs">{lastItem}</span> trên{" "}
        <span className="code text-xs">{totalItems}</span> kết quả
      </p>

      <nav aria-label="Phân trang" className="flex items-center gap-1">
        <button
          aria-label="Trang trước"
          className="icon-button h-8 w-8 disabled:pointer-events-none disabled:opacity-40"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
        >
          <Icon className="h-4 w-4" name="chevronLeft" />
        </button>

        {visiblePages(currentPage, totalPages).map((page, index) =>
          page === null ? (
            <span
              aria-hidden="true"
              className="w-6 text-center text-xs text-[var(--color-text-muted)]"
              key={`gap-${index}`}
            >
              …
            </span>
          ) : (
            <button
              aria-current={page === currentPage ? "page" : undefined}
              className={`h-8 min-w-8 cursor-pointer rounded-md px-2 font-mono text-xs transition-colors duration-150 ${
                page === currentPage
                  ? "bg-[var(--color-accent-solid)] font-semibold text-[var(--color-accent-contrast)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]"
              }`}
              key={page}
              onClick={() => onPageChange(page)}
              type="button"
            >
              {page}
            </button>
          ),
        )}

        <button
          aria-label="Trang sau"
          className="icon-button h-8 w-8 disabled:pointer-events-none disabled:opacity-40"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
        >
          <Icon className="h-4 w-4" name="chevronRight" />
        </button>
      </nav>
    </div>
  );
}
