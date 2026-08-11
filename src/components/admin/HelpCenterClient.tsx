"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuArrowRight,
  LuBookOpen,
  LuChevronDown,
  LuCircleCheckBig,
  LuCompass,
  LuDownload,
  LuGlobe,
  LuImage,
  LuLifeBuoy,
  LuLightbulb,
  LuLink,
  LuListChecks,
  LuLock,
  LuMaximize2,
  LuMessageCircleQuestion,
  LuSearch,
  LuShieldCheck,
  LuSparkles,
  LuTriangleAlert,
  LuX,
} from "react-icons/lu";
import type { AdminHelpLang, AdminHelpLevel, AdminHelpTopic } from "@/lib/adminHelp";
import {
  ADMIN_HELP_ARABIC,
  ADMIN_HELP_ARABIC_STEPS,
  ADMIN_HELP_CATEGORY_ARABIC,
  ADMIN_HELP_FAQ,
  ADMIN_HELP_FAQ_ARABIC,
  ADMIN_HELP_LEVEL_ARABIC,
  ADMIN_HELP_QUICK_START,
  ADMIN_HELP_QUICK_START_ARABIC,
  ADMIN_HELP_UI,
} from "@/lib/adminHelp";
import { ADMIN_NAVIGATION_META_BY_HREF } from "@/lib/adminNavigationMeta";

type Props = {
  visibleTopics: AdminHelpTopic[];
  hiddenCount: number;
};

const CATEGORY_META: Record<AdminHelpTopic["category"], { eyebrow: string; description: string; dot: string; accent: string }> = {
  Operations: {
    eyebrow: "Execution",
    description: "Daily workflows for orders, payments, shipping, customers, and commercial operations.",
    dot: "bg-amber-400",
    accent: "text-amber-600",
  },
  Catalog: {
    eyebrow: "Merchandising",
    description: "Product structure, inventory accuracy, and review moderation that keep the storefront healthy.",
    dot: "bg-emerald-400",
    accent: "text-emerald-600",
  },
  Content: {
    eyebrow: "Experience",
    description: "Homepage, campaigns, messaging, and editorial surfaces that shape the storefront presentation.",
    dot: "bg-cyan-400",
    accent: "text-cyan-600",
  },
  Platform: {
    eyebrow: "Control",
    description: "Administrative controls, system rules, permissions, and platform-level configuration.",
    dot: "bg-slate-500",
    accent: "text-slate-600",
  },
};

const CATEGORY_ORDER: AdminHelpTopic["category"][] = ["Operations", "Catalog", "Content", "Platform"];

/** A topic with its text resolved to the active language (English fallback for any missing field). */
type LocalizedTopic = {
  href: string;
  category: AdminHelpTopic["category"];
  level: AdminHelpLevel;
  title: string;
  summary: string;
  outcomes: string[];
  guidance: string[];
  steps: string[];
  cautions: string[];
  tags: string[];
  related: string[];
};

function localizeTopic(topic: AdminHelpTopic, lang: AdminHelpLang): LocalizedTopic {
  if (lang === "en") {
    return {
      href: topic.href,
      category: topic.category,
      level: topic.level,
      title: topic.title,
      summary: topic.summary,
      outcomes: topic.outcomes,
      guidance: topic.guidance,
      steps: topic.steps,
      cautions: topic.cautions,
      tags: topic.tags,
      related: topic.related,
    };
  }
  const ar = ADMIN_HELP_ARABIC[topic.href];
  const arExtra = ADMIN_HELP_ARABIC_STEPS[topic.href];
  return {
    href: topic.href,
    category: topic.category,
    level: topic.level,
    title: ar?.title ?? topic.title,
    summary: ar?.summary ?? topic.summary,
    outcomes: ar?.outcomes ?? topic.outcomes,
    guidance: ar?.guidance ?? topic.guidance,
    steps: ar?.steps ?? arExtra?.steps ?? topic.steps,
    cautions: ar?.cautions ?? arExtra?.cautions ?? topic.cautions,
    tags: topic.tags,
    related: topic.related,
  };
}

function categoryLabel(category: AdminHelpTopic["category"], lang: AdminHelpLang): string {
  return lang === "ar" ? ADMIN_HELP_CATEGORY_ARABIC[category].label : category;
}

