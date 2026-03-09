import Link from "next/link";

import type { ProjectSummary } from "@jinka-eg/types";
import { Badge, Card } from "@jinka-eg/ui";

export function ProjectCard({
  project,
  locale
}: {
  project: ProjectSummary;
  locale: "en" | "ar";
}) {
  return (
    <Card className="overflow-hidden">
      <div className="h-32 bg-[linear-gradient(120deg,#8f4f32_0%,#c4955b_55%,#f5efe6_100%)] p-5 text-white">
        <Badge tone="accent">Project</Badge>
        <h3 className="mt-4 text-2xl font-semibold">{project.name[locale]}</h3>
      </div>
      <div className="space-y-4 p-5">
        <div className="text-sm text-stone-500">{project.developerName[locale]}</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Starting price</div>
            <div className="mt-1 text-xl font-semibold text-stone-950">
              EGP {new Intl.NumberFormat("en-US").format(project.startingPrice?.amount ?? 0)}
            </div>
          </div>
          <div className="text-right text-sm text-stone-600">
            <div>{project.paymentPlanYears} years</div>
            <div>handoff {project.handoffYear}</div>
          </div>
        </div>
        <Link
          href={`/${locale}/project/${project.id}`}
          className="inline-flex rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
        >
          View project
        </Link>
      </div>
    </Card>
  );
}
