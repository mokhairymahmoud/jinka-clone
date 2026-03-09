import Link from "next/link";
import { notFound } from "next/navigation";

import { mockProjects } from "@jinka-eg/fixtures";
import { Badge, Card } from "@jinka-eg/ui";
import { resolveLocale } from "../../../../../i18n/messages";

export default async function ProjectDetailPage({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const safeLocale = resolveLocale(locale);
  const project = mockProjects.find((item) => item.id === id);

  if (!project) notFound();

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] bg-[linear-gradient(135deg,#8f4f32_0%,#c4955b_60%,#f5efe6_100%)] p-8 text-white">
        <Badge tone="accent">Project</Badge>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight">{project.name[safeLocale]}</h1>
        <p className="mt-3 text-lg text-white/80">{project.developerName[safeLocale]}</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6">
          <div className="text-sm uppercase tracking-[0.2em] text-stone-500">Starting price</div>
          <div className="mt-4 text-3xl font-semibold text-stone-950">
            EGP {new Intl.NumberFormat("en-US").format(project.startingPrice?.amount ?? 0)}
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm uppercase tracking-[0.2em] text-stone-500">Plan</div>
          <div className="mt-4 text-3xl font-semibold text-stone-950">{project.paymentPlanYears} years</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm uppercase tracking-[0.2em] text-stone-500">Handoff</div>
          <div className="mt-4 text-3xl font-semibold text-stone-950">{project.handoffYear}</div>
        </Card>
      </div>
      <Link href={project.sourceUrls[0]} className="inline-flex rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white">
        Open source page
      </Link>
    </div>
  );
}