function categoryEyebrow(category: AdminHelpTopic["category"], lang: AdminHelpLang): string {
  return lang === "ar" ? ADMIN_HELP_CATEGORY_ARABIC[category].eyebrow : CATEGORY_META[category].eyebrow;
}

function categoryDescription(category: AdminHelpTopic["category"], lang: AdminHelpLang): string {
  return lang === "ar" ? ADMIN_HELP_CATEGORY_ARABIC[category].description : CATEGORY_META[category].description;
}

function levelLabel(level: AdminHelpLevel, lang: AdminHelpLang): string {
  return lang === "ar" ? ADMIN_HELP_LEVEL_ARABIC[level] : level;
}

/** Maps an admin section href to its captured screenshot in /public/admin-help/screenshots. */
function screenshotForHref(href: string): string {
  const slug = href === "/admin" ? "dashboard" : href.replace(/^\/admin\//, "");
  return `/admin-help/screenshots/${slug}.png`;
}

type PreviewState = { src: string; alt: string; href: string } | null;

type TopicTab = "overview" | "steps" | "guidance" | "cautions";

const TOPIC_TABS: { id: TopicTab; icon: typeof LuBookOpen }[] = [
  { id: "overview", icon: LuBookOpen },
  { id: "steps", icon: LuListChecks },
  { id: "guidance", icon: LuLightbulb },
  { id: "cautions", icon: LuTriangleAlert },
];

export default function HelpCenterClient({ visibleTopics }: Props) {
  const [lang, setLang] = useState<AdminHelpLang>("en");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<AdminHelpTopic["category"] | "all">("all");
  const [level, setLevel] = useState<AdminHelpLevel | "all">("all");
  const [preview, setPreview] = useState<PreviewState>(null);
  const [mounted, setMounted] = useState(false);

  const t = ADMIN_HELP_UI[lang];
  const isRtl = lang === "ar";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [preview]);

  // Localize all visible topics once per language change.
  const localizedTopics = useMemo(
    () => visibleTopics.map((topic) => localizeTopic(topic, lang)),
    [visibleTopics, lang],
  );

  const titleByHref = useMemo(() => {
    const map = new Map<string, string>();
    localizedTopics.forEach((topic) => map.set(topic.href, topic.title));
    return map;
  }, [localizedTopics]);

  const filteredTopics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return localizedTopics.filter((topic) => {
      if (category !== "all" && topic.category !== category) return false;
      if (level !== "all" && topic.level !== level) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        topic.title,
        topic.summary,
        topic.tags.join(" "),
        topic.outcomes.join(" "),
        topic.guidance.join(" "),
        topic.steps.join(" "),
        topic.cautions.join(" "),
        categoryLabel(topic.category, lang),
        levelLabel(topic.level, lang),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [category, level, query, localizedTopics, lang]);

  const topicsWithMeta = useMemo(
    () =>
      filteredTopics.map((topic) => ({
        topic,
        navMeta: ADMIN_NAVIGATION_META_BY_HREF.get(topic.href),
      })),
    [filteredTopics],
  );

  const groupedTopics = useMemo(
    () =>
      CATEGORY_ORDER.map((categoryItem) => ({
        category: categoryItem,
        items: topicsWithMeta.filter(({ topic }) => topic.category === categoryItem),
      })).filter((group) => group.items.length > 0),
    [topicsWithMeta],
  );

  const hasFilters = query.trim() !== "" || category !== "all" || level !== "all";

  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    setLevel("all");
  };

  const handleDownloadPdf = (pdfLang: AdminHelpLang) => {
    const html = buildHelpPrintHtml(pdfLang, visibleTopics);

    // Hidden same-origin iframe: no popups, no popup-blocker, reliable across
    // browsers. We write the document into it and drive the print dialog from
    // the parent once the iframe has finished loading.
    const prior = document.getElementById("help-pdf-frame");
    if (prior) prior.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "help-pdf-frame";
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.opacity = "0";
    document.body.appendChild(iframe);

    let printed = false;
    const triggerPrint = () => {
      if (printed) return;
      const win = iframe.contentWindow;
      if (!win) return;
      printed = true;
      try {
        win.focus();
        win.print();
      } catch {
        window.alert(t.popupBlocked);
      }
      // Remove the frame after the print dialog is dismissed.
      window.setTimeout(() => iframe.remove(), 1000);
    };

    iframe.onload = () => window.setTimeout(triggerPrint, 300);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();

    // Fallback in case `onload` never fires for a written-in document.
    window.setTimeout(triggerPrint, 800);
  };

  return (
    <div dir={t.dir} className="space-y-6">
      {/* Hero */}
      <section className="admin-card overflow-hidden border border-slate-200">
        <div className="relative px-6 py-8">
          <div className="pointer-events-none absolute -top-16 h-56 w-56 rounded-full bg-slate-100/70 blur-2xl ltr:-right-16 rtl:-left-16" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{t.heroTitle}</h1>
              <p className="text-sm leading-6 text-slate-500">{t.heroSubtitle}</p>
            </div>

            {/* Language switch + PDF export */}
            <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
              <div className="inline-flex items-center gap-1 self-start rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                <LuGlobe size={15} className="mx-1.5 text-slate-400" />
                <LangButton active={lang === "en"} onClick={() => setLang("en")}>
                  English
                </LangButton>
                <LangButton active={lang === "ar"} onClick={() => setLang("ar")}>
                  العربية
                </LangButton>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPdf("en")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900"
                >
                  <LuDownload size={14} /> {t.downloadEnPdf}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf("ar")}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
                >
                  <LuDownload size={14} /> {t.downloadArPdf}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick start */}
      <section className="admin-card p-6">
        <div className="flex items-center gap-2">
          <LuCompass size={18} className="text-slate-700" />
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">{t.quickStartTitle}</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">{t.quickStartSubtitle}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ADMIN_HELP_QUICK_START.map((flow) => {
            const arFlow = lang === "ar" ? ADMIN_HELP_QUICK_START_ARABIC[flow.href] : undefined;
            const flowTitle = arFlow?.title ?? flow.title;
            const flowDescription = arFlow?.description ?? flow.description;
            const flowSteps = arFlow?.steps ?? flow.steps;
            const navMeta = ADMIN_NAVIGATION_META_BY_HREF.get(flow.href);
            const accessible = titleByHref.has(flow.href);
            const sectionLabel = titleByHref.get(flow.href) ?? navMeta?.label ?? t.section;
            return (
              <div key={flow.href} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <LuSparkles size={16} />
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900">{flowTitle}</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{flowDescription}</p>
                <ol className="mt-4 flex-1 space-y-2">
                  {flowSteps.map((step, index) => (
                    <li key={step} className="flex gap-2.5 text-xs leading-5 text-slate-600">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                {accessible ? (
                  <Link
                    href={flow.href}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 transition-colors duration-200 hover:text-slate-950"
                  >
                    {t.goTo} {sectionLabel} <LuArrowRight size={13} className="rtl:rotate-180" />
                  </Link>
                ) : (
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <LuLock size={12} /> {t.requiresPermission}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Permission note */}
      <section className="admin-card p-6">
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
          <LuLock size={18} className="mt-0.5 shrink-0 text-slate-500" />
          <div>
            {t.permissionNotePrefix}{" "}
            <Link href="/admin/roles" className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500">
              {t.rolesLink}
            </Link>{" "}
            {t.permissionNoteSuffix}
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <section className="admin-card p-4 sm:p-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <label className="group relative block min-w-0 flex-1">
            <LuSearch size={16} className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-slate-700 ltr:left-5 rtl:right-5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={isRtl ? { paddingRight: "3rem", paddingLeft: query ? "2.25rem" : "0.875rem" } : { paddingLeft: "3rem", paddingRight: query ? "2.25rem" : "0.875rem" }}
              className="admin-input !rounded-full border-slate-200 bg-white transition-colors duration-200 focus:border-slate-300"
              placeholder={t.searchPlaceholder}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 ltr:right-2.5 rtl:left-2.5"
                aria-label={t.clearSearch}
              >
                <LuX size={14} />
              </button>
            ) : null}
          </label>

          <div className="w-28 shrink-0 sm:w-44">
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as AdminHelpLevel | "all")}
              className="admin-input admin-select w-full !rounded-full border-slate-200 bg-white transition-colors duration-200 focus:border-slate-300"
            >
              <option value="all">{t.allLevels}</option>
              <option value="Core">{levelLabel("Core", lang)}</option>
              <option value="Advanced">{levelLabel("Advanced", lang)}</option>
              <option value="Sensitive">{levelLabel("Sensitive", lang)}</option>
            </select>
          </div>

          {hasFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
              aria-label={t.resetFilters}
              title={t.resetFilters}
            >
              <LuX size={16} />
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FilterPill active={category === "all"} onClick={() => setCategory("all")}>
            {t.allCategories}
          </FilterPill>
          {CATEGORY_ORDER.map((item) => (
            <FilterPill key={item} active={category === item} onClick={() => setCategory(item)} dot={CATEGORY_META[item].dot}>
              {categoryLabel(item, lang)}
            </FilterPill>
          ))}
        </div>

        <div className="mt-3 text-sm text-slate-500">
          {t.showing} <span className="font-semibold text-slate-700">{filteredTopics.length}</span> {t.of}{" "}
          <span className="font-semibold text-slate-700">{visibleTopics.length}</span> {t.visibleGuides}
        </div>
      </section>

      {/* Topics */}
      {filteredTopics.length === 0 ? (
        <section className="admin-card p-10 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <LuSearch size={22} />
          </div>
          <div className="text-lg font-semibold text-slate-800">{t.noMatchTitle}</div>
          <div className="mt-2 text-sm text-slate-500">{t.noMatchBody}</div>
          {hasFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              <LuX size={14} /> {t.clearFilters}
            </button>
          ) : null}
        </section>
      ) : (
        <div className="space-y-10">
          {groupedTopics.map((group) => {
            const meta = CATEGORY_META[group.category];

            return (
              <section key={group.category} id={`category-${group.category}`} className="scroll-mt-24 space-y-4">
                <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-5">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    <span>{categoryEyebrow(group.category, lang)}</span>
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{categoryLabel(group.category, lang)}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{categoryDescription(group.category, lang)}</p>
                </div>

                <div className="space-y-4">
                  {group.items.map(({ topic, navMeta }) => (
                    <TopicCard
                      key={topic.href}
                      topic={topic}
                      navMeta={navMeta}
                      titleByHref={titleByHref}
                      onPreview={setPreview}
                      t={t}
                      lang={lang}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* FAQ */}
      <section className="admin-card p-6">
        <div className="flex items-center gap-2">
          <LuMessageCircleQuestion size={18} className="text-slate-700" />
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">{t.faqTitle}</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">{t.faqSubtitle}</p>
        <div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200">
          {(lang === "ar" ? ADMIN_HELP_FAQ_ARABIC : ADMIN_HELP_FAQ).map((item, index) => (
            <FaqRow key={item.question} item={item} defaultOpen={index === 0} />
          ))}
        </div>
      </section>

      {/* Support footer */}
      <section className="admin-card overflow-hidden border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 px-6 py-6 text-white">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
              <LuLifeBuoy size={20} />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{t.supportTitle}</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-300">{t.supportBody}</p>
            </div>
          </div>
          <Link
            href="/admin/roles"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors duration-200 hover:bg-slate-100"
          >
            <LuShieldCheck size={16} /> {t.manageRoles}
          </Link>
        </div>
      </section>

      {/* Screenshot lightbox (portaled to body to escape the admin scroll container) */}
      {mounted && preview
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={preview.alt}
              onClick={() => setPreview(null)}
              className="help-lightbox-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md sm:p-6"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="help-lightbox-panel flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
              >
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3 text-white">
                    <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{preview.alt}</div>
                      <div className="truncate text-xs text-slate-400">{preview.href}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={preview.href}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
                    >
                      <LuArrowRight size={13} className="rtl:rotate-180" /> {t.openSection}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPreview(null)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                      aria-label={t.clearSearch}
                    >
                      <LuX size={18} />
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-auto bg-slate-950/40 p-3 sm:p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.src} alt={preview.alt} className="mx-auto h-auto w-full rounded-lg" />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function LangButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 ${
        active ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
      }`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function FilterPill({
  active,
  onClick,
  children,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
      }`}
    >
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : dot}`} /> : null}
      {children}
    </button>
  );
}

function TopicCard({
  topic,
  navMeta,
  titleByHref,
  onPreview,
  t,
  lang,
}: {
  topic: LocalizedTopic;
  navMeta: ReturnType<typeof ADMIN_NAVIGATION_META_BY_HREF.get>;
  titleByHref: Map<string, string>;
  onPreview: (preview: PreviewState) => void;
  t: (typeof ADMIN_HELP_UI)[AdminHelpLang];
  lang: AdminHelpLang;
}) {
  const [tab, setTab] = useState<TopicTab>("overview");
  const [imgOk, setImgOk] = useState(true);
  const TopicIcon = navMeta?.icon;
  const screenshot = screenshotForHref(topic.href);

  return (
    <article className="admin-card group border border-slate-200 p-6 transition-colors duration-200 hover:border-slate-300">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {TopicIcon ? (
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 transition-colors duration-200 group-hover:bg-white">
                <TopicIcon size={19} className={navMeta?.color ?? "text-slate-500"} />
              </span>
            ) : null}
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{categoryLabel(topic.category, lang)}</span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              {levelLabel(topic.level, lang)}
            </span>
          </div>
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-slate-900">{topic.title}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{topic.summary}</p>
          </div>
          <Link
            href={topic.href}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
          >
            {t.openSection} <LuArrowRight size={14} className="rtl:rotate-180" />
          </Link>
        </div>

        {/* Live screenshot preview */}
        {imgOk ? (
          <button
            type="button"
            onClick={() => onPreview({ src: screenshot, alt: `${topic.title}`, href: topic.href })}
            className="group/preview relative w-full shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-left shadow-sm transition-shadow duration-200 hover:shadow-md lg:w-[360px]"
            title={t.enlarge}
          >
            <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              <span className="ml-2 truncate text-[11px] text-slate-400">{topic.href}</span>
            </div>
            <div className="relative aspect-[16/10] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshot}
                alt={topic.title}
                loading="lazy"
                onError={() => setImgOk(false)}
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
              <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-slate-900/25 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover/preview:opacity-100">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  <LuMaximize2 size={12} /> {t.enlarge}
                </span>
              </div>
            </div>
          </button>
        ) : (
          <div className="flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-xs text-slate-400 lg:w-[360px]">
            <LuImage size={16} /> {t.previewUnavailable}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-6 border-t border-slate-100 pt-5">
        <div className="flex flex-wrap gap-1.5">
          {TOPIC_TABS.map((tabItem) => {
            const TabIcon = tabItem.icon;
            const isActive = tab === tabItem.id;
            const count =
              tabItem.id === "steps"
                ? topic.steps.length
                : tabItem.id === "guidance"
                  ? topic.guidance.length
                  : tabItem.id === "cautions"
                    ? topic.cautions.length
                    : topic.outcomes.length;
            return (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => setTab(tabItem.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
                  isActive ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <TabIcon size={14} />
                {t.tabs[tabItem.id]}
                <span className={`text-[11px] font-semibold ${isActive ? "text-white/70" : "text-slate-400"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          {tab === "overview" ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {topic.outcomes.map((outcome) => (
                <li key={outcome} className="flex gap-3 text-sm text-slate-700">
                  <LuCircleCheckBig size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === "steps" ? (
            <ol className="space-y-3">
              {topic.steps.map((step, stepIndex) => (
                <li key={step} className="flex gap-3 text-sm text-slate-700">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                    {stepIndex + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          ) : null}

          {tab === "guidance" ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {topic.guidance.map((item) => (
                <li key={item} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <LuLightbulb size={16} className="mt-0.5 shrink-0 text-amber-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === "cautions" ? (
            <ul className="space-y-3">
              {topic.cautions.map((item) => (
                <li key={item} className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
                  <LuTriangleAlert size={16} className="mt-0.5 shrink-0 text-amber-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Related sections */}
        {topic.related.length > 0 ? (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <LuLink size={13} /> {t.relatedSections}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {topic.related.map((relatedHref) => {
                const relatedTitle = titleByHref.get(relatedHref);
                const relatedMeta = ADMIN_NAVIGATION_META_BY_HREF.get(relatedHref);
                const label = relatedTitle ?? relatedMeta?.label;
                if (!label) return null;
                const RelatedIcon = relatedMeta?.icon;
                const accessible = titleByHref.has(relatedHref);

                if (!accessible) {
                  return (
                    <span
                      key={relatedHref}
                      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-400"
                      title={t.requiresPermission}
                    >
                      <LuLock size={12} /> {label}
                    </span>
                  );
                }

                return (
                  <Link
                    key={relatedHref}
                    href={relatedHref}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                  >
                    {RelatedIcon ? <RelatedIcon size={13} className={relatedMeta?.color ?? "text-slate-500"} /> : null}
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function FaqRow({ item, defaultOpen }: { item: { question: string; answer: string }; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div className="first:rounded-t-2xl last:rounded-b-2xl">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-800">{item.question}</span>
        <LuChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <div className="px-5 pb-5 text-sm leading-6 text-slate-600">{item.answer}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Printable / PDF document builder                                            */
/* -------------------------------------------------------------------------- */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function listItems(items: string[]): string {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

/**
 * Builds a fully self-contained, print-ready HTML document for the given language.
 * The browser renders Arabic natively (correct shaping + RTL), and "Save as PDF"
 * in the print dialog yields a complete PDF export.
 */
function buildHelpPrintHtml(lang: AdminHelpLang, topics: AdminHelpTopic[]): string {
  const t = ADMIN_HELP_UI[lang];
  const isRtl = lang === "ar";
  const dir = isRtl ? "rtl" : "ltr";
  const locale = isRtl ? "ar" : "en-GB";
  const dateStr = new Date().toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });

  const localized = topics.map((topic) => localizeTopic(topic, lang));

  const quickStartCards = ADMIN_HELP_QUICK_START.map((flow) => {
    const ar = lang === "ar" ? ADMIN_HELP_QUICK_START_ARABIC[flow.href] : undefined;
    const title = ar?.title ?? flow.title;
    const description = ar?.description ?? flow.description;
    const steps = ar?.steps ?? flow.steps;
    return `
      <div class="qs-card">
        <h3>${escapeHtml(title)}</h3>
        <p class="muted">${escapeHtml(description)}</p>
        <ol>${listItems(steps)}</ol>
      </div>`;
  }).join("");

  const groups = CATEGORY_ORDER.map((category) => {
    const items = localized.filter((topic) => topic.category === category);
    if (items.length === 0) return "";
    const cards = items
      .map(
        (topic) => `
      <article class="topic">
        <div class="topic-head">
          <div>
            <span class="badge">${escapeHtml(categoryLabel(topic.category, lang))} · ${escapeHtml(levelLabel(topic.level, lang))}</span>
            <h3>${escapeHtml(topic.title)}</h3>
          </div>
          <span class="href">${escapeHtml(topic.href)}</span>
        </div>
        <p class="summary">${escapeHtml(topic.summary)}</p>
        <div class="cols">
          <section>
            <h4>${escapeHtml(t.tabs.overview)}</h4>
            <ul class="check">${listItems(topic.outcomes)}</ul>
          </section>
          <section>
            <h4>${escapeHtml(t.tabs.steps)}</h4>
            <ol>${listItems(topic.steps)}</ol>
          </section>
          <section>
            <h4>${escapeHtml(t.tabs.guidance)}</h4>
            <ul class="dot">${listItems(topic.guidance)}</ul>
          </section>
          <section>
            <h4 class="warn">${escapeHtml(t.tabs.cautions)}</h4>
            <ul class="warn-list">${listItems(topic.cautions)}</ul>
          </section>
        </div>
      </article>`,
      )
      .join("");

    return `
      <section class="cat">
        <div class="cat-head">
          <div class="eyebrow">${escapeHtml(categoryEyebrow(category, lang))}</div>
          <h2>${escapeHtml(categoryLabel(category, lang))}</h2>
          <p class="muted">${escapeHtml(categoryDescription(category, lang))}</p>
        </div>
        ${cards}
      </section>`;
  }).join("");

  const faqSource = lang === "ar" ? ADMIN_HELP_FAQ_ARABIC : ADMIN_HELP_FAQ;
  const faq = faqSource
    .map(
      (item) => `
      <div class="faq">
        <div class="q">${escapeHtml(item.question)}</div>
        <div class="a">${escapeHtml(item.answer)}</div>
      </div>`,
    )
    .join("");

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(t.documentTitle)}</title>
<style>
  :root { --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --soft:#f8fafc; --warn:#b45309; --warnbg:#fffbeb; --warnline:#fde68a; --accent:#0f172a; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; }
  body {
    font-family: ${isRtl ? '"Segoe UI", "Tahoma", "Arial", sans-serif' : '"Segoe UI", "Helvetica Neue", Arial, sans-serif'};
    color: var(--ink); background:#fff; line-height:1.6; font-size:13px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .wrap { max-width: 900px; margin: 0 auto; padding: 32px 28px 48px; }
  .cover { border-bottom: 3px solid var(--ink); padding-bottom: 20px; margin-bottom: 28px; }
  .cover .kicker { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
  .cover h1 { font-size: 26px; margin: 8px 0 10px; line-height: 1.25; }
  .cover p { color: var(--muted); margin: 0; max-width: 60ch; }
  .cover .meta { margin-top: 14px; font-size: 12px; color: var(--muted); }
  h2 { font-size: 19px; margin: 0 0 4px; }
  h3 { font-size: 15px; margin: 4px 0; }
  h4 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin: 0 0 6px; }
  h4.warn { color: var(--warn); }
  .muted { color: var(--muted); }
  .block-title { display:flex; align-items:center; gap:8px; font-size: 16px; font-weight: 700; margin: 30px 0 12px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
  .qs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .qs-card { border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; background: var(--soft); break-inside: avoid; }
  .qs-card h3 { margin: 0 0 4px; }
  .qs-card ol { margin: 8px 0 0; padding-inline-start: 18px; }
  .qs-card li { margin: 3px 0; }
  .cat { margin-top: 26px; }
  .cat-head { background: var(--ink); color: #fff; border-radius: 14px; padding: 14px 18px; margin-bottom: 14px; }
  .cat-head .eyebrow { font-size: 10px; letter-spacing: .2em; text-transform: uppercase; opacity: .7; font-weight: 700; }
  .cat-head h2 { color:#fff; margin: 4px 0 4px; }
  .cat-head p { color: #cbd5e1; margin: 0; font-size: 12px; }
  .topic { border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; margin-bottom: 14px; break-inside: avoid; }
  .topic-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .topic-head h3 { margin: 4px 0 0; font-size: 16px; }
  .badge { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); background: var(--soft); border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; }
  .href { font-size: 11px; color: var(--muted); font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; white-space: nowrap; }
  .summary { margin: 8px 0 12px; color: #334155; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 22px; }
  .cols section { break-inside: avoid; }
  ul, ol { margin: 0; padding-inline-start: 18px; }
  li { margin: 3px 0; }
  ul.check { list-style: none; padding-inline-start: 0; }
  ul.check li { position: relative; padding-inline-start: 18px; }
  ul.check li::before { content: "✓"; position: absolute; inset-inline-start: 0; color: #059669; font-weight: 700; }
  ul.dot li::marker { color: #d97706; }
  .warn-list { list-style: none; padding-inline-start: 0; }
  .warn-list li { position: relative; padding: 6px 10px 6px 26px; background: var(--warnbg); border: 1px solid var(--warnline); border-radius: 8px; margin: 5px 0; color: #92400e; }
  .warn-list li { padding-inline-start: 26px; padding-inline-end: 10px; }
  .warn-list li::before { content: "!"; position: absolute; inset-inline-start: 9px; top: 6px; color: var(--warn); font-weight: 800; }
  .faq { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin: 8px 0; break-inside: avoid; }
  .faq .q { font-weight: 700; }
  .faq .a { color: var(--muted); margin-top: 4px; }
  .footer { margin-top: 34px; padding-top: 14px; border-top: 1px solid var(--line); font-size: 11px; color: var(--muted); display:flex; justify-content: space-between; }
  @page { margin: 14mm; }
  @media print {
    .wrap { padding: 0; max-width: none; }
    .topic, .qs-card, .faq, .cat-head { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header class="cover">
      <div class="kicker">${escapeHtml(t.documentTitle)}</div>
      <h1>${escapeHtml(t.heroTitle)}</h1>
      <p>${escapeHtml(t.heroSubtitle)}</p>
      <div class="meta">${escapeHtml(t.printGenerated)} — ${escapeHtml(dateStr)}</div>
    </header>

    <div class="block-title">${escapeHtml(t.quickStartTitle)}</div>
    <div class="qs-grid">${quickStartCards}</div>

    ${groups}

    <div class="block-title">${escapeHtml(t.faqTitle)}</div>
    ${faq}

    <div class="footer">
      <span>${escapeHtml(t.documentTitle)}</span>
      <span>${escapeHtml(dateStr)}</span>
    </div>
  </div>
</body>
</html>`;
}
