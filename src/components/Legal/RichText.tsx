"use client";

/** Renders plain text where lines starting with "- " become bullet points, grouped into lists. */
const RichText = ({ text, isArabic }: { text: string; isArabic: boolean }) => {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const blocks: { type: "p" | "ul"; content: string[] }[] = [];

  for (const line of lines) {
    const isBullet = line.startsWith("- ");
    const content = isBullet ? line.slice(2) : line;
    const last = blocks[blocks.length - 1];
    if (isBullet && last?.type === "ul") {
      last.content.push(content);
    } else if (isBullet) {
      blocks.push({ type: "ul", content: [content] });
    } else {
      blocks.push({ type: "p", content: [content] });
    }
  }

  return (
    <>
      {blocks.map((b, i) =>
        b.type === "ul" ? (
          <ul key={i} className={`list-disc space-y-1.5 mb-4 text-dark-3 ${isArabic ? "pe-5" : "ps-5"}`}>
            {b.content.map((c, j) => (
              <li key={j}>{c}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="mb-4 leading-relaxed text-dark-3">
            {b.content[0]}
          </p>
        )
      )}
    </>
  );
};

export default RichText;
