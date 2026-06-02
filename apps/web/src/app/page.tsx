"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth-token";

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
      <section className="content-layer grid w-full max-w-[440px] gap-6 rounded-xl border border-black/[0.04] bg-white p-9 shadow-[0_2px_8px_rgba(15,23,42,0.02)] animate-rise-in">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-[#18181b] text-base font-semibold text-white">
          SF
        </div>
        <div className="grid gap-3 text-center">
          <div className="skeleton-shimmer mx-auto h-4 w-36" />
          <div className="skeleton-shimmer mx-auto h-8 w-56" />
          <div className="skeleton-shimmer mx-auto h-3 w-64" />
        </div>
        <div className="grid gap-4">
          <div className="skeleton-shimmer h-11 w-full" />
          <div className="skeleton-shimmer h-11 w-full" />
          <div className="skeleton-shimmer h-12 w-full rounded-2xl" />
        </div>
      </section>
    </main>
  );
}
