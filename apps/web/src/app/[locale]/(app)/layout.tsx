import { AppShell } from "../../../components/app-shell";
import { getMessages, resolveLocale } from "../../../i18n/messages";

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

  return <AppShell locale={safeLocale} labels={t}>{children}</AppShell>;
}
