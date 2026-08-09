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
import type { AdminHelpLevel, AdminHelpTopic } from "@/lib/adminHelp";
import { ADMIN_HELP_FAQ, ADMIN_HELP_QUICK_START } from "@/lib/adminHelp";
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

/** Maps an admin section href to its captured screenshot in /public/admin-help/screenshots. */
function screenshotForHref(href: string): string {
  const slug = href === "/admin" ? "dashboard" : href.replace(/^\/admin\//, "");
  return `/admin-help/screenshots/${slug}.png`;
}

type PreviewState = { src: string; alt: string; href: string } | null;

type TopicTab = "overview" | "steps" | "guidance" | "cautions";

const TOPIC_TABS: { id: TopicTab; label: string; icon: typeof LuBookOpen }[] = [
  { id: "overview", label: "Overview", icon: LuBookOpen },
  { id: "steps", label: "Steps", icon: LuListChecks },
  { id: "guidance", label: "Guidance", icon: LuLightbulb },
  { id: "cautions", label: "Cautions", icon: LuTriangleAlert },
];

export default function HelpCenterClient({ visibleTopics }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<AdminHelpTopic["category"] | "all">("all");
  const [level, setLevel] = useState<AdminHelpLevel | "all">("all");
  const [preview, setPreview] = useState<PreviewState>(null);
  const [mounted, setMounted] = useState(false);

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

  const titleByHref = useMemo(() => {
    const map = new Map<string, string>();
    visibleTopics.forEach((topic) => map.set(topic.href, topic.title));
    return map;
  }, [visibleTopics]);

  const filteredTopics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return visibleTopics.filter((topic) => {
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
        topic.category,
        topic.level,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [category, level, query, visibleTopics]);

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

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="admin-card overflow-hidden border border-slate-200">
        <div className="relative px-6 py-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-slate-100/70 blur-2xl" />
          <div className="relative max-w-3xl space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              A precise, role-aware guide to running the store
            </h1>
            <p className="text-sm leading-6 text-slate-500">
              Every guide explains the purpose of a section, the actions it supports, the exact steps to complete common tasks, and
              the cautions that prevent costly mistakes. Content is filtered by permission, so you only ever see guidance for the
              screens you can actually use.
            </p>
          </div>
        </div>
      </section>

      {/* Quick start */}
      <section className="admin-card p-6">
        <div className="flex items-center gap-2">
          <LuCompass size={18} className="text-slate-700" />
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Guided quick starts</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">Common end-to-end workflows, broken into safe, ordered steps.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ADMIN_HELP_QUICK_START.map((flow) => {
            const navMeta = ADMIN_NAVIGATION_META_BY_HREF.get(flow.href);
            const accessible = titleByHref.has(flow.href);
            return (
              <div key={flow.title} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <LuSparkles size={16} />
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900">{flow.title}</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{flow.description}</p>
                <ol className="mt-4 flex-1 space-y-2">
                  {flow.steps.map((step, index) => (
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
                    Go to {navMeta?.label ?? "section"} <LuArrowRight size={13} />
                  </Link>
                ) : (
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <LuLock size={12} /> Requires additional permission
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
            If a guide is missing here, that role does not currently have permission to access that section. Use the{" "}
            <Link href="/admin/roles" className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500">
              Roles &amp; Permissions
            </Link>{" "}
            screen to expand or narrow what each team can see and do.
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <section className="admin-card p-4 sm:p-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <label className="group relative block min-w-0 flex-1">
            <LuSearch size={16} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-slate-700" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: "3rem", paddingRight: query ? "2.25rem" : "0.875rem" }}
              className="admin-input !rounded-full border-slate-200 bg-white transition-colors duration-200 focus:border-slate-300"
              placeholder="Search guides"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Clear search"
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
              <option value="all">All levels</option>
              <option value="Core">Core</option>
              <option value="Advanced">Advanced</option>
              <option value="Sensitive">Sensitive</option>
            </select>
          </div>

          {hasFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
              aria-label="Reset filters"
              title="Reset filters"
            >
              <LuX size={16} />
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FilterPill active={category === "all"} onClick={() => setCategory("all")}>
            All categories
          </FilterPill>
          {CATEGORY_ORDER.map((item) => (
            <FilterPill key={item} active={category === item} onClick={() => setCategory(item)} dot={CATEGORY_META[item].dot}>
              {item}
            </FilterPill>
          ))}
        </div>

        <div className="mt-3 text-sm text-slate-500">
          Showing <span className="font-semibold text-slate-700">{filteredTopics.length}</span> of{" "}
          <span className="font-semibold text-slate-700">{visibleTopics.length}</span> visible guides.
        </div>
      </section>

      {/* Topics */}
      {filteredTopics.length === 0 ? (
        <section className="admin-card p-10 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <LuSearch size={22} />
          </div>
          <div className="text-lg font-semibold text-slate-800">No matching help topics</div>
          <div className="mt-2 text-sm text-slate-500">Try a broader search term, or clear the filters to see every guide.</div>
          {hasFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              <LuX size={14} /> Clear filters
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
                    <span>{meta.eyebrow}</span>
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{group.category}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{meta.description}</p>
                </div>

                <div className="space-y-4">
                  {group.items.map(({ topic, navMeta }) => (
                    <TopicCard key={topic.href} topic={topic} navMeta={navMeta} titleByHref={titleByHref} onPreview={setPreview} />
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
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Frequently asked questions</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">Quick answers to the questions operators ask most often.</p>
        <div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200">
          {ADMIN_HELP_FAQ.map((item, index) => (
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
              <h2 className="text-lg font-semibold tracking-tight">Still need a hand?</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-300">
                Pair this Help Center with the Roles &amp; Permissions screen to design a focused experience for each team, or reach
                your platform administrator for access changes.
              </p>
            </div>
          </div>
          <Link
            href="/admin/roles"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors duration-200 hover:bg-slate-100"
          >
            <LuShieldCheck size={16} /> Manage roles
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
                      <LuArrowRight size={13} /> Open section
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPreview(null)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                      aria-label="Close preview"
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
}: {
  topic: AdminHelpTopic;
  navMeta: ReturnType<typeof ADMIN_NAVIGATION_META_BY_HREF.get>;
  titleByHref: Map<string, string>;
  onPreview: (preview: PreviewState) => void;
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
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{topic.category}</span>
          </div>
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-slate-900">{topic.title}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{topic.summary}</p>
          </div>
          <Link
            href={topic.href}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
          >
            Open section <LuArrowRight size={14} />
          </Link>
        </div>

        {/* Live screenshot preview */}
        {imgOk ? (
          <button
            type="button"
            onClick={() => onPreview({ src: screenshot, alt: `${topic.title} screen`, href: topic.href })}
            className="group/preview relative w-full shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-left shadow-sm transition-shadow duration-200 hover:shadow-md lg:w-[360px]"
            title="Click to enlarge"
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
                alt={`${topic.title} screen preview`}
                loading="lazy"
                onError={() => setImgOk(false)}
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
              <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-slate-900/25 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover/preview:opacity-100">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  <LuMaximize2 size={12} /> Enlarge
                </span>
              </div>
            </div>
          </button>
        ) : (
          <div className="flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-xs text-slate-400 lg:w-[360px]">
            <LuImage size={16} /> Preview unavailable
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
                {tabItem.label}
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
              <LuLink size={13} /> Related sections
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
                      title="Requires additional permission"
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
