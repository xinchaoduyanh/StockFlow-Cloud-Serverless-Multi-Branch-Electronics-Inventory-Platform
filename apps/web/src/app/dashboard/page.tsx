"use client";

import { UserRole } from "@stockflow/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCurrentUser, useLogout } from "@/features/auth/use-auth";
import { BranchesAdmin } from "@/features/branches/BranchesAdmin";
import { useBranches } from "@/features/branches/use-branches";
import { DashboardSkeleton, LoginRedirectSkeleton } from "@/features/dashboard/DashboardSkeleton";
import { DesktopSidebar, MobileDrawer } from "@/features/dashboard/Sidebar";
import { DASHBOARD_TABS, TabId } from "@/features/dashboard/tabs";
import { ImportsPanel } from "@/features/imports/ImportsPanel";
import { InventoryPanel } from "@/features/inventory/InventoryPanel";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { ReconciliationPanel } from "@/features/reconciliation/ReconciliationPanel";
import { RecoveryTab } from "@/features/recovery/RecoveryTab";
import { ReportsPanel } from "@/features/reports/ReportsPanel";
import { TransfersPanel } from "@/features/transfers/TransfersPanel";
import { UsersAdmin } from "@/features/users/UsersAdmin";

export default function DashboardPage() {
  const [hasMounted, setHasMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("inventory");
  // Branch picked explicitly in the filters; empty falls back to the user's own branch.
  const [branchFilter, setBranchFilter] = useState("");

  const { data: user, isLoading, error } = useCurrentUser();
  const branchesQuery = useBranches();
  const logout = useLogout();
  const router = useRouter();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted && !isLoading && (error || !user)) {
      router.replace("/login");
    }
  }, [hasMounted, isLoading, error, user, router]);

  if (!hasMounted || isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !user) {
    return <LoginRedirectSkeleton />;
  }

  const isAdmin = user.role === UserRole.ADMIN;
  const branches = branchesQuery.data ?? [];
  const selectedBranchId = branchFilter || user.branchId || "";
  const activeTabInfo = DASHBOARD_TABS.find((tab) => tab.id === activeTab) ?? DASHBOARD_TABS[0];

  return (
    <div className="flex min-h-screen w-full bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      <DesktopSidebar
        activeTab={activeTab}
        onLogout={logout}
        onSelectTab={setActiveTab}
        user={user}
      />

      {isSidebarOpen ? (
        <MobileDrawer
          activeTab={activeTab}
          onClose={() => setIsSidebarOpen(false)}
          onLogout={logout}
          onSelectTab={setActiveTab}
          user={user}
        />
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-6 md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label="Mở menu"
                className="icon-button -ml-2 lg:hidden"
                onClick={() => setIsSidebarOpen(true)}
                type="button"
              >
                <Icon name="menu" className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h2 className="m-0 truncate font-display text-lg font-semibold leading-tight tracking-tight">
                  {activeTabInfo.label}
                </h2>
                <p className="m-0 hidden truncate text-xs text-[var(--color-text-muted)] sm:block">
                  {activeTabInfo.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] flex-1 space-y-6 p-6 md:p-8" id="main">
          {activeTab === "inventory" || activeTab === "low-stock" ? (
            <InventoryPanel
              branches={branches}
              mode={activeTab}
              onBranchChange={setBranchFilter}
              selectedBranchId={selectedBranchId}
            />
          ) : null}

          {activeTab === "transfers" ? (
            <TransfersPanel
              branches={branches}
              isAdmin={isAdmin}
              selectedBranchId={selectedBranchId}
            />
          ) : null}

          {activeTab === "imports" ? (
            <ImportsPanel
              branches={branches}
              defaultBranchId={user.branchId}
              selectedBranchId={selectedBranchId}
            />
          ) : null}

          {activeTab === "reports" ? <ReportsPanel branchFilter={branchFilter} /> : null}

          {isAdmin && activeTab === "dlq" ? <RecoveryTab /> : null}
          {isAdmin && activeTab === "reconciliation" ? <ReconciliationPanel /> : null}
          {isAdmin && activeTab === "users" ? <UsersAdmin /> : null}
          {isAdmin && activeTab === "branches" ? <BranchesAdmin /> : null}
        </main>
      </div>
    </div>
  );
}
