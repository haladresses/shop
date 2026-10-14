"use client";
import { useEffect } from "react";

/**
 * Site-wide scroll-reveal controller. Any element with `data-reveal` fades and
 * rises into view the first time it enters the viewport (stagger with the
 * `--reveal-delay` CSS variable). Watches the DOM, so content loaded later —
 * e.g. infinite-scroll product pages — animates too. Mount once per layout.
 */
export default function RevealController() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const root = document.documentElement;
    root.classList.add("reveal-ready");

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-revealed");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    const scan = (node: ParentNode) => {
      node.querySelectorAll?.("[data-reveal]:not(.is-revealed)").forEach((el) => io.observe(el));
    };
    scan(document);

    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          if (n.matches("[data-reveal]:not(.is-revealed)")) io.observe(n);
          scan(n);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      root.classList.remove("reveal-ready");
    };
  }, []);

  return null;
}
