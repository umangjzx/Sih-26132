"use client";

import { Icon } from "./ui";

interface PageHeaderProps {
  icon: string;
  title: string;
  subtitle?: string;
  iconBg?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  icon,
  title,
  subtitle,
  iconBg = "bg-[var(--green-700)]",
  children,
}: PageHeaderProps) {
  return (
    <div className="mb-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconBg} text-white`}>
            <Icon name={icon} size={24} />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-[var(--green-900)]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{subtitle}</p>
            )}
          </div>
        </div>
        {children && <div className="sm:shrink-0">{children}</div>}
      </div>
    </div>
  );
}
