"use client";

import { UserRole } from "@stockflow/shared";
import { BrandLogo } from "@/components/BrandLogo";
import { Icon } from "@/components/Icon";
import type { AuthUser } from "@/features/auth/types";
import { USER_ROLE_LABELS } from "@/features/auth/role-labels";
import { DASHBOARD_TABS, TAB_GROUP_LABELS, TabId } from "./tabs";

type SidebarProps = {
  user: AuthUser;
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onLogout: () => void;
};

function SidebarNav({
  isAdmin,
  activeTab,
  onSelectTab,
}: Pick<SidebarProps, "activeTab" | "onSelectTab"> & { isAdmin: boolean }) {
  const visibleTabs = DASHBOARD_TABS.filter((tab) => isAdmin || tab.group !== "admin");
  const groups = Array.from(new Set(visibleTabs.map((tab) => tab.group)));

  return (
    <nav aria-label="Điều hướng chính" className="flex-1 overflow-y-auto px-3 py-5">
      {groups.map((group) => (
        <div className="mb-6 last:mb-0" key={group}>
          <p className="m-0 mb-2 px-3 text-xs font-medium text-[var(--color-text-muted)]">
            {TAB_GROUP_LABELS[group]}
          </p>
          <ul className="m-0 grid list-none gap-0.5 p-0">
            {visibleTabs
              .filter((tab) => tab.group === group)
              .map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <li key={tab.id}>
                    <button
                      aria-current={isActive ? "page" : undefined}
                      className={`relative flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 ${
                        isActive
                          ? "bg-[var(--color-bg-muted)] font-semibold text-[var(--color-text-primary)]"
                          : "font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]/60 hover:text-[var(--color-text-primary)]"
                      }`}
                      onClick={() => onSelectTab(tab.id)}
                      type="button"
                    >
                      {isActive ? (
                        <span
                          aria-hidden="true"
                          className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[var(--color-accent-solid)]"
                        />
                      ) : null}
                      <Icon
                        className={`h-[18px] w-[18px] ${isActive ? "text-[var(--color-accent-solid)]" : "text-[var(--color-text-muted)]"}`}
                        name={tab.icon}
                      />
                      <span>{tab.label}</span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarUser({ user, onLogout }: Pick<SidebarProps, "user" | "onLogout">) {
  const displayName = user.fullName ?? user.email;

  return (
    <div className="border-t border-[var(--color-border-subtle)] p-3">
      <div className="flex items-center gap-3 rounded-md p-2">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--color-accent-solid)] font-display text-sm font-semibold text-[var(--color-accent-contrast)]"
        >
          {displayName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-sm font-semibold">{displayName}</p>
          <p className="m-0 truncate text-xs text-[var(--color-text-muted)]">
            {USER_ROLE_LABELS[user.role] ?? user.role}
          </p>
        </div>
        <button
          aria-label="Đăng xuất"
          className="icon-button hover:text-rose-700"
          onClick={onLogout}
          title="Đăng xuất"
          type="button"
        >
          <Icon className="h-[18px] w-[18px]" name="logout" />
        </button>
      </div>
    </div>
  );
}

function SidebarHeader() {
  return (
    <div className="grid gap-3 border-b border-[var(--color-border-subtle)] px-5 py-5">
      <BrandLogo caption="Quản trị kho hàng" markClassName="h-10 w-10" />
      <p className="m-0 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
        </span>
        Hệ thống đang hoạt động
      </p>
    </div>
  );
}

function SidebarBody({ user, activeTab, onSelectTab, onLogout }: SidebarProps) {
  return (
    <>
      <SidebarHeader />
      <SidebarNav
        activeTab={activeTab}
        isAdmin={user.role === UserRole.ADMIN}
        onSelectTab={onSelectTab}
      />
      <SidebarUser onLogout={onLogout} user={user} />
    </>
  );
}

export function DesktopSidebar(props: SidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] lg:flex">
      <SidebarBody {...props} />
    </aside>
  );
}

type MobileDrawerProps = SidebarProps & { onClose: () => void };

export function MobileDrawer({ onClose, onSelectTab, ...rest }: MobileDrawerProps) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-50 flex lg:hidden" role="dialog">
      <button
        aria-label="Đóng menu"
        className="animate-backdrop fixed inset-0 cursor-default bg-[var(--color-text-primary)]/45"
        onClick={onClose}
        type="button"
      />
      <aside className="animate-rise-in relative z-10 flex h-full w-64 max-w-[85vw] flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-2xl">
        <button
          aria-label="Đóng menu"
          className="icon-button absolute right-3 top-4 z-10"
          onClick={onClose}
          type="button"
        >
          <Icon className="h-5 w-5" name="close" />
        </button>
        <SidebarBody
          {...rest}
          onSelectTab={(tab) => {
            onSelectTab(tab);
            onClose();
          }}
        />
      </aside>
    </div>
  );
}
