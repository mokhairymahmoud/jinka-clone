import Link from "next/link";

import { LocaleSwitcher } from "./locale-switcher";

export function MarketingHeader({
  locale,
  labels
}: {
  locale: "en" | "ar";
  labels: Record<string, string>;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-[#f8f5ef]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href={`/${locale}`} className="font-display text-xl font-bold tracking-tight text-stone-950">
          {labels.brand}
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-stone-700 md:flex">
          <Link href={`/${locale}/how-it-works`}>{labels.howItWorks}</Link>
          <Link href={`/${locale}/trust`}>{labels.trust}</Link>
          <Link href={`/${locale}/faq`}>{labels.faq}</Link>
        </nav>
        <LocaleSwitcher locale={locale} />
      </div>
    </header>
  );
}
