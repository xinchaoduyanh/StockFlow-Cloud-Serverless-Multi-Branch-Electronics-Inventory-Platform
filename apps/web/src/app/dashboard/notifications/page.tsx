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
      <div className="app-background flex items-center justify-center">
        <div className="text-sm font-bold text-slate-500 animate-pulse">
          Loading Notifications Center...
        </div>
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
    <main className="app-background pb-16">
      <div className="ambient-orb -top-36 -left-28 h-[520px] w-[520px] bg-teal-300/16" />
      <div className="ambient-orb right-[-120px] top-28 h-[460px] w-[460px] bg-sky-300/14 [animation-delay:1.4s]" />
      {/* Navbar Header */}
      <header className="content-layer sticky top-0 z-30 border-b border-white/70 bg-white/72 shadow-sm shadow-slate-200/40 backdrop-blur-2xl">
        <div className="mx-auto flex w-[calc(100%_-_48px)] max-w-[1240px] items-center justify-between gap-4 py-3.5 max-md:w-[calc(100%_-_32px)] max-md:flex-col max-md:items-start">
          <div className="flex items-center gap-3.5">
            <Link
              href="/dashboard"
              className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-500 text-sm font-black text-white shadow-lg shadow-teal-700/20 transition-all duration-500 hover:rotate-3 hover:scale-105"
            >
              SF
            </Link>
            <div>
              <p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-teal-700">
                StockFlow Cloud
              </p>
              <h1 className="m-0 text-lg font-black tracking-tight text-slate-900">
                Notifications History Center
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="button-secondary min-h-10 px-4 text-xs font-bold">
              ← Return to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Body Grid */}
      <div className="content-layer mx-auto mt-6 w-[calc(100%_-_48px)] max-w-[1240px] max-md:w-[calc(100%_-_32px)] animate-rise-in">
        <div className="grid gap-6">
          {/* Action Header Card */}
          <div className="surface flex items-center justify-between gap-4 p-5 max-sm:flex-col max-sm:items-start">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                  filter === "all"
                    ? "bg-teal-700 text-white shadow-md shadow-teal-700/15"
                    : "bg-slate-100/70 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
                type="button"
              >
                All Notifications ({notifications.length})
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                  filter === "unread"
                    ? "bg-teal-700 text-white shadow-md shadow-teal-700/15"
                    : "bg-slate-100/70 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60"
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
                className="button-secondary min-h-10 px-4 text-xs font-bold cursor-pointer"
                type="button"
              >
                Mark All as Read
              </button>
            )}
          </div>

          {/* List Container */}
          <div className="grid gap-3">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 text-slate-400 border border-slate-100/50">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-2.25-1.5a2 2 0 00-2.22 0l-2.25 1.5"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-800">
                  Your notification log is clear
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-400">
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
                    className={`rounded-2xl border transition-all duration-200 shadow-sm ${
                      !item.read
                        ? "border-teal-500/25 bg-teal-500/[0.03] ring-4 ring-teal-500/[0.02]"
                        : "border-slate-100 bg-white"
                    }`}
                  >
                    {/* Summary Header Row */}
                    <div
                      onClick={() => toggleExpand(item.id, item.read)}
                      className="flex items-center justify-between gap-4 p-5 cursor-pointer hover:bg-slate-50/40"
                    >
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        {/* Status Icon - low-opacity pastel styling */}
                        <div
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                            isSuccess
                              ? "bg-emerald-500/15 text-emerald-700"
                              : "bg-rose-500/15 text-rose-700"
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
                                strokeWidth={2.2}
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
                                strokeWidth={2.2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                          )}
                        </div>

                        {/* Title & Message Summary */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-800">{item.title}</span>
                            {!item.read && (
                              <span className="rounded-lg bg-teal-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase text-teal-700 tracking-wide animate-pulse">
                                New
                              </span>
                            )}
                          </div>
                          <p className="m-0 mt-1 text-xs font-medium text-slate-500 line-clamp-1 leading-relaxed">
                            {item.message}
                          </p>
                        </div>
                      </div>

                      {/* Right Arrow and Date */}
                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <span className="text-xs font-bold text-slate-400 font-sans">
                          {new Date(item.createdAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <svg
                          className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.8}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Expandable Diagnostic Panel */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-6 rounded-b-2xl animate-fade-in">
                        <p className="m-0 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          Diagnostic Metadata Log
                        </p>
                        <p className="m-0 mt-2 text-xs font-semibold text-slate-700 leading-relaxed">
                          {item.message}
                        </p>

                        {/* Structured details display depending on Success vs Failure */}
                        {(() => {
                          if (isSuccess) {
                            const successMeta = item.metadata as ImportSuccessMetadata;
                            return (
                              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 border border-slate-100 bg-white p-4 rounded-xl shadow-sm">
                                <div className="rounded-lg bg-slate-50/70 p-3.5">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                                    File Name
                                  </span>
                                  <p className="m-0 mt-1 text-xs font-black text-slate-800 truncate">
                                    {successMeta.fileName}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-slate-50/70 p-3.5">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                                    Branch Code
                                  </span>
                                  <p className="m-0 mt-1 text-xs font-black text-slate-800">
                                    {successMeta.branchCode}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-emerald-500/10 p-3.5 border border-emerald-500/10">
                                  <span className="text-[9px] font-extrabold text-emerald-700 uppercase tracking-wide">
                                    Valid Rows
                                  </span>
                                  <p className="m-0 mt-1 text-xs font-black text-emerald-800">
                                    {successMeta.validRows} / {successMeta.totalRows}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-rose-500/10 p-3.5 border border-rose-500/10">
                                  <span className="text-[9px] font-extrabold text-rose-700 uppercase tracking-wide">
                                    Invalid Rows
                                  </span>
                                  <p className="m-0 mt-1 text-xs font-black text-rose-800">
                                    {successMeta.invalidRows} / {successMeta.totalRows}
                                  </p>
                                </div>
                              </div>
                            );
                          } else {
                            const failureMeta = item.metadata as ImportFailureMetadata;
                            return (
                              <div className="mt-4 border border-rose-200/50 bg-rose-50/20 p-5 rounded-xl shadow-sm">
                                <div className="flex items-center gap-2 mb-3.5 text-rose-700 font-black text-xs uppercase tracking-wider">
                                  <svg
                                    className="h-4.5 w-4.5 shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2.2}
                                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  Failure Diagnostics Log
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                  <div className="rounded-lg bg-white/70 p-3 border border-rose-100/50">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                                      File Name
                                    </span>
                                    <p className="m-0 mt-0.5 text-xs font-black text-slate-800 truncate">
                                      {failureMeta.fileName}
                                    </p>
                                  </div>
                                  <div className="rounded-lg bg-white/70 p-3 border border-rose-100/50">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                                      Branch Code
                                    </span>
                                    <p className="m-0 mt-0.5 text-xs font-black text-slate-800">
                                      {failureMeta.branchCode}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                                  Detailed Error Message
                                </span>
                                <pre className="mt-2 p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all shadow-inner border border-slate-800">
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
