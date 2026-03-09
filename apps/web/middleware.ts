import createMiddleware from "next-intl/middleware";

import { appLocales } from "@jinka-eg/config";

export default createMiddleware({
  locales: [...appLocales],
  defaultLocale: "en",
  localePrefix: "always"
});

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"]
};
