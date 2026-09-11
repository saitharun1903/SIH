"use client";

import React from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export const CardSkeleton: React.FC<{ count?: number; className?: string }> = ({
  count = 1,
  className = "h-28",
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-subtle animate-pulse flex flex-col justify-between ${className}`}
        >
          <div className="flex items-center justify-between">
            <div className="h-3 w-24 bg-slate-200 rounded" />
            <div className="h-7 w-7 bg-slate-100 rounded-lg" />
          </div>
          <div className="space-y-2 mt-2">
            <div className="h-6 w-16 bg-slate-200 rounded" />
            <div className="h-2.5 w-32 bg-slate-100 rounded" />
          </div>
        </div>
      ))}
    </>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => {
  return (
    <div className="w-full bg-white border border-[#E2E8F0] rounded-xl shadow-subtle overflow-hidden">
      <div className="h-10 bg-slate-50 border-b border-[#E2E8F0] px-4 flex items-center gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 bg-slate-200 rounded flex-1" />
        ))}
      </div>
      <div className="divide-y divide-[#F1F5F9] p-2 space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-3 py-2 flex items-center gap-4 animate-pulse">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-3.5 bg-slate-100 rounded flex-1"
                style={{ opacity: 1 - r * 0.12 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ChartSkeleton: React.FC<{ height?: string; title?: string }> = ({
  height = "h-64",
  title = "Loading Chart...",
}) => {
  return (
    <div className={`w-full bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-subtle flex flex-col justify-between ${height}`}>
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 bg-slate-200 rounded" />
        <div className="h-3 w-16 bg-slate-100 rounded" />
      </div>
      <div className="flex-1 flex items-end justify-between gap-2 pt-6 pb-2 px-2 animate-pulse">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="w-full bg-slate-100 rounded-t"
            style={{ height: `${20 + ((i * 37) % 70)}%` }}
          />
        ))}
      </div>
      <div className="h-3 w-40 bg-slate-100 rounded mx-auto" />
    </div>
  );
};

export const SectionError: React.FC<{
  title?: string;
  message?: string;
  onRetry?: () => void;
}> = ({
  title = "Failed to load section",
  message = "A temporary network issue occurred. Click retry to reload.",
  onRetry,
}) => {
  return (
    <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 text-xs flex items-center justify-between">
      <div className="flex items-center space-x-2.5 text-rose-800">
        <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
        <div>
          <span className="font-semibold">{title}:</span>{" "}
          <span className="text-rose-700">{message}</span>
        </div>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="text-xs h-7 ml-3 text-rose-700 hover:text-rose-900 border-rose-200 hover:bg-rose-100"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
};

export const EmptyState: React.FC<{
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}> = ({ icon: Icon, title, description, actionLabel, onAction, actionHref }) => {
  return (
    <div className="p-8 text-center bg-white border border-[#E2E8F0] rounded-xl shadow-subtle my-2">
      {Icon && (
        <div className="h-10 w-10 rounded-full bg-slate-100 text-[#004E72] flex items-center justify-center mx-auto mb-3">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <h3 className="text-sm font-bold text-[#092634]">{title}</h3>
      <p className="text-xs text-[#64748B] max-w-sm mx-auto mt-1 leading-relaxed">
        {description}
      </p>
      {actionLabel && (
        <div className="mt-4">
          {actionHref ? (
            <a
              href={actionHref}
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-[#004E72] text-white text-xs font-semibold hover:bg-[#003B56] transition-colors shadow-sm"
            >
              {actionLabel}
            </a>
          ) : onAction ? (
            <Button variant="primary" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
};

export const TableRowSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 5,
}) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="animate-pulse">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-5 py-4">
              <div
                className="h-3.5 bg-slate-100 rounded"
                style={{
                  width: `${60 + ((c * 17 + r * 13) % 35)}%`,
                  opacity: 1 - r * 0.1,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};
