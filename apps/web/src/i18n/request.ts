import { getRequestConfig } from "next-intl/server";

import { appLocales } from "@jinka-eg/config";
import { getMessages } from "./messages";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) ?? "en";
  const safeLocale = appLocales.includes(locale as (typeof appLocales)[number]) ? locale : "en";

  return {
    locale: safeLocale,
    messages: getMessages(safeLocale as "en" | "ar")
  };
});
