"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth-token";
import { BrandMark } from "@/components/BrandLogo";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <main className="app-background grid place-items-center px-6 py-12">
      <section className="content-layer grid w-full max-w-[440px] gap-6 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-bg-surface)] p-9 [box-shadow:var(--color-card-shadow)] animate-rise-in">
        <div className="mx-auto">
          <BrandMark className="h-11 w-11" />
        </div>
        <div className="grid gap-3 text-center">
          <div className="skeleton-shimmer mx-auto h-4 w-36" />
          <div className="skeleton-shimmer mx-auto h-8 w-56" />
          <div className="skeleton-shimmer mx-auto h-3 w-64" />
        </div>
        <div className="grid gap-4">
          <div className="skeleton-shimmer h-11 w-full" />
          <div className="skeleton-shimmer h-11 w-full" />
          <div className="skeleton-shimmer h-12 w-full rounded-lg" />
        </div>
      </section>
    </main>
  );
}
