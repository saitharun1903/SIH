"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user && pathname !== "/login") {
      router.push("/login");
    }
  }, [user, isLoading, pathname, router]);

  // If on login page, don't render sidebar and navbar shell
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] text-[#092634] flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col md:pl-64 min-w-0 transition-all duration-200">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main
          key={pathname}
          className="flex-1 p-4 sm:p-6 lg:p-7 max-w-7xl mx-auto w-full page-transition-enter"
        >
          {children}
        </main>
      </div>
    </div>
  );
};
