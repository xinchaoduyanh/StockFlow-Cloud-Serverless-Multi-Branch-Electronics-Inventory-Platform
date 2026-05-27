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
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
        <div className="text-sm font-semibold text-[#5c667a]">Loading Notifications Center...</div>
      </div>
    );
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
    <main className="min-h-screen bg-[#f4f7fb] pb-12">
      {/* Navbar Header */}
      <header className="sticky top-0 z-30 border-b border-[#d7dce5] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex w-[calc(100%_-_48px)] max-w-[1240px] items-center justify-between gap-4 py-3 max-md:w-[calc(100%_-_32px)] max-md:flex-col max-md:items-start">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="grid h-10 w-10 place-items-center rounded-xl bg-[#0f766e] text-sm font-black text-white shadow-lg shadow-teal-800/15 hover:bg-[#0d645e] transition-colors"
            >
              SF
            </Link>
            <div>
              <p className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">
                StockFlow Cloud
              </p>
              <h1 className="m-0 text-xl font-black tracking-normal text-[#172033]">
                Notifications History Center
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="button-secondary px-4 py-2 text-xs font-bold rounded-lg border border-[#d7dce5] hover:bg-slate-50"
            >
              ← Return to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Body Grid */}
      <div className="mx-auto mt-6 w-[calc(100%_-_48px)] max-w-[1240px] max-md:w-[calc(100%_-_32px)]">
        <div className="grid gap-6">
          {/* Action Header Card */}
          <div className="surface flex items-center justify-between gap-4 p-5 max-sm:flex-col max-sm:items-start bg-white rounded-2xl border border-[#d7dce5] shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  filter === "all"
                    ? "bg-[#0f766e] text-white shadow-md shadow-teal-800/10"
                    : "bg-slate-100 text-[#5c667a] hover:bg-slate-200"
                }`}
                type="button"
              >
                All Notifications ({notifications.length})
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  filter === "unread"
                    ? "bg-[#0f766e] text-white shadow-md shadow-teal-800/10"
                    : "bg-slate-100 text-[#5c667a] hover:bg-slate-200"
                }`}
                type="button"
              >
                Unread Alerts ({unreadCount})
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="button-secondary text-xs font-bold border border-[#d7dce5] hover:bg-slate-50"
                type="button"
              >
                Mark All as Read
              </button>
            )}
          </div>

          {/* List Container */}
          <div className="grid gap-3">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-[#d7dce5] shadow-sm">
                <svg
                  className="h-12 w-12 text-[#cbd5e1]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-2.25-1.5a2 2 0 00-2.22 0l-2.25 1.5"
                  />
                </svg>
                <h3 className="mt-4 text-sm font-bold text-[#172033]">
                  Your notification log is clear
                </h3>
                <p className="mt-1 text-xs text-[#64748b]">
                  No alerts matching the selected filter were found.
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const isSuccess = item.type === NotificationType.IMPORT_SUCCESS;
                const isExpanded = expandedId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl border transition-all duration-200 shadow-sm ${
                      !item.read
                        ? "border-teal-300 ring-1 ring-teal-50 bg-teal-50/5"
                        : "border-[#d7dce5]"
                    }`}
                  >
                    {/* Summary Header Row */}
                    <div
                      onClick={() => toggleExpand(item.id, item.read)}
                      className="flex items-center justify-between gap-4 p-5 cursor-pointer hover:bg-slate-50/50"
                    >
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        {/* Status Icon */}
                        <div
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                            isSuccess
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-rose-50 text-rose-600"
                          }`}
                        >
                          {isSuccess ? (
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                          )}
                        </div>

                        {/* Title & Message Summary */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-[#172033]">{item.title}</span>
                            {!item.read && (
                              <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[9px] font-black uppercase text-white tracking-wider">
                                New
                              </span>
                            )}
                          </div>
                          <p className="m-0 mt-1 text-xs text-[#5c667a] line-clamp-1">
                            {item.message}
                          </p>
                        </div>
                      </div>

                      {/* Right Arrow and Date */}
                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <span className="text-xs font-semibold text-[#94a3b8]">
                          {new Date(item.createdAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <svg
                          className={`h-5 w-5 text-[#94a3b8] transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Expandable Diagnostic Panel */}
                    {isExpanded && (
                      <div className="border-t border-[#f1f5f9] bg-[#fafbfc]/70 p-5 rounded-b-2xl">
                        <p className="m-0 text-xs font-bold text-[#475569] uppercase tracking-wider">
                          Diagnostic Metadata Log
                        </p>
                        <p className="m-0 mt-2 text-xs font-medium text-[#1e293b] leading-relaxed">
                          {item.message}
                        </p>

                        {/* Structured details display depending on Success vs Failure */}
                        {(() => {
                          if (isSuccess) {
                            const successMeta = item.metadata as ImportSuccessMetadata;
                            return (
                              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 border border-[#e2e8f0] bg-white p-4 rounded-xl shadow-sm">
                                <div className="rounded-lg bg-slate-50 p-3">
                                  <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wide">
                                    File Name
                                  </span>
                                  <p className="m-0 mt-1 text-xs font-black text-[#1e293b] truncate">
                                    {successMeta.fileName}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-slate-50 p-3">
                                  <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wide">
                                    Branch Code
                                  </span>
                                  <p className="m-0 mt-1 text-xs font-black text-[#1e293b]">
                                    {successMeta.branchCode}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-[#f0fdf4] p-3">
                                  <span className="text-[10px] font-bold text-[#15803d] uppercase tracking-wide">
                                    Valid Rows
                                  </span>
                                  <p className="m-0 mt-1 text-xs font-black text-[#166534]">
                                    {successMeta.validRows} / {successMeta.totalRows}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-[#fef2f2] p-3">
                                  <span className="text-[10px] font-bold text-[#b91c1c] uppercase tracking-wide">
                                    Invalid Rows
                                  </span>
                                  <p className="m-0 mt-1 text-xs font-black text-[#991b1b]">
                                    {successMeta.invalidRows} / {successMeta.totalRows}
                                  </p>
                                </div>
                              </div>
                            );
                          } else {
                            const failureMeta = item.metadata as ImportFailureMetadata;
                            return (
                              <div className="mt-4 border border-rose-200 bg-rose-50/20 p-4 rounded-xl shadow-sm">
                                <div className="flex items-center gap-2 mb-2 text-rose-800 font-bold text-xs uppercase tracking-wide">
                                  <svg
                                    className="h-4 w-4 shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  Failure Diagnostics Log
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-3">
                                  <div className="rounded-lg bg-white/60 p-2.5 border border-rose-100">
                                    <span className="text-[9px] font-bold text-[#64748b] uppercase">
                                      File Name
                                    </span>
                                    <p className="m-0 mt-0.5 text-xs font-black text-[#1e293b] truncate">
                                      {failureMeta.fileName}
                                    </p>
                                  </div>
                                  <div className="rounded-lg bg-white/60 p-2.5 border border-rose-100">
                                    <span className="text-[9px] font-bold text-[#64748b] uppercase">
                                      Branch Code
                                    </span>
                                    <p className="m-0 mt-0.5 text-xs font-black text-[#1e293b]">
                                      {failureMeta.branchCode}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide">
                                  Detailed Error Message
                                </span>
                                <pre className="mt-1.5 p-3 rounded-lg bg-slate-950 text-emerald-400 font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all">
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
