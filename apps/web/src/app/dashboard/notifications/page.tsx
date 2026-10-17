"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api-client";
import { useCurrentUser } from "@/features/auth/use-auth";
import {
  NotificationBase,
  NotificationType,
  ImportSuccessMetadata,
  ImportFailureMetadata,
} from "@stockflow/shared";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandMark } from "@/components/BrandLogo";
import { Icon } from "@/components/Icon";

export default function NotificationsPage() {
  const [hasMounted, setHasMounted] = useState(false);
  const { data: user, isLoading: isUserLoading, error: userError } = useCurrentUser();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // 1. Fetch historical notifications
  const { data: notifications = [], isLoading: isNotiLoading } = useQuery<NotificationBase[]>({
    queryKey: ["notifications"],
    queryFn: () => apiRequest<NotificationBase[]>("/notifications"),
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (hasMounted && !isUserLoading && (userError || !user)) {
      router.replace("/login");
    }
  }, [hasMounted, isUserLoading, userError, user, router]);

  // 2. Mark specific read mutation
  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // 3. Mark all read mutation
  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("/notifications/read-all", { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  if (!hasMounted || isUserLoading || isNotiLoading) {
    return <NotificationsSkeleton />;
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    return true;
  });

  const toggleExpand = (id: string, read: boolean) => {
    if (!read) {
      markReadMutation.mutate(id);
    }
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] pb-16" id="main">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-4 px-6 py-3.5 md:px-8">
          <div className="flex min-w-0 items-center gap-3.5">
            <Link
              aria-label="Về trang quản trị"
              className="shrink-0 transition-transform duration-150 active:translate-y-px"
              href="/dashboard"
            >
              <BrandMark className="h-10 w-10" />
            </Link>
            <div className="min-w-0">
              <h1 className="m-0 truncate font-display text-lg font-semibold leading-tight tracking-tight">
                Lịch sử thông báo
              </h1>
              <p className="m-0 truncate text-xs text-[var(--color-text-muted)]">
                Kết quả nhập kho và cảnh báo đối soát của bạn
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link className="button-secondary" href="/dashboard">
              <Icon className="h-4 w-4" name="chevronLeft" />
              <span className="max-sm:hidden">Về bảng điều khiển</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-8 w-full max-w-[1240px] px-6 md:px-8 animate-rise-in">
        <div className="grid gap-5">
          <div className="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
            <div className="flex flex-wrap items-center gap-1" role="tablist">
              <button
                aria-selected={filter === "all"}
                className={filter === "all" ? "tab-active" : "tab"}
                onClick={() => setFilter("all")}
                role="tab"
                type="button"
              >
                Tất cả <span className="font-mono text-xs">{notifications.length}</span>
              </button>
              <button
                aria-selected={filter === "unread"}
                className={filter === "unread" ? "tab-active" : "tab"}
                onClick={() => setFilter("unread")}
                role="tab"
                type="button"
              >
                Chưa đọc <span className="font-mono text-xs">{unreadCount}</span>
              </button>
            </div>

            {unreadCount > 0 ? (
              <button
                className="button-secondary"
                disabled={markAllReadMutation.isPending}
                onClick={() => markAllReadMutation.mutate()}
                type="button"
              >
                <Icon className="h-4 w-4" name="check" />
                Đánh dấu tất cả đã đọc
              </button>
            ) : null}
          </div>

          {/* List Container */}
          <div className="grid gap-3">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--color-card-border)] bg-[var(--color-bg-surface)] py-20 text-center [box-shadow:var(--color-card-shadow)]">
                <div className="grid h-12 w-12 place-items-center rounded-lg border border-slate-100/70 bg-slate-50 text-slate-400">
                  <Icon name="inbox" className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-sm font-medium text-slate-800">
                  Hộp thư thông báo của bạn trống
                </h3>
                <p className="mt-1 text-xs font-normal text-slate-400">
                  Không tìm thấy thông báo nào phù hợp với bộ lọc đã chọn.
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const isSuccess = item.type === NotificationType.IMPORT_SUCCESS;
                const isExpanded = expandedId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border transition-all duration-250 ${
                      !item.read
                        ? "border-slate-300 bg-slate-50"
                        : "border-[var(--color-card-border)] bg-[var(--color-bg-surface)]"
                    }`}
                  >
                    {/* Summary Header Row */}
                    <div
                      aria-expanded={isExpanded}
                      className="flex cursor-pointer items-center justify-between gap-4 rounded-t-lg p-5 transition-colors duration-150 hover:bg-[var(--color-bg-muted)]/50"
                      onClick={() => toggleExpand(item.id, item.read)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleExpand(item.id, item.read);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        {/* Status Icon - low-opacity pastel styling */}
                        <div
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                            isSuccess
                              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                              : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400"
                          }`}
                        >
                          {isSuccess ? (
                            <Icon name="checkCircle" className="h-5 w-5" />
                          ) : (
                            <Icon name="alert" className="h-5 w-5" />
                          )}
                        </div>

                        {/* Title & Message Summary */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">{item.title}</span>
                            {!item.read && <span className="badge badge-accent">Mới</span>}
                          </div>
                          <p className="m-0 mt-1 line-clamp-1 text-xs font-normal leading-relaxed text-slate-500">
                            {item.message}
                          </p>
                        </div>
                      </div>

                      {/* Right Arrow and Date */}
                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <span className="font-sans text-xs font-normal text-slate-400">
                          {new Date(item.createdAt).toLocaleString("vi-VN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <Icon name="chevronDown" />
                      </div>
                    </div>

                    {/* Expandable Diagnostic Panel */}
                    {isExpanded && (
                      <div className="rounded-b-xl border-t border-slate-200/60 bg-slate-50 p-6 animate-fade-in">
                        <p className="m-0 text-xs font-medium r text-slate-500">
                          Chi tiết thông báo
                        </p>
                        <p className="m-0 mt-2 text-xs font-normal leading-relaxed text-slate-700">
                          {item.message}
                        </p>

                        {/* Structured details display depending on Success vs Failure */}
                        {(() => {
                          if (isSuccess) {
                            const successMeta = item.metadata as ImportSuccessMetadata;
                            return (
                              <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg border border-slate-200/60 bg-[var(--color-bg-surface)] p-4 md:grid-cols-4 animate-slide-down">
                                <div className="rounded-md bg-slate-50 p-3.5">
                                  <span className="text-xs font-medium text-slate-500">
                                    Tên File
                                  </span>
                                  <p className="m-0 mt-1 truncate text-xs font-medium text-slate-800">
                                    {successMeta.fileName}
                                  </p>
                                </div>
                                <div className="rounded-md bg-slate-50 p-3.5">
                                  <span className="text-xs font-medium text-slate-500">
                                    Mã chi nhánh
                                  </span>
                                  <p className="m-0 mt-1 text-xs font-medium text-slate-800">
                                    {successMeta.branchCode}
                                  </p>
                                </div>
                                <div className="rounded-md border border-emerald-100/70 dark:border-emerald-950/30 bg-emerald-50 dark:bg-emerald-950/20 p-3.5">
                                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                    Dòng hợp lệ
                                  </span>
                                  <p className="m-0 mt-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                                    {successMeta.validRows} / {successMeta.totalRows}
                                  </p>
                                </div>
                                <div className="rounded-md border border-rose-100/70 dark:border-rose-950/30 bg-rose-50 dark:bg-rose-950/20 p-3.5">
                                  <span className="text-xs font-medium text-rose-700 dark:text-rose-400">
                                    Dòng không hợp lệ
                                  </span>
                                  <p className="m-0 mt-1 text-xs font-medium text-rose-800 dark:text-rose-300">
                                    {successMeta.invalidRows} / {successMeta.totalRows}
                                  </p>
                                </div>
                              </div>
                            );
                          } else {
                            const failureMeta = item.metadata as ImportFailureMetadata;
                            return (
                              <div className="mt-4 rounded-lg border border-rose-200/70 dark:border-rose-950/30 bg-rose-50 dark:bg-rose-950/25 p-5 animate-slide-down">
                                <div className="mb-3.5 flex items-center gap-2 text-xs font-medium r text-rose-800 dark:text-rose-400">
                                  <Icon name="alertCircle" className="h-4.5 w-4.5 shrink-0" />
                                  Nhật ký chẩn đoán lỗi
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                  <div className="rounded-md border border-rose-100/70 dark:border-rose-950/30 bg-[var(--color-bg-surface)] p-3">
                                    <span className="text-xs font-medium text-slate-500">
                                      Tên File
                                    </span>
                                    <p className="m-0 mt-0.5 truncate text-xs font-medium text-slate-800">
                                      {failureMeta.fileName}
                                    </p>
                                  </div>
                                  <div className="rounded-md border border-rose-100/70 dark:border-rose-950/30 bg-[var(--color-bg-surface)] p-3">
                                    <span className="text-xs font-medium text-slate-500">
                                      Mã chi nhánh
                                    </span>
                                    <p className="m-0 mt-0.5 text-xs font-medium text-slate-800">
                                      {failureMeta.branchCode}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-xs font-medium text-slate-500">
                                  Chi tiết thông báo lỗi
                                </span>
                                <pre className="mt-2 whitespace-pre-wrap rounded-md border border-[#3a3023] bg-[#15110c] p-4 font-mono text-xs leading-relaxed text-[#f1e9d9] selection:bg-[#4b4131]">
                                  {failureMeta.errorMessage}
                                </pre>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function NotificationsSkeleton() {
  return (
    <main className="app-background pb-16 min-h-screen">
      <header className="content-layer sticky top-0 z-30 border-b border-slate-200/60 bg-[var(--color-bg-base)]/95 backdrop-blur-sm">
        <div className="mx-auto flex w-[calc(100%_-_48px)] max-w-[1240px] items-center justify-between gap-4 py-4 max-md:w-[calc(100%_-_32px)]">
          <div className="flex items-center gap-3.5">
            <div className="skeleton-shimmer h-11 w-11 rounded-lg" />
            <div className="grid gap-2">
              <div className="skeleton-shimmer h-3 w-28" />
              <div className="skeleton-shimmer h-5 w-56" />
            </div>
          </div>
          <div className="skeleton-shimmer h-10 w-36 rounded-lg" />
        </div>
      </header>
      <div className="content-layer mx-auto mt-6 grid w-[calc(100%_-_48px)] max-w-[1240px] gap-4 max-md:w-[calc(100%_-_32px)] animate-rise-in">
        <div className="surface flex items-center justify-between gap-4 p-5">
          <div className="flex gap-2">
            <div className="skeleton-shimmer h-9 w-36 rounded-lg" />
            <div className="skeleton-shimmer h-9 w-32 rounded-lg" />
          </div>
          <div className="skeleton-shimmer h-9 w-36 rounded-lg" />
        </div>
        {[0, 1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="rounded-lg border border-[var(--color-card-border)] bg-[var(--color-bg-surface)] p-5 [box-shadow:var(--color-card-shadow)]"
          >
            <div className="flex items-center gap-4">
              <div className="skeleton-shimmer h-10 w-10 rounded-lg" />
              <div className="grid flex-1 gap-2">
                <div className="skeleton-shimmer h-4 w-52" />
                <div className="skeleton-shimmer h-3 w-full" />
              </div>
              <div className="skeleton-shimmer h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
