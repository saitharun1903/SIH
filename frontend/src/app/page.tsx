"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col items-center justify-center text-slate-500">
      <div className="h-8 w-8 border-2 border-[#004E72] border-t-transparent rounded-full animate-spin mb-3" />
      <span className="text-xs uppercase font-mono tracking-wider font-semibold text-[#092634]">
        Connecting to NEXUS Platform...
      </span>
    </div>
  );
}
