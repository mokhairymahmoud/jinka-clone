import { Badge } from "@jinka-eg/ui";
import type { ProjectSummary } from "@jinka-eg/types";

import { ProjectCard } from "../../../../../components/project-card";
import { getMessages, resolveLocale } from "../../../../../i18n/messages";
import { apiFetch } from "../../../../../lib/api";

type ProjectsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function fetchProjects(query?: string): Promise<ProjectSummary[]> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  const response = await apiFetch(`/v1/projects${params.toString() ? `?${params.toString()}` : ""}`);

  if (!response.ok) {
    return [];
  }

  return response.json();
}

export default async function ProjectsPage({ params, searchParams }: ProjectsPageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);
  const query = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : "";
  const projects = await fetchProjects(query);

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <Badge tone="accent">{t.projects}</Badge>
        <div className="lg:max-w-2xl">
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">Project discovery</h1>
          <p className="mt-3 text-stone-600">
            Separate browse surface for off-plan inventory, payment plans, developer context, and handoff timing.
          </p>
        </div>
        <form className="min-w-[280px]" method="GET">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search project, developer, or area"
            className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950"
          />
        </form>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} locale={safeLocale} />
        ))}
      </div>
    </div>
  );
}
