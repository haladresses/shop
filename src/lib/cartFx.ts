"use client";

// "Add to cart" / "Add to wishlist" micro-interactions.
//
// The product photo lifts off the card and flies in an arc into the header
// cart (or a heart flies into the wishlist icon); on arrival the icon bounces
// and sparkles, and the counter badge pops (badge pop lives in the Header).
// Everything is plain DOM + Web Animations — no re-render, no layout thrash —
// and it degrades to a simple pulse for reduced-motion users.

type FxKind = "cart" | "wishlist";

const HEART_SVG = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.4 2.8 4.5 6.6 4.5c2.2 0 3.6 1.2 4.4 2.4.8-1.2 2.2-2.4 4.4-2.4 3.8 0 5.7 3.9 4.2 7.2C19.5 16.4 12 21 12 21z"/></svg>`;
const BRAND = "#8C3B49";
const PALETTE = ["#8C3B49", "#E7A1AE", "#F5C77E", "#C25B6E", "#FFFFFF"];

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function visibleTarget(kind: FxKind): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-fx-target="${kind}"]`));
  return (
    els.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
    }) ?? null
  );
}

function layer(): HTMLElement {
  let el = document.getElementById("fx-layer");
  if (!el) {
    el = document.createElement("div");
    el.id = "fx-layer";
    el.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:100000;overflow:hidden";
    document.body.appendChild(el);
  }
  return el;
}

/** Find the photo of the product card the click came from. */
function sourceImage(from: Element | null): HTMLImageElement | null {
  if (!from) return null;
  const card = from.closest("[data-fx-card]") ?? from.closest("article, li, .group");
  return (card?.querySelector("img") as HTMLImageElement | null) ?? null;
}

function bounce(el: HTMLElement) {
  el.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.28) rotate(-8deg)", offset: 0.3 },
      { transform: "scale(0.92) rotate(4deg)", offset: 0.6 },
      { transform: "scale(1.06)", offset: 0.8 },
      { transform: "scale(1)" },
    ],
    { duration: 650, easing: "cubic-bezier(.3,.7,.4,1)" },
  );
}

/** Radial burst of tiny hearts and dots from the centre of `el`. */
export function burst(el: Element | null, opts: { hearts?: boolean; count?: number; spread?: number } = {}) {
  if (!el || typeof window === "undefined" || reducedMotion()) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const root = layer();
  const count = opts.count ?? 12;
  const spread = opts.spread ?? 46;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    const heart = opts.hearts && i % 2 === 0;
    const size = heart ? 9 + Math.random() * 6 : 4 + Math.random() * 4;
    const color = PALETTE[i % PALETTE.length];
    p.style.cssText = `position:absolute;left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px;color:${color};${
      heart ? "" : `border-radius:50%;background:${color};box-shadow:0 0 6px ${color}`
    }`;
    if (heart) p.innerHTML = HEART_SVG;
    root.appendChild(p);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = spread * (0.6 + Math.random() * 0.6);
    const dx = Math.cos(angle) * dist;
    let dy = Math.sin(angle) * dist - 10;
    // Near the top edge, spray downward so particles stay on screen.
    if (cy + dy - size < 4) dy = Math.abs(dy) * 0.8 + 6;
    p.animate(
      [
        { transform: "translate(0,0) scale(0.3)", opacity: 1 },
        { transform: `translate(${dx * 0.7}px,${dy * 0.7}px) scale(1.15)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px,${dy + 14}px) scale(0.5) rotate(${Math.random() * 90 - 45}deg)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 250, easing: "cubic-bezier(.2,.7,.3,1)" },
    ).onfinish = () => p.remove();
  }
}

/**
 * Fly a ghost of the product (or a heart) from `from` into the header icon.
 * `from` is the clicked button or any element inside the product card.
 */
