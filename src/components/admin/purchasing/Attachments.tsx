"use client";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { LuImagePlus, LuLoaderCircle, LuPaperclip, LuX } from "react-icons/lu";

export type Attachment = { url: string; name: string };

/**
 * Photos / scans of the supplier invoice, delivery note … (images — the
 * upload service accepts JPG, PNG, WEBP, AVIF and GIF).
 */
export default function Attachments({
  value,
  onChange,
  canEdit,
  max = 10,
}: {
  value: Attachment[];
  onChange: (next: Attachment[]) => void;
  canEdit: boolean;
  max?: number;
}) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = max - value.length;
    if (room <= 0) return toast.error(`Up to ${max} attachments`);
    setBusy(true);
    const added: Attachment[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      const fd = new FormData();
      fd.append("file", file);
      const d = await fetch("/api/upload", { method: "POST", body: fd })
        .then((r) => r.json())
        .catch(() => null);
      if (d?.success && d.data?.url) added.push({ url: d.data.url, name: file.name.slice(0, 200) });
      else toast.error(d?.error || `Could not upload ${file.name}`);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (added.length) onChange([...value, ...added]);
  };

  return (
    <div>
      {value.length === 0 && !canEdit && <p className="text-sm text-slate-400">No attachments.</p>}
      <div className="flex flex-wrap gap-3">
        {value.map((a, i) => (
          <div key={`${a.url}-${i}`} className="relative group w-24">
            <a href={a.url} target="_blank" rel="noopener" className="block w-24 h-24 rounded-xl overflow-hidden ring-1 ring-slate-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name || "Attachment"} className="w-full h-full object-cover" />
            </a>
            <p className="text-[11px] text-slate-500 truncate mt-1" title={a.name}>
              <LuPaperclip size={10} className="inline mr-0.5" />
              {a.name || "Attachment"}
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white shadow ring-1 ring-slate-200 text-slate-500 hover:text-rose-600 flex items-center justify-center"
                aria-label="Remove attachment"
              >
                <LuX size={13} />
              </button>
            )}
          </div>
        ))}
        {canEdit && value.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 flex flex-col items-center justify-center gap-1 text-xs"
          >
            {busy ? <LuLoaderCircle size={20} className="animate-spin" /> : <LuImagePlus size={20} />}
            {busy ? "Uploading" : "Add photo"}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
    </div>
  );
}
