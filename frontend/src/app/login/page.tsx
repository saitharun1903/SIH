"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Cpu, Lock, Mail, AlertCircle, Sparkles, CheckCircle2, Shield } from "lucide-react";

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please verify your credentials.");
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F9F9F9] text-[#092634] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-2xl bg-[#004E72] text-white flex items-center justify-center shadow-md">
            <Cpu className="h-8 w-8" />
          </div>
        </div>
        <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#092634]">
          NEXUS
        </h2>
        <p className="mt-1 text-xs uppercase font-mono tracking-wider text-[#004E72] font-bold">
          AI-Powered Resource Intelligence & Optimization
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Smart India Hackathon 2026 — Problem Statement SIH26202
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-subtle border border-slate-200 rounded-2xl sm:px-10">
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Institutional Email
              </label>
              <div className="relative rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@nexus.edu"
                  className="block w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-xs text-[#092634] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#004E72] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-xs text-[#092634] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#004E72] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-bold bg-[#004E72] hover:bg-[#003d59] text-white shadow-sm mt-2"
              isLoading={isLoading}
            >
              Sign In to Platform
            </Button>
          </form>

          {/* Quick Demo Logins Section */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#004E72]" />
                Institutional Demo Roles
              </span>
              <span className="text-[10px] text-[#004E72] font-mono font-semibold">1-Click Autofill</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin("admin@nexus.edu", "Admin@123")}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors"
              >
                <div className="text-xs font-bold text-[#092634]">Admin</div>
                <div className="text-[10px] text-[#004E72] font-semibold">Full Access</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("analyst@nexus.edu", "Analyst@123")}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors"
              >
                <div className="text-xs font-bold text-[#092634]">Analyst</div>
                <div className="text-[10px] text-sky-600 font-semibold">ML / What-If</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("viewer@nexus.edu", "Viewer@123")}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors"
              >
                <div className="text-xs font-bold text-[#092634]">Viewer</div>
                <div className="text-[10px] text-slate-500 font-semibold">Auditor</div>
              </button>
            </div>
            <p className="mt-3 text-[11px] text-slate-500 text-center">
              Click any role to autofill valid database test credentials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
