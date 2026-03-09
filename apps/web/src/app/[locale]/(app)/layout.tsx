import { AppShell } from "../../../components/app-shell";
import { getMessages, resolveLocale } from "../../../i18n/messages";
import { requireSessionUser } from "../../../lib/session";

export default async function AuthenticatedLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const t = getMessages(safeLocale);
  const user = await requireSessionUser(safeLocale);

  return <AppShell locale={safeLocale} labels={t} user={user}>{children}</AppShell>;
}
