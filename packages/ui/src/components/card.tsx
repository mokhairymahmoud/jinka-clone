import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/utils";

export function Card({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-[var(--jinka-border)] bg-[var(--jinka-surface)] shadow-[var(--jinka-shadow)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
