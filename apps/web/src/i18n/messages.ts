import type { Locale } from "@jinka-eg/types";

const messages = {
  en: {
    brand: "Jinka EG",
    heroEyebrow: "Egypt-first real estate intelligence",
    heroTitle: "One search surface for Egypt’s scattered property market.",
    heroBody:
      "Aggregate rentals, resale, and off-plan inventory from major portals and approved social sources with real-time alerts, duplicate collapse, and trust signals.",
    heroPrimary: "Open unit search",
    heroSecondary: "Review trust model",
    statsSources: "Sources tracked",
    statsAlerts: "Alert latency target",
    statsTrust: "Trust review flow",
    sectionWhy: "Why this product",
    sectionWhyTitle: "The product is built around speed, signal quality, and confidence.",
    sectionWhyBody:
      "Jinka’s strongest pattern is not only aggregation. It is the combination of freshness, duplicate cleanup, visible risk signals, and action-oriented browsing.",
    navSearch: "Search",
    navAlerts: "Alerts",
    navFavorites: "Favorites",
    navInbox: "Inbox",
    navAccount: "Account",
    units: "Units",
    projects: "Projects",
    trust: "Trust",
    howItWorks: "How it works",
    faq: "FAQ",
    privacy: "Privacy",
    terms: "Terms",
    admin: "Admin",
    filters: "Filters",
    listMap: "List / map",
    dedup: "Duplicate-aware",
    fraud: "Risk-aware",
    priceDrop: "Price drop",
    freshness: "Fresh",
    sourceVariants: "Source variants",
    shortlist: "Shortlist",
    share: "Share",
    accountTitle: "Account and notification settings",
    alertsTitle: "Saved alerts",
    favoritesTitle: "Saved listings",
    adminTitle: "Operations console",
    shortlistTitle: "Shared shortlist",
    faqTitle: "Frequently asked questions",
    trustTitle: "Trust and fraud controls",
    howTitle: "How the aggregator works",
    privacyTitle: "Privacy and source attribution",
    termsTitle: "Terms and operating boundaries"
  },
  ar: {
    brand: "جينكا إيجيبت",
    heroEyebrow: "ذكاء عقاري موجه للسوق المصري",
    heroTitle: "واجهة بحث واحدة لسوق عقاري مشتت في مصر.",
    heroBody:
      "تجميع الإيجار وإعادة البيع والمشروعات من المصادر الرئيسية مع تنبيهات فورية واكتشاف التكرار وإشارات الثقة.",
    heroPrimary: "افتح بحث الوحدات",
    heroSecondary: "راجع نموذج الثقة",
    statsSources: "المصادر المتتبعة",
    statsAlerts: "هدف زمن التنبيه",
    statsTrust: "مسار مراجعة الثقة",
    sectionWhy: "لماذا هذا المنتج",
    sectionWhyTitle: "المنتج مبني على السرعة وجودة الإشارة والثقة.",
    sectionWhyBody:
      "أقوى ما يميز جينكا ليس التجميع فقط، بل الجمع بين الحداثة وإزالة التكرار وإظهار مخاطر الاحتيال بوضوح.",
    navSearch: "البحث",
    navAlerts: "التنبيهات",
    navFavorites: "المفضلة",
    navInbox: "الوارد",
    navAccount: "الحساب",
    units: "الوحدات",
    projects: "المشروعات",
    trust: "الثقة",
    howItWorks: "كيف يعمل",
    faq: "الأسئلة الشائعة",
    privacy: "الخصوصية",
    terms: "الشروط",
    admin: "الإدارة",
    filters: "الفلاتر",
    listMap: "القائمة / الخريطة",
    dedup: "معالجة التكرار",
    fraud: "وعي بالمخاطر",
    priceDrop: "انخفاض سعر",
    freshness: "حديث",
    sourceVariants: "نسخ المصدر",
    shortlist: "قائمة مختصرة",
    share: "مشاركة",
    accountTitle: "إعدادات الحساب والتنبيهات",
    alertsTitle: "التنبيهات المحفوظة",
    favoritesTitle: "العقارات المحفوظة",
    adminTitle: "لوحة العمليات",
    shortlistTitle: "قائمة مختصرة مشتركة",
    faqTitle: "الأسئلة الشائعة",
    trustTitle: "الثقة واكتشاف الاحتيال",
    howTitle: "كيف يعمل المجمّع",
    privacyTitle: "الخصوصية ونَسب المصدر",
    termsTitle: "الشروط وحدود التشغيل"
  }
} as const;

export function getMessages(locale: Locale) {
  return messages[locale];
}

export function resolveLocale(locale: string): Locale {
  return locale === "ar" ? "ar" : "en";
}