export function flyTo(kind: FxKind, from: Element | null, imageUrl?: string | null) {
  if (typeof window === "undefined") return;
  const target = visibleTarget(kind);
  navigator.vibrate?.(10);

  if (kind === "wishlist") burst(from, { hearts: true });
  if (!target) return;
  if (reducedMotion() || !from) {
    bounce(target);
    return;
  }

  const img = kind === "cart" ? sourceImage(from) : null;
  const srcRect = (img ?? from).getBoundingClientRect();
  const tRect = target.getBoundingClientRect();

  const size = kind === "cart" ? Math.min(140, Math.max(64, Math.min(srcRect.width, srcRect.height))) : 30;
  const startX = srcRect.left + srcRect.width / 2 - size / 2;
  const startY = srcRect.top + srcRect.height / 2 - size / 2;
  const endX = tRect.left + tRect.width / 2 - size / 2;
  const endY = tRect.top + tRect.height / 2 - size / 2;

  // Outer element travels horizontally (linear), inner vertically (eased):
  // composing the two gives a natural throwing arc.
  const outer = document.createElement("div");
  outer.style.cssText = `position:absolute;left:${startX}px;top:${startY}px;width:${size}px;height:${size}px;will-change:transform`;
  const inner = document.createElement("div");
  inner.style.cssText = `width:100%;height:100%;will-change:transform`;
  const ghost = document.createElement("div");

  const src = imageUrl || img?.currentSrc || img?.src;
  if (kind === "cart" && src) {
    ghost.style.cssText = `width:100%;height:100%;border-radius:18px;background:#fff center/cover no-repeat url("${src.replace(/"/g, "%22")}");box-shadow:0 18px 40px -12px rgba(47,36,31,.55),0 0 0 3px #fff`;
  } else {
    ghost.style.cssText = `width:100%;height:100%;color:${kind === "wishlist" ? "#E0475F" : BRAND};filter:drop-shadow(0 6px 12px rgba(224,71,95,.45))`;
    ghost.innerHTML = kind === "wishlist" ? HEART_SVG : `<div style="width:100%;height:100%;border-radius:50%;background:${BRAND}"></div>`;
  }
  inner.appendChild(ghost);
  outer.appendChild(inner);
  layer().appendChild(outer);

  const dx = endX - startX;
  const dy = endY - startY;
  // Peak of the arc, kept inside the viewport (never above the top edge).
  const SAFE_TOP = 8;
  const wantedLift = Math.min(160, Math.max(70, Math.abs(dy) * 0.45));
  const room = startY + Math.min(0, dy) - SAFE_TOP;
  const lift = Math.max(0, Math.min(wantedLift, room));
  const duration = Math.min(1100, Math.max(700, Math.hypot(dx, dy) * 0.9));

  outer.animate([{ transform: "translateX(0)" }, { transform: `translateX(${dx}px)` }], {
    duration,
    easing: "cubic-bezier(.45,0,.55,1)",
    fill: "forwards",
  });
  inner.animate(
    [
      { transform: "translateY(0)" },
      { transform: `translateY(${Math.min(0, dy) - lift}px)`, offset: 0.35 },
      { transform: `translateY(${dy}px)` },
    ],
    { duration, easing: "cubic-bezier(.3,.6,.5,1)", fill: "forwards" },
  );
  const spin = kind === "cart" ? (dx > 0 ? 18 : -18) : 0;
  ghost
    .animate(
      [
        { transform: "scale(1) rotate(0)", opacity: 1 },
        { transform: `scale(${kind === "cart" ? 1.08 : 1.6}) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.2 },
        { transform: `scale(${kind === "cart" ? 0.22 : 0.7}) rotate(${spin}deg)`, opacity: 0.85 },
      ],
      { duration, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" },
    )
    .onfinish = () => {
      outer.remove();
      bounce(target);
      burst(target, { hearts: kind === "wishlist", count: 10, spread: 34 });
    };
}

export const flyToCart = (from: Element | null, imageUrl?: string | null) => flyTo("cart", from, imageUrl);
export const flyToWishlist = (from: Element | null) => flyTo("wishlist", from);
