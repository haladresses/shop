"use client";
import { useCallback, useEffect, useState } from "react";

// Dashboard shortcuts for the signed-in staff member: the header star adds
// or removes the current page, the Dashboard shows them as tiles.
//
// One shared copy keeps the star and the Dashboard in sync instantly. It is
// dropped as soon as nothing on screen uses it (signing out always leaves the
// admin), so the next person to sign in on this browser starts fresh.
// Until the list has loaded, `ready` stays false and nothing can be changed,
// so a failed load can never overwrite someone's saved shortcuts.

export type Shortcut = { href: string; label: string };

let cache: Shortcut[] | null = null;
let loading: Promise<Shortcut[] | null> | null = null;
let generation = 0;
const listeners = new Set<(s: Shortcut[]) => void>();

function load(): Promise<Shortcut[] | null> {
  if (cache) return Promise.resolve(cache);
  if (!loading) {
    const gen = generation;
    loading = fetch("/api/admin/shortcuts", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d?.success && Array.isArray(d.data) ? (d.data as Shortcut[]) : null))
      .catch(() => null)
      .then((list) => {
        if (gen !== generation) return null; // everyone left (signed out) meanwhile
        loading = null; // a failure can be retried by the next page
        if (list) cache = list;
        return list;
      });
  }
  return loading;
}

function publish(next: Shortcut[]) {
  cache = next;
  listeners.forEach((l) => l(next));
}

async function save(next: Shortcut[]): Promise<boolean> {
  const previous = cache;
  if (!previous) return false; // not loaded yet
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
    const onChange = (s: Shortcut[]) => {
      setItems(s);
      setReady(true);
    };
    listeners.add(onChange);
    load().then((s) => {
      if (alive && s) onChange(s);
    });
    return () => {
      alive = false;
      listeners.delete(onChange);
      if (listeners.size === 0) {
        cache = null;
        loading = null;
        generation++;
      }
    };
  }, []);

  const isPinned = useCallback((href: string) => items.some((i) => i.href === href), [items]);

  const toggle = useCallback((s: Shortcut) => {
    const list = cache ?? [];
    return save(list.some((i) => i.href === s.href) ? list.filter((i) => i.href !== s.href) : [...list, s]);
  }, []);

  const remove = useCallback((href: string) => save((cache ?? []).filter((i) => i.href !== href)), []);

  return { items, ready, isPinned, toggle, remove };
}
