"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/Icon";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { InventoryItem } from "./types";
import { useInventory } from "./use-inventory";

const SEARCH_DEBOUNCE_MS = 250;
const RESULT_LIMIT = 8;

type StockPickerProps = {
  /** Branch whose stock is searched; the picker stays disabled until one is chosen. */
  branchId: string;
  value: InventoryItem | null;
  onChange: (item: InventoryItem | null) => void;
};

function availableUnits(item: InventoryItem) {
  return item.quantity - item.reservedQuantity;
}

/** Search-as-you-type picker over one branch's stock, so it works for any number of SKUs. */
export function StockPicker({ branchId, value, onChange }: StockPickerProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);

  const results = useInventory({
    branchId,
    search,
    limit: RESULT_LIMIT,
    enabled: Boolean(branchId) && !value,
  });
  const items = results.data?.items ?? [];

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-input-border)] bg-[var(--color-input-bg)] p-3">
        <div className="min-w-0">
          <p className="code m-0 truncate">{value.component.sku}</p>
          <p className="m-0 truncate text-xs text-[var(--color-text-secondary)]">
            {value.component.name} · {availableUnits(value)} khả dụng
          </p>
        </div>
        <button
          className="button-small-secondary shrink-0"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
          type="button"
        >
          Đổi
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-3.5 text-[var(--color-text-muted)]">
          <Icon className="h-[18px] w-[18px]" name="search" />
        </span>
        <input
          aria-controls={listId}
          aria-expanded={Boolean(branchId)}
          className="input pl-10"
          disabled={!branchId}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={branchId ? "Gõ SKU hoặc tên linh kiện" : "Chọn chi nhánh gửi trước"}
          role="combobox"
          value={query}
        />
      </div>

      {branchId ? (
        <ul
          className="m-0 grid max-h-56 list-none gap-0.5 overflow-y-auto rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-1"
          id={listId}
          role="listbox"
        >
          {results.isLoading ? (
            <li className="px-3 py-2 text-xs text-[var(--color-text-muted)]">Đang tìm…</li>
          ) : null}
          {!results.isLoading && items.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
              Không có linh kiện nào khớp trong chi nhánh này.
            </li>
          ) : null}
          {items.map((item) => (
            <li key={item.componentId}>
              <button
                aria-selected={false}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2 text-left transition-colors duration-150 hover:bg-[var(--color-bg-muted)]"
                onClick={() => onChange(item)}
                role="option"
                type="button"
              >
                <span className="min-w-0">
                  <span className="code block truncate">{item.component.sku}</span>
                  <span className="block truncate text-xs text-[var(--color-text-secondary)]">
                    {item.component.name}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs text-[var(--color-text-muted)]">
                  {availableUnits(item)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
