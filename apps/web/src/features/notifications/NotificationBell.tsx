import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api-client";
import { NotificationBase, NotificationType } from "@stockflow/shared";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  // 1. SWR Real-Time Polling every 3 seconds
  const { data: notifications = [] } = useQuery<NotificationBase[]>({
    queryKey: ["notifications"],
    queryFn: () => apiRequest<NotificationBase[]>("/notifications"),
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  // 2. Mark specific notification as read mutation
  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // 3. Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("/notifications/read-all", { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = (item: NotificationBase) => {
    if (!item.read) {
      markReadMutation.mutate(item.id);
    }
    setIsOpen(false);
    // Navigate to full details view on the dedicated history dashboard
    router.push("/dashboard/notifications");
  };

  const formatTime = (dateInput: Date | string) => {
    const date = new Date(dateInput);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  // Limit dropdown items to the 5 most recent alerts to keep the navbar light
  const displayItems = notifications.slice(0, 5);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Icon Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:-translate-y-[1px] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 transition-all duration-200 active:scale-95 active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-slate-100"
        type="button"
        aria-label="Toggle notifications"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Live Unread Pill Indicator */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[9px] font-black text-white ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Glassmorphic Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-[370px] origin-top-right rounded-2xl border border-white/80 bg-white/92 p-4.5 shadow-2xl shadow-teal-950/12 ring-1 ring-slate-950/5 backdrop-blur-2xl transition-all z-50 animate-slide-down">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2.5">
            <div>
              <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-slate-800">
                Notifications
              </h3>
              <p className="m-0 text-[10px] font-semibold text-slate-400">
                You have {unreadCount} unread alert{unreadCount !== 1 ? "s" : ""}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-[11px] font-extrabold text-teal-700 hover:text-teal-800 hover:underline bg-transparent border-0 cursor-pointer transition-colors"
                type="button"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[300px] overflow-y-auto grid gap-2 scrollbar-thin">
            {displayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-slate-400 border border-slate-100/50">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v4.5m12 3h.01M12 17h.01M8 17h.01"
                    />
                  </svg>
                </div>
                <p className="mt-3 text-xs font-bold text-slate-700">No notifications yet</p>
                <p className="text-[10px] text-slate-400 mt-0.5">System alerts will show up here</p>
              </div>
            ) : (
              displayItems.map((item) => {
                const isSuccess = item.type === NotificationType.IMPORT_SUCCESS;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`flex items-start gap-3 rounded-xl p-3 cursor-pointer border border-transparent transition-all duration-200 hover:-translate-y-[1px] hover:bg-teal-50/45 hover:scale-[1.01] hover:shadow-sm ${
                      !item.read
                        ? "bg-teal-500/[0.04] border-teal-500/10 hover:border-teal-500/20"
                        : "border-slate-50 bg-white/40"
                    }`}
                  >
                    {/* Status Badge - ultra-soft style */}
                    <div
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                        isSuccess
                          ? "bg-emerald-500/15 text-emerald-700"
                          : "bg-rose-500/15 text-rose-700"
                      }`}
                    >
                      {isSuccess ? (
                        <svg
                          className="h-4.5 w-4.5"
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
                          className="h-4.5 w-4.5"
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

                    {/* Alert Message Text */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-bold text-slate-800">
                          {item.title}
                        </span>
                        <span className="shrink-0 text-[9px] font-bold text-slate-400 font-sans">
                          {formatTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="m-0 mt-0.5 line-clamp-2 text-[11px] font-medium text-slate-500 leading-relaxed">
                        {item.message}
                      </p>
                    </div>

                    {/* Unread indicator dot */}
                    {!item.read && (
                      <span className="h-2 w-2 shrink-0 self-center rounded-full bg-teal-600 shadow-sm" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer View All Shortcut */}
          <div className="mt-3.5 border-t border-slate-100 pt-3 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push("/dashboard/notifications");
              }}
              className="text-xs font-bold text-teal-700 hover:text-teal-800 bg-transparent border-0 cursor-pointer hover:underline transition-colors"
              type="button"
            >
              View all notification history
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
