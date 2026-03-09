import Link from "next/link";

import { cn } from "@jinka-eg/ui";

export function LocaleSwitcher({ locale }: { locale: "en" | "ar" }) {
  const locales: Array<"en" | "ar"> = ["en", "ar"];

  return (
    <div className="inline-flex rounded-full border border-stone-300 bg-white/80 p-1">
      {locales.map((item) => (
        <Link
          key={item}
          href={`/${item}`}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-semibold transition",
            item === locale ? "bg-stone-950 text-white" : "text-stone-600"
          )}
        >
          {item.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
