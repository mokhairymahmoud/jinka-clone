import type { ReactNode } from "react";

export function SectionTitle({
  eyebrow,
  title,
  description
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">{eyebrow}</div>
      <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-stone-950 md:text-4xl">{title}</h2>
      {description ? <p className="max-w-2xl text-base leading-7 text-stone-600">{description}</p> : null}
    </div>
  );
}
