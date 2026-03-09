import { Badge, Card } from "@jinka-eg/ui";

import { getMessages, resolveLocale } from "../../../../../i18n/messages";
import { authenticatedApiFetch } from "../../../../../lib/server-api";

type Shortlist = {
  id: string;
  name: string;
  description?: string;
  members: Array<{
    id: string;
    email: string;
    name?: string;
    role: string;
  }>;
  items: Array<{
    id: string;
    clusterId: string;
    note?: string;
    listing: {
      id: string;
      title: { en: string; ar: string };
      area: { name: { en: string; ar: string } };
      variantCount: number;
      price: { amount: number };
    };
  }>;
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: {
      email: string;
      name?: string;
    };
  }>;
};

async function fetchShortlist(id: string) {
  const response = await authenticatedApiFetch(`/v1/shortlists/${id}`);

  if (!response?.ok) {
    return null;
  }

  return (await response.json()) as Shortlist;
}

export default async function ShortlistPage({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);
  const shortlist = await fetchShortlist(id);

  if (!shortlist) {
    return (
      <div className="space-y-8">
        <div>
          <Badge tone="accent">{t.shortlist}</Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">{t.shortlistTitle}</h1>
          <p className="mt-3 text-sm text-stone-600">Shortlist not found or unavailable for this account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Badge tone="accent">{t.shortlist}</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">
          {t.shortlistTitle}: {shortlist.name}
        </h1>
        {shortlist.description ? <p className="mt-3 text-sm text-stone-600">{shortlist.description}</p> : null}
        <p className="mt-2 text-xs text-stone-500">
          {shortlist.members.map((member) => `${member.email} (${member.role})`).join(" · ")}
        </p>
      </div>
      <div className="grid gap-4">
        {shortlist.items.map((item) => (
          <Card key={item.id} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-stone-950">{item.listing.title[safeLocale]}</div>
                <div className="mt-1 text-sm text-stone-600">{item.listing.area.name[safeLocale]}</div>
                <div className="mt-1 text-sm text-stone-500">EGP {item.listing.price.amount.toLocaleString()}</div>
                {item.note ? <div className="mt-2 text-sm text-stone-600">{item.note}</div> : null}
              </div>
              <Badge tone="neutral">{item.listing.variantCount} variants</Badge>
            </div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4">
        {shortlist.comments.map((comment) => (
          <Card key={comment.id} className="p-5">
            <div className="text-sm font-semibold text-stone-950">{comment.author.name ?? comment.author.email}</div>
            <div className="mt-2 text-sm text-stone-600">{comment.body}</div>
            <div className="mt-2 text-xs text-stone-500">{new Date(comment.createdAt).toLocaleString()}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
