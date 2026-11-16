"use client";
import { useCallback, useEffect, useState } from "react";

// Dashboard shortcuts for the signed-in staff member: the header star adds
// or removes the current page, the Dashboard shows them as tiles. One shared
// in-memory copy keeps the star and the Dashboard in sync instantly.

export type Shortcut = { href: string; label: string };

let cache: Shortcut[] | null = null;
let loading: Promise<Shortcut[]> | null = null;
const listeners = new Set<(s: Shortcut[]) => void>();

function load(): Promise<Shortcut[]> {
  if (cache) return Promise.resolve(cache);
  if (!loading) {
    loading = fetch("/api/admin/shortcuts", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (cache = d.success ? (d.data as Shortcut[]) : []))
      .catch(() => (cache = []));
  }
  return loading;
}

function publish(next: Shortcut[]) {
  cache = next;
  listeners.forEach((l) => l(next));
}

async function save(next: Shortcut[], previous: Shortcut[]): Promise<boolean> {
  publish(next);
  const d = await fetch("/api/admin/shortcuts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  })
    .then((r) => r.json())
    .catch(() => null);
  if (!d?.success) {
    publish(previous); // put it back as it was
    return false;
  }
  return true;
}

export function useShortcuts() {
  const [items, setItems] = useState<Shortcut[]>(cache ?? []);
  const [ready, setReady] = useState(cache !== null);

  useEffect(() => {
    let alive = true;
    load().then((s) => {
      if (!alive) return;
      setItems(s);
      setReady(true);
    });
    const onChange = (s: Shortcut[]) => setItems(s);
    listeners.add(onChange);
    return () => {
      alive = false;
      listeners.delete(onChange);
    };
  }, []);

  const isPinned = useCallback((href: string) => items.some((i) => i.href === href), [items]);

  const toggle = useCallback(
    (s: Shortcut) => {
      const prev = cache ?? items;
      const next = prev.some((i) => i.href === s.href) ? prev.filter((i) => i.href !== s.href) : [...prev, s];
      return save(next, prev);
    },
    [items],
  );

  const remove = useCallback(
    (href: string) => {
      const prev = cache ?? items;
      return save(prev.filter((i) => i.href !== href), prev);
    },
    [items],
  );

  return { items, ready, isPinned, toggle, remove };
}
