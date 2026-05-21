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
    <main className="grid min-h-screen place-items-center bg-[#f7f8fa]">
      <div className="text-center">
        <p className="animate-pulse text-sm font-medium text-[#5c667a]">Redirecting...</p>
      </div>
    </main>
  );
}
