import type { ReactNode } from "react";

import { cn } from "../lib/utils";

export function Badge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "danger" | "success";
}) {
  const tones = {
    neutral: "bg-[var(--jinka-surface-muted)] text-[var(--jinka-muted)]",
    accent: "bg-[var(--jinka-accent-soft)] text-[var(--jinka-accent)]",
    danger: "bg-rose-100 text-rose-800",
    success: "bg-emerald-100 text-emerald-800"
  };

  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}
