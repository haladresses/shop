import React from "react";
import Link from "next/link";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  /** Optional "View all" style link shown on the opposite side of the title. */
  href?: string;
  linkLabel?: string;
  /** Any other action for the opposite side (e.g. carousel arrows). */
  children?: React.ReactNode;
};

/**
 * Shared storefront section header: a small brand-coloured eyebrow, the
 * section title and an optional action on the other side. It follows the
 * document direction, so it mirrors in Arabic without extra classes.
 */
const SectionHeading = ({ eyebrow, title, href, linkLabel, children }: SectionHeadingProps) => (
  <div className="mb-6 sm:mb-8 flex items-end justify-between gap-4">
    <div className="min-w-0">
      <p className="mb-1 text-custom-sm font-medium text-blue">{eyebrow}</p>
      <h2 className="font-semibold text-xl xl:text-heading-5 text-dark">{title}</h2>
    </div>

    {href && linkLabel ? (
      <Link
        href={href}
        className="shrink-0 inline-flex font-medium text-custom-sm py-2 px-5 rounded-md border border-gray-3 bg-white text-dark ease-out duration-200 hover:bg-dark hover:text-white hover:border-dark"
      >
        {linkLabel}
      </Link>
    ) : null}
    {children ? <div className="shrink-0">{children}</div> : null}
  </div>
);

export default SectionHeading;
