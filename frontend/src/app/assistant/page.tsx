"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  User as UserIcon,
  Send,
  Sparkles,
  RefreshCw,
  Trash2,
  Building2,
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingUp,
  AlertTriangle,
  SlidersHorizontal,
  Table as TableIcon,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  category?: string;
  metrics?: Record<string, any>;
  dataTable?: any[];
  suggestedActions?: Array<{ label: string; href: string }>;
  timestamp: string;
}

export default function AssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Hello! I am **NEXUS AI Intelligence**, your institutional facility decision assistant. I have direct analytical access to campus telemetry, anomaly detection models, and the OR-Tools CP-SAT optimization engine. How can I help optimize campus spaces and power consumption today?",
      category: "welcome",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      suggestedActions: [
        { label: "Analyze Phantom Energy", href: "/anomalies" },
        { label: "Open What-If Simulator", href: "/simulator" },
      ],
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState<string>("");
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPrompts();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadPrompts() {
    try {
      const prompts = await api.getAssistantSuggestedPrompts();
      setSuggestedPrompts(prompts);
    } catch {
      setSuggestedPrompts([
        "What spaces currently suffer from phantom energy waste?",
        "Which lecture halls are underutilized below 40%?",
        "What are the projected savings if we move Friday classes online?",
        "Show me the most overloaded rooms across campus.",
      ]);
    }
  }

  async function handleSend(textToSend?: string) {
    const query = (textToSend || inputPrompt).trim();
    if (!query || loading) return;

    const userMsgId = `u-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt("");
    setLoading(true);

    try {
      const resp = await api.askAssistant(query);
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: "assistant",
        text: resp.answer,
        category: resp.category,
        metrics: resp.metrics,
        dataTable: resp.data_table,
        suggestedActions: resp.suggested_actions,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: `Sorry, I encountered an issue analyzing the database: ${err.message || "Unknown error"}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleClearChat() {
    setMessages([
      {
        id: "welcome-reset",
        sender: "assistant",
        text: "Chat cleared. What institutional space, energy, or timetable question can I answer for you?",
        category: "welcome",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-brand-blue border border-blue-100 shadow-xs">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-bold text-brand-navy">
                NEXUS Decision Assistant
              </h1>
              <Badge variant="blue" size="sm">
                GROUNDED ANALYTICAL ENGINE
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              Zero synthetic AI hallucination • 100% database-backed inference &amp; CP-SAT solver citations
            </p>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-xs flex items-center gap-1 border border-transparent hover:border-rose-200"
          title="Clear Conversation"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>

      {/* Suggested Starters Strip */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none flex-shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-brand-blue" /> Starters:
        </span>
        {suggestedPrompts.slice(0, 4).map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs bg-white hover:bg-blue-50/80 text-slate-700 hover:text-brand-blue border border-slate-200 whitespace-nowrap transition-all shadow-xs disabled:opacity-50 font-medium"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isUser
                    ? "bg-[#004E72] text-white shadow-sm"
                    : "bg-white text-brand-blue border border-slate-200 shadow-subtle"
                }`}
              >
                {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? "bg-[#004E72] text-white rounded-tr-none shadow-sm font-medium"
                    : "bg-white border border-slate-200 text-brand-navy rounded-tl-none shadow-subtle space-y-3"
                }`}
              >
                {/* Text / Markdown formatting */}
                <div className="whitespace-pre-line leading-relaxed">
                  {msg.text.split("\n\n").map((paragraph, pIdx) => (
                    <p key={pIdx} className="mb-2 last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {/* Metrics Pill Grid */}
                {!isUser && msg.metrics && Object.keys(msg.metrics).length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                    {Object.entries(msg.metrics).map(([key, val]) => (
                      <div key={key} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs sm:text-sm font-bold font-mono text-brand-navy">
                          {typeof val === "number"
                            ? key.includes("inr") || key.includes("loss") || key.includes("savings")
                              ? `₹${val.toLocaleString()}`
                              : val.toLocaleString()
                            : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Data Table */}
                {!isUser && msg.dataTable && msg.dataTable.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-[11px] text-slate-700">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                        <tr>
                          {Object.keys(msg.dataTable[0]).map((col) => (
                            <th key={col} className="py-2 px-3">
                              {col.replace(/_/g, " ")}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {msg.dataTable.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50">
                            {Object.values(row).map((val: any, cIdx) => (
                              <td key={cIdx} className="py-2 px-3 whitespace-nowrap">
                                {String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Suggested Actions */}
                {!isUser && msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase font-semibold text-slate-400">
                      Recommended Next Actions:
                    </span>
                    {msg.suggestedActions.map((action, aIdx) => (
                      <Link
                        key={aIdx}
                        href={action.href}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-brand-blue bg-blue-50 hover:bg-blue-100 rounded-md transition-colors border border-blue-200"
                      >
                        <span>{action.label}</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    ))}
                  </div>
                )}

                <div className={`text-[10px] pt-1 ${isUser ? "text-blue-200 text-right" : "text-slate-400"}`}>
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-white text-brand-blue border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-subtle">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 shadow-subtle flex items-center gap-2 text-xs text-slate-600">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-blue" />
              <span>Querying database aggregation &amp; solver records...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <Card className="p-2 border-slate-200 bg-white shadow-subtle flex-shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask about space utilization, anomalies, energy waste, or scenario simulations..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            disabled={loading}
            className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-brand-navy placeholder-slate-400 focus:outline-none"
          />
          <Button
            type="submit"
            variant="accent"
            size="sm"
            disabled={loading || !inputPrompt.trim()}
            className="font-bold flex items-center gap-1.5 shadow-xs"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Send Query</span>
          </Button>
        </form>
      </Card>
    </div>
  );
}
