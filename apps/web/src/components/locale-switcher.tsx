import Link from "next/link";

import { cn } from "@jinka-eg/ui";

export function LocaleSwitcher({ locale }: { locale: "en" | "ar" }) {
  const locales: Array<"en" | "ar"> = ["en", "ar"];

  return (
    <div className="inline-flex rounded-full border border-[var(--jinka-border)] bg-[var(--jinka-surface)] p-1">
      {locales.map((item) => (
        <Link
          key={item}
          href={`/${item}`}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-semibold transition",
            item === locale ? "bg-[var(--jinka-accent)] text-white" : "text-[var(--jinka-muted)]"
          )}
        >
          {item.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
