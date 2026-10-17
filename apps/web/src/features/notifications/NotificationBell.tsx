import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api-client";
import { NotificationBase, NotificationType } from "@stockflow/shared";
import { useCurrentUser } from "@/features/auth/use-auth";
import { usePusherNotification } from "@/hooks/usePusher";
import { Icon } from "@/components/Icon";

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

    if (seconds < 60) return "Vừa xong";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  };

  // Keep the dropdown short; the full history lives on its own page.
  const displayItems = notifications.slice(0, 5);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"}
        className="toolbar-button"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <Icon className="h-[18px] w-[18px]" name="bell" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-sm bg-rose-700 px-1 font-mono text-[11px] font-semibold text-white ring-2 ring-[var(--color-bg-base)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div aria-label="Thông báo" className="dropdown-popover animate-slide-down" role="region">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-table-border)] px-4 py-3.5">
            <div>
              <h3 className="m-0 text-sm font-semibold">Thông báo</h3>
              <p className="m-0 text-xs text-[var(--color-text-muted)]">
                {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : "Bạn đã đọc hết"}
              </p>
            </div>
            {unreadCount > 0 ? (
              <button
                className="button-small-secondary"
                disabled={markAllReadMutation.isPending}
                onClick={() => markAllReadMutation.mutate()}
                type="button"
              >
                Đọc tất cả
              </button>
            ) : null}
          </div>

          <div className="p-2">
            <div className="dropdown-scroll">
              {displayItems.length === 0 ? (
                <div className="grid justify-items-center gap-2 py-10 text-center">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--color-bg-muted)] text-[var(--color-text-muted)]">
                    <Icon className="h-5 w-5" name="inbox" />
                  </span>
                  <p className="m-0 text-sm font-medium">Chưa có thông báo nào</p>
                  <p className="m-0 text-xs text-[var(--color-text-muted)]">
                    Kết quả nhập kho và cảnh báo đối soát sẽ hiện ở đây.
                  </p>
                </div>
              ) : (
                displayItems.map((item) => {
                  const isSuccess = item.type === NotificationType.IMPORT_SUCCESS;
                  return (
                    <button
                      className={`flex w-full cursor-pointer items-start gap-3 rounded-md p-3 text-left transition-colors duration-150 hover:bg-[var(--color-bg-muted)] ${
                        item.read ? "" : "bg-[var(--color-bg-muted)]/60"
                      }`}
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      type="button"
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${
                          isSuccess
                            ? "bg-emerald-700/10 text-emerald-800 dark:text-emerald-300"
                            : "bg-rose-700/10 text-rose-800 dark:text-rose-300"
                        }`}
                      >
                        <Icon className="h-4 w-4" name={isSuccess ? "checkCircle" : "alert"} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{item.title}</span>
                          <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                            {formatTime(item.createdAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-[var(--color-text-secondary)]">
                          {item.message}
                        </span>
                      </span>
                      {item.read ? null : (
                        <span
                          aria-label="Chưa đọc"
                          className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent-solid)]"
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="border-t border-[var(--color-table-border)] p-2">
            <button
              className="w-full cursor-pointer rounded-md py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)]"
              onClick={() => {
                setIsOpen(false);
                router.push("/dashboard/notifications");
              }}
              type="button"
            >
              Xem toàn bộ lịch sử
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
