"use client";

import { useCurrentUser, useLogout } from "@/features/auth/use-auth";

export default function DashboardPage() {
  const { data: user, isLoading, error } = useCurrentUser();
  const logout = useLogout();

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen w-[calc(100%_-_48px)] max-w-[960px] py-16 max-md:w-[calc(100%_-_32px)] max-md:py-8">
        Loading...
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto min-h-screen w-[calc(100%_-_48px)] max-w-[960px] py-16 max-md:w-[calc(100%_-_32px)] max-md:py-8">
        <section className="grid gap-6 rounded-lg border border-border bg-white p-7">
          <h1 className="m-0 text-3xl tracking-normal">Session expired</h1>
          <button
            className="min-h-10 w-fit cursor-pointer rounded-md bg-foreground px-4 font-bold text-white"
            onClick={logout}
            type="button"
          >
            Back to login
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-[calc(100%_-_48px)] max-w-[960px] py-16 max-md:w-[calc(100%_-_32px)] max-md:py-8">
      <section className="grid gap-6 rounded-lg border border-border bg-white p-7">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-normal text-accent">
            Dashboard
          </p>
          <h1 className="m-0 text-3xl tracking-normal">
            Welcome{user?.fullName ? `, ${user.fullName}` : ""}
          </h1>
        </div>

        <dl className="m-0 grid grid-cols-3 gap-4 max-md:grid-cols-1">
          <div className="min-h-[84px] rounded-lg border border-border p-4">
            <dt className="text-xs font-bold uppercase text-muted">Email</dt>
            <dd className="mt-2 break-words font-bold">{user?.email}</dd>
          </div>
          <div className="min-h-[84px] rounded-lg border border-border p-4">
            <dt className="text-xs font-bold uppercase text-muted">Role</dt>
            <dd className="mt-2 font-bold">{user?.role}</dd>
          </div>
          <div className="min-h-[84px] rounded-lg border border-border p-4">
            <dt className="text-xs font-bold uppercase text-muted">Branch</dt>
            <dd className="mt-2 break-words font-bold">
              {user?.branchId ?? "All branches"}
            </dd>
          </div>
        </dl>

        <button
          className="min-h-10 w-fit cursor-pointer rounded-md bg-foreground px-4 font-bold text-white"
          onClick={logout}
          type="button"
        >
          Sign out
        </button>
      </section>
    </main>
  );
}
