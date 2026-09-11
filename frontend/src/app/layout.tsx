import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { AppLayout } from "@/components/layout/AppLayout";

export const metadata: Metadata = {
  title: "NEXUS | AI-Powered Resource Intelligence & Optimization Platform",
  description: "Smart India Hackathon 2026 - Problem Statement SIH26202: Smart Automation for Institutional Resource Management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-[#F9F9F9] text-brand-navy">
        <AuthProvider>
          <WorkspaceProvider>
            <AppLayout>{children}</AppLayout>
          </WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

