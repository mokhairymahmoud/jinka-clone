import Link from "next/link";

import { mockListings, mockProjects } from "@jinka-eg/fixtures";
import { Badge, Card, SectionTitle } from "@jinka-eg/ui";
import { ListingCard } from "../../components/listing-card";
import { MarketingHeader } from "../../components/marketing-header";
import { ProjectCard } from "../../components/project-card";
import { getMessages, resolveLocale } from "../../i18n/messages";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);

  return (
    <div className="min-h-screen">
      <MarketingHeader locale={safeLocale} labels={t} />
      <div className="mx-auto max-w-7xl px-6 py-12">
        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <Badge tone="accent">{t.heroEyebrow}</Badge>
            <h1 className="max-w-4xl font-display text-5xl font-bold tracking-tight text-stone-950 md:text-7xl">
              {t.heroTitle}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-stone-600">{t.heroBody}</p>
            <div className="flex flex-wrap gap-3">
              <Link href={`/${safeLocale}/search/units`} className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white">
                {t.heroPrimary}
              </Link>
              <Link href={`/${safeLocale}/trust`} className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-800">
                {t.heroSecondary}
              </Link>
            </div>
          </div>
          <Card className="grid gap-4 p-6 md:grid-cols-3 lg:grid-cols-1">
            <div>
              <div className="text-sm uppercase tracking-[0.24em] text-stone-500">{t.statsSources}</div>
              <div className="mt-3 text-4xl font-semibold text-stone-950">4</div>
            </div>
            <div>
              <div className="text-sm uppercase tracking-[0.24em] text-stone-500">{t.statsAlerts}</div>
              <div className="mt-3 text-4xl font-semibold text-stone-950">&lt; 2 min</div>
            </div>
            <div>
              <div className="text-sm uppercase tracking-[0.24em] text-stone-500">{t.statsTrust}</div>
              <div className="mt-3 text-4xl font-semibold text-stone-950">3-step</div>
            </div>
          </Card>
        </section>

        <section className="mt-20 space-y-8">
          <SectionTitle eyebrow={t.sectionWhy} title={t.sectionWhyTitle} description={t.sectionWhyBody} />
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="p-6">
              <Badge tone="success">{t.freshness}</Badge>
              <h3 className="mt-4 text-xl font-semibold">Real-time alerting</h3>
              <p className="mt-3 text-stone-600">Event-driven matching across new listings, updates, and price drops.</p>
            </Card>
            <Card className="p-6">
              <Badge tone="accent">{t.dedup}</Badge>
              <h3 className="mt-4 text-xl font-semibold">Canonical property cards</h3>
              <p className="mt-3 text-stone-600">Merge duplicates while retaining all source variants for transparency.</p>
            </Card>
            <Card className="p-6">
              <Badge tone="danger">{t.fraud}</Badge>
              <h3 className="mt-4 text-xl font-semibold">Explainable trust signals</h3>
              <p className="mt-3 text-stone-600">Show risk labels and reasoning before users click through to the original source.</p>
            </Card>
          </div>
        </section>

        <section className="mt-20 space-y-8">
          <SectionTitle eyebrow={t.units} title="Unit feed preview" description="The default browsing surface is a dense, mobile-first feed with freshness, price, and trust visible up front." />
          <div className="grid gap-6 lg:grid-cols-2">
            {mockListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} locale={safeLocale} />
            ))}
          </div>
        </section>

        <section className="mt-20 space-y-8">
          <SectionTitle eyebrow={t.projects} title="Projects remain first-class" description="Off-plan inventory stays separate from unit listings to keep ranking and decision-making clear." />
          <div className="grid gap-6 lg:grid-cols-2">
            {mockProjects.map((project) => (
              <ProjectCard key={project.id} project={project} locale={safeLocale} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
