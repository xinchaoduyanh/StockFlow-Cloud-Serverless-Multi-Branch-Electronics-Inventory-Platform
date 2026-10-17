import { BrandMark } from "@/components/BrandLogo";

export function DashboardSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-[var(--color-bg-base)]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-6 border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark className="h-10 w-10" />
          <div className="skeleton-shimmer h-5 w-28" />
        </div>
        <div className="grid gap-2.5 pt-4">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div className="skeleton-shimmer h-9 w-full" key={item} />
          ))}
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        <div className="flex h-16 items-center justify-between border-b border-[var(--color-border-subtle)] px-6 md:px-8">
          <div className="skeleton-shimmer h-6 w-40" />
          <div className="flex gap-2">
            <div className="skeleton-shimmer h-9 w-9" />
            <div className="skeleton-shimmer h-9 w-9" />
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-[1240px] gap-6 p-6 md:p-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div className="surface grid gap-5 p-5" key={item}>
                <div className="skeleton-shimmer h-4 w-28" />
                <div className="skeleton-shimmer h-8 w-20" />
              </div>
            ))}
          </div>
          <div className="surface grid gap-3 p-5">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div className="skeleton-shimmer h-5 w-full" key={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoginRedirectSkeleton() {
  return (
    <main className="app-background grid place-items-center px-6 py-16 animate-fade-in">
      <section className="content-layer grid w-full max-w-[420px] gap-5 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-bg-surface)] p-8 text-center [box-shadow:var(--color-card-shadow)] animate-rise-in">
        <div className="mx-auto">
          <BrandMark className="h-11 w-11" />
        </div>
        <div className="skeleton-shimmer mx-auto h-5 w-44" />
        <div className="skeleton-shimmer mx-auto h-3 w-64" />
        <div className="grid gap-3 pt-2">
          <div className="skeleton-shimmer h-11 w-full" />
          <div className="skeleton-shimmer h-11 w-full" />
        </div>
      </section>
    </main>
  );
}
