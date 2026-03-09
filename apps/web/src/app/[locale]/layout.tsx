import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { Cairo, Manrope, Space_Grotesk } from "next/font/google";

import { appLocales } from "@jinka-eg/config";
import { Providers } from "../../components/providers";
import { getMessages, resolveLocale } from "../../i18n/messages";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk"
});

const cairo = Cairo({
  subsets: ["arabic"],
  variable: "--font-cairo"
});

export function generateStaticParams() {
  return appLocales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!appLocales.includes(locale as (typeof appLocales)[number])) {
    notFound();
  }

  const safeLocale = resolveLocale(locale);
  const messages = getMessages(safeLocale);

  return (
    <div
      dir={safeLocale === "ar" ? "rtl" : "ltr"}
      className={`${manrope.variable} ${spaceGrotesk.variable} ${cairo.variable}`}
    >
      <NextIntlClientProvider locale={safeLocale} messages={messages}>
        <Providers>{children}</Providers>
      </NextIntlClientProvider>
    </div>
  );
}
