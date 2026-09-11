import React from "react";
import clsx from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "blue" | "navy" | "orange" | "success" | "warning" | "danger" | "info" | "purple" | "neutral";
  size?: "sm" | "md";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  size = "md",
  className,
}) => {
  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px] font-medium tracking-tight",
    md: "px-2.5 py-1 text-xs font-medium",
  };

  const variantStyles = {
    default: "bg-slate-100 text-slate-800 border border-slate-200",
    neutral: "bg-slate-100 text-slate-700 border border-slate-200",
    blue: "bg-[#EBF3F7] text-[#004E72] border border-[#B3D1E0] font-semibold",
    navy: "bg-[#092634] text-white border border-[#092634] font-medium",
    orange: "bg-[#FFF1ED] text-[#D8481E] border border-[#FFD2C4] font-semibold",
    success: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border border-amber-200",
    danger: "bg-rose-50 text-rose-800 border border-rose-200",
    info: "bg-[#EBF3F7] text-[#004E72] border border-[#B3D1E0]",
    purple: "bg-slate-100 text-[#092634] border border-slate-200",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium rounded-full",
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
