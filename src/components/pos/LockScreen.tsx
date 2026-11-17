"use client";
import { useEffect, useRef, useState } from "react";
import { LuDelete, LuLoaderCircle, LuLock, LuLockOpen, LuUsers } from "react-icons/lu";
import { PadKey, beep } from "./PosUi";

export type LockUser = { nameEn: string; nameAr: string; avatar: string | null; usePin: boolean };

const PIN_LENGTH = 4;
/** Keys closer together than this come from the barcode scanner, not a person. */
const SCANNER_GAP_MS = 35;

/**
 * Full-screen POS lock. It covers everything (the sale behind it is kept)
 * until the signed-in cashier enters their PIN, or their password if they
 * have no PIN. "Switch user" signs them out so someone else can sign in.
 */
export default function LockScreen({
  user,
  fallbackName,
  onUnlocked,
  onSwitchUser,
}: {
  /** Null until the server answers: a PIN pad is shown meanwhile. */
  user: LockUser | null;
  fallbackName: string;
  onUnlocked: (user: LockUser) => void;
  onSwitchUser: () => void;
}) {
  const usePin = user?.usePin ?? true;
  const name = (user && (user.nameEn || user.nameAr)) || fallbackName;
  const [value, setValue] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const lastKeyAt = useRef(0);
  const scanUntil = useRef(0);

  // Pull focus off the sale behind (the scan box) so nothing types into it.
  useEffect(() => {
    if (usePin) rootRef.current?.focus();
    else passwordRef.current?.focus();
  }, [usePin]);

  const submit = async (secret: string) => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/pos/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock", secret }),
      });
      // Signed out meanwhile (session expired or ended from the admin panel).
      if (res.status === 401) return onSwitchUser();
      const d = await res.json();
      if (!d.success) {
        setErr(d.error || (usePin ? "Incorrect PIN." : "Incorrect password."));
        setValue("");
        beep("error");
        return;
      }
      onUnlocked(d.data.user);
    } catch {
      setErr("Something went wrong. Try again.");
      setValue("");
    } finally {
      setBusy(false);
    }
  };

  const press = (d: string) => {
    if (busy || value.length >= PIN_LENGTH) return;
    const next = value + d;
    setValue(next);
    if (next.length === PIN_LENGTH) submit(next);
  };

  // Physical keyboard on the PIN pad.
  useEffect(() => {
    if (!usePin) return;
    const onKey = (e: KeyboardEvent) => {
      const now = Date.now();
      const gap = now - lastKeyAt.current;
      lastKeyAt.current = now;
      // A barcode scan types a whole code in one burst. Ignore it, so scanning
      // an item on a locked till doesn't count as wrong PIN attempts.
      if (gap < SCANNER_GAP_MS || now < scanUntil.current) {
        scanUntil.current = now + 150;
        setValue("");
        return;
      }
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setValue((v) => v.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Screen locked"
      className="fixed inset-0 z-[200] overflow-y-auto bg-[#F7F2EE] outline-none print:hidden"
    >
      <div className="min-h-full flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 w-full max-w-[360px] flex flex-col items-center">
          <div className="relative mb-3">
            <div className="w-20 h-20 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center overflow-hidden ring-4 ring-white shadow">
              {user?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-semibold">{(name || "?").charAt(0).toUpperCase()}</span>
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center ring-4 ring-white">
              <LuLock size={14} />
            </span>
          </div>
          <h2 className="text-xl font-semibold text-slate-800">{name || "Screen locked"}</h2>
          <p className="text-slate-500 mb-6 text-center">
            Screen locked. Enter your {usePin ? "PIN" : "password"} to continue.
          </p>

          {usePin ? (
            <>
              <div className="flex gap-3 mb-4">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <span key={i} className={`w-4 h-4 rounded-full border-2 ${i < value.length ? "bg-rose-500 border-rose-500" : "border-slate-300"}`} />
                ))}
              </div>
              <div className="h-6 mb-2 text-sm text-center">
                {err ? <span className="text-rose-600">{err}</span> : busy ? <LuLoaderCircle size={18} className="animate-spin text-slate-400" /> : null}
              </div>
              <div className="grid grid-cols-3 gap-3 w-full">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <PadKey key={d} onClick={() => press(d)} disabled={busy}>{d}</PadKey>
                ))}
                <span />
                <PadKey onClick={() => press("0")} disabled={busy}>0</PadKey>
                <button
                  onClick={() => setValue((v) => v.slice(0, -1))}
                  disabled={busy}
                  className="h-16 rounded-2xl text-slate-500 hover:bg-slate-100 flex items-center justify-center disabled:opacity-40"
                  aria-label="Backspace"
                >
                  <LuDelete size={22} />
                </button>
              </div>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (value && !busy) submit(value);
              }}
              className="w-full"
            >
              <input
                ref={passwordRef}
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="current-password"
                placeholder="Password"
                aria-label="Password"
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
              {err && <p className="text-rose-600 text-sm mt-2">{err}</p>}
              <button
                type="submit"
                disabled={busy || !value}
                className="mt-3 w-full py-3.5 rounded-2xl bg-rose-500 text-white font-semibold hover:bg-rose-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? <LuLoaderCircle size={18} className="animate-spin" /> : <LuLockOpen size={18} />} Unlock
              </button>
              <p className="text-xs text-slate-400 mt-4 text-center">
                Tip: set a 4-digit POS PIN for your account under Users to unlock faster.
              </p>
            </form>
          )}
        </div>

        <button
          onClick={onSwitchUser}
          className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white px-4 py-2 rounded-xl"
        >
          <LuUsers size={16} /> Switch user
        </button>
      </div>
    </div>
  );
}
