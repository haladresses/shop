// Printing one part of a page (receipt, invoice, label sheet, report …)
// without the rest of the app around it.
//
// Usage:
//   <PrintArea id="receipt"> …printable markup… </PrintArea>
//   <button onClick={() => printArea("receipt", { page: "receipt" })}>Print</button>
//
// PrintArea renders its children into a hidden container directly under
// <body>; printArea() shows only that container while the print dialog is
// open (see the "Printing" block in css/style.css) and sets the paper size.

export type PrintPage =
  | "receipt" // 80 mm thermal roll
  | "a4"
  | "a4-landscape"
  | { size: string; margin?: string };

const PAGE_CSS: Record<Exclude<PrintPage, object>, { size: string; margin: string }> = {
  receipt: { size: "80mm auto", margin: "3mm" },
  a4: { size: "A4 portrait", margin: "12mm" },
  "a4-landscape": { size: "A4 landscape", margin: "10mm" },
};

export function printArea(id: string, opts: { page?: PrintPage; title?: string } = {}) {
  if (typeof window === "undefined") return;
  const roots = Array.from(document.querySelectorAll<HTMLElement>(".print-root"));
  const target = roots.find((r) => r.dataset.printId === id);
  if (!target) {
    console.warn(`[print] nothing to print for "${id}"`);
    return;
  }
  roots.forEach((r) => r.classList.toggle("print-active", r === target));

  const page = opts.page ?? "a4";
  const css = typeof page === "string" ? PAGE_CSS[page] : { size: page.size, margin: page.margin ?? "0" };
  const style = document.createElement("style");
  style.dataset.printPage = id;
  style.textContent = `@page { size: ${css.size}; margin: ${css.margin}; }`;
  document.head.appendChild(style);

  const html = document.documentElement;
  html.classList.add("is-printing");
  const prevTitle = document.title;
  // The title becomes the default file name when saving as PDF.
  if (opts.title) document.title = opts.title;

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    style.remove();
    html.classList.remove("is-printing");
    target.classList.remove("print-active");
    document.title = prevTitle;
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  // Two frames so freshly rendered content (barcodes, fonts) is laid out.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      window.print();
      // window.print() blocks in most browsers; afterprint covers the rest.
      setTimeout(cleanup, 500);
    }),
  );
}
