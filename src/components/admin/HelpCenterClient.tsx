"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LuArrowRight, LuBookOpen, LuCircleCheckBig, LuLock, LuSearch } from "react-icons/lu";
import type { AdminHelpTopic } from "@/lib/adminHelp";
import { ADMIN_NAVIGATION_META_BY_HREF } from "@/lib/adminNavigationMeta";

type Props = {
  visibleTopics: AdminHelpTopic[];
  hiddenCount: number;
};

export default function HelpCenterClient({ visibleTopics, hiddenCount }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const filteredTopics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return visibleTopics.filter((topic) => {
      if (category !== "all" && topic.category !== category) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        topic.title,
        topic.summary,
        topic.outcomes.join(" "),
        topic.guidance.join(" "),
        topic.category,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [category, query, visibleTopics]);

  const categorySummary = ["Operations", "Catalog", "Content", "Platform"].map((item) => ({
    category: item,
    count: visibleTopics.filter((topic) => topic.category === item).length,
  }));

  const topicsWithMeta = useMemo(
    () =>
      filteredTopics.map((topic) => ({
        topic,
        navMeta: ADMIN_NAVIGATION_META_BY_HREF.get(topic.href),
      })),
    [filteredTopics],
  );

  return (
    <div className="space-y-6">
      <section className="admin-card overflow-hidden">
        <div className="bg-slate-950 px-6 py-8 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">
                <LuBookOpen size={14} /> Admin Help Center
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Professional guidance for the sections this role can access</h1>
              <p className="text-sm leading-6 text-slate-300">
                Each guide explains the purpose of a section, the actions it supports, and the operating patterns your team should follow.
                Content is filtered by permission, so the help center stays relevant and controlled.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-slate-300">Visible Guides</div>
                <div className="mt-1 text-2xl font-semibold">{visibleTopics.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-slate-300">Restricted Guides</div>
                <div className="mt-1 text-2xl font-semibold">{hiddenCount}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 border-t border-slate-200 bg-white px-6 py-5 md:grid-cols-4">
          {categorySummary.map((item) => (
            <div key={item.category} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{item.category}</div>
              <div className="mt-2 text-2xl font-semibold text-slate-800">{item.count}</div>
              <div className="mt-1 text-sm text-slate-500">available guides</div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card p-6">
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
          <LuLock size={18} className="mt-0.5 shrink-0" />
          <div>
            If a guide is missing here, that role does not currently have permission to access that section.
            Use the Roles screen to expand or narrow what each team can see and do.
          </div>
        </div>
      </section>

      <section className="admin-card p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <label className="relative block">
            <LuSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="admin-input pl-10"
              placeholder="Search help by section, workflow, or keyword"
            />
          </label>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="admin-input admin-select"
          >
            <option value="all">All Categories</option>
            <option value="Operations">Operations</option>
            <option value="Catalog">Catalog</option>
            <option value="Content">Content</option>
            <option value="Platform">Platform</option>
          </select>
        </div>

        <div className="mt-4 text-sm text-slate-500">
          Showing <span className="font-semibold text-slate-700">{filteredTopics.length}</span> of <span className="font-semibold text-slate-700">{visibleTopics.length}</span> visible guides.
        </div>
      </section>

      {filteredTopics.length === 0 ? (
        <section className="admin-card p-10 text-center">
          <div className="text-lg font-semibold text-slate-800">No matching help topics</div>
          <div className="mt-2 text-sm text-slate-500">Try a broader search term or switch the category filter back to all.</div>
        </section>
      ) : (
        <div className="space-y-4">
          {topicsWithMeta.map(({ topic, navMeta }, index) => {
            const TopicIcon = navMeta?.icon;

            return (
            <article key={topic.href} className="admin-card border border-slate-200 p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-slate-900 px-2 text-xs font-semibold text-white">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {TopicIcon ? (
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)] ring-1 ring-slate-950/5">
                        <TopicIcon size={19} className={navMeta?.color ?? "text-slate-500"} />
                      </span>
                    ) : null}
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{topic.category}</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-slate-900">{topic.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{topic.summary}</p>
                  </div>
                </div>

                <div className="shrink-0">
                  <Link href={topic.href} className="admin-btn admin-btn-secondary whitespace-nowrap">
                    Open Section <LuArrowRight size={14} />
                  </Link>
                </div>
              </div>

              <div className="mt-6 grid gap-6 border-t border-slate-100 pt-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">What You Can Do</h3>
                  <ul className="mt-4 space-y-3 text-sm text-slate-700">
                    {topic.outcomes.map((outcome) => (
                      <li key={outcome} className="flex gap-3">
                        <LuCircleCheckBig size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                        <span>{outcome}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Professional Guidance</h3>
                  <ul className="mt-4 space-y-3 text-sm text-slate-700">
                    {topic.guidance.map((item) => (
                      <li key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          )})}
        </div>
      )}
    </div>
  );
}