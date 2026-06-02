import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api-client";
import { NotificationBase, NotificationType } from "@stockflow/shared";
import { useCurrentUser } from "@/features/auth/use-auth";
import { usePusherNotification } from "@/hooks/usePusher";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  // 1. Fetch current notifications initially (without polling)
  const { data: notifications = [] } = useQuery<NotificationBase[]>({
    queryKey: ["notifications"],
    queryFn: () => apiRequest<NotificationBase[]>("/notifications"),
  });

  const { data: user } = useCurrentUser();

  // 2. Listen to real-time events via Pusher to update query cache
  usePusherNotification(user?.id, (newNotification: NotificationBase) => {
    queryClient.setQueryData<NotificationBase[]>(["notifications"], (old = []) => {
      if (old.some((n) => n.id === newNotification.id)) return old;
      return [newNotification, ...old];
    });
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
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition-all duration-200 hover:scale-[1.05] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100 active:scale-[0.95] focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-800"
        type="button"
        aria-label="Toggle notifications"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
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
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-md bg-rose-700 px-1.5 text-[9px] font-medium text-white ring-2 ring-white dark:ring-slate-950 animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Glassmorphic Dropdown Popover */}
      {isOpen && (
        <div
          className="dropdown-popover animate-slide-down"
          role="region"
          aria-label="Notifications"
        >
          <div className="relative flex items-center justify-between border-b border-slate-200/60 dark:border-slate-805 bg-slate-50 dark:bg-slate-900/50 px-4.5 pb-3 pt-4">
            <div>
              <h3 className="m-0 text-xs font-medium uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Notifications
              </h3>
              <p className="m-0 text-[10px] font-normal text-slate-500 dark:text-slate-400">
                You have {unreadCount} unread alert{unreadCount !== 1 ? "s" : ""}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="cursor-pointer border-0 bg-transparent text-[11px] font-medium text-slate-600 dark:text-slate-400 transition-colors hover:text-slate-950 dark:hover:text-slate-200 hover:underline"
                type="button"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="relative p-3">
            <div className="dropdown-scroll">
              {displayItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 border border-slate-100/50 dark:border-slate-800/50">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v4.5m12 3h.01M12 17h.01M8 17h.01"
                      />
                    </svg>
                  </div>
                  <p className="mt-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                    No notifications yet
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    System alerts will show up here
                  </p>
                </div>
              ) : (
                displayItems.map((item) => {
                  const isSuccess = item.type === NotificationType.IMPORT_SUCCESS;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-slate-850 ${
                        !item.read
                          ? "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50"
                          : "border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900/10"
                      }`}
                    >
                      {/* Status Badge - ultra-soft style */}
                      <div
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${
                          isSuccess
                            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                            : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400"
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
                          <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                            {item.title}
                          </span>
                          <span className="shrink-0 font-sans text-[9px] font-normal text-slate-400 dark:text-slate-500">
                            {formatTime(item.createdAt)}
                          </span>
                        </div>
                        <p className="m-0 mt-0.5 line-clamp-2 text-[11px] font-normal leading-relaxed text-slate-500 dark:text-slate-400">
                          {item.message}
                        </p>
                      </div>

                      {/* Unread indicator dot */}
                      {!item.read && (
                        <span className="h-2 w-2 shrink-0 self-center rounded-full bg-slate-900 dark:bg-slate-200" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer View All Shortcut */}
          <div className="relative border-t border-slate-200/60 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-3 py-3 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push("/dashboard/notifications");
              }}
              className="w-full rounded-lg border-0 bg-transparent py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors duration-200 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-slate-100"
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
