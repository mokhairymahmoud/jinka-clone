import { mockProjects } from "@jinka-eg/fixtures";
import { Badge } from "@jinka-eg/ui";

import { ProjectCard } from "../../../../../components/project-card";
import { getMessages, resolveLocale } from "../../../../../i18n/messages";

export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);

  return (
    <div className="space-y-8">
      <div>
        <Badge tone="accent">{t.projects}</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">Project discovery</h1>
        <p className="mt-3 max-w-2xl text-stone-600">
          Separate browse surface for off-plan inventory, payment plans, developer context, and handoff timing.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {mockProjects.map((project) => (
          <ProjectCard key={project.id} project={project} locale={safeLocale} />
        ))}
      </div>
    </div>
  );
}
