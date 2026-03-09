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
    neutral: "bg-stone-100 text-stone-700",
    accent: "bg-amber-100 text-amber-900",
    danger: "bg-rose-100 text-rose-800",
    success: "bg-emerald-100 text-emerald-800"
  };

  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}
