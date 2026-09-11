import React from "react";
import clsx from "clsx";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  action,
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={clsx(
        "bg-white rounded-lg border border-[#E2E8F0] shadow-sm overflow-hidden",
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div className="px-5 py-3.5 border-b border-[#F1F5F9] flex items-center justify-between bg-white">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-[#092634] tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-[#64748B] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="flex items-center space-x-2">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};
