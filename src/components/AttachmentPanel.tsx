import { useEffect, useMemo, useState } from "react";
import { FileText, Image as ImageIcon, Table2, X } from "lucide-react";
import type { Attachment } from "../../shared/types.ts";
import { useStore } from "../store.ts";

/** Minimal RFC-4180-ish CSV parser (handles quoted fields and escaped quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const isNumeric = (s: string) => s.trim() !== "" && !Number.isNaN(Number(s.replace(/,/g, "")));

function CsvTable({ text }: { text: string }) {
  const rows = useMemo(() => parseCsv(text), [text]);
  if (rows.length === 0) return <div className="text-sm text-faint">Empty file.</div>;
  const [header, ...body] = rows;
  return (
    <div className="overflow-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0">
          <tr className="bg-elevated">
            {header.map((h, i) => (
              <th
                key={i}
                className="border-b border-border px-3 py-2 text-left font-semibold text-ink"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri} className="odd:bg-surface/40">
              {header.map((_, ci) => (
                <td
                  key={ci}
                  className={`border-b border-border/60 px-3 py-1.5 text-muted ${
                    isNumeric(r[ci] ?? "") ? "text-right tabular-nums" : ""
                  }`}
                >
                  {r[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AttachmentPanel() {
  const att = useStore((s) => s.viewerAttachment);
  const close = useStore((s) => s.closeAttachment);
  // Keep rendering the last attachment while the panel slides closed so its
  // contents don't blank out mid-transition.
  const [shown, setShown] = useState(att);
  useEffect(() => {
    if (att) setShown(att);
  }, [att]);

  const open = !!att;
  const display = att ?? shown;
  const isCsv = !!display && (display.kind === "csv" || /\.csv$/i.test(display.name));
  const Icon = display?.kind === "image" ? ImageIcon : isCsv ? Table2 : FileText;

  return (
    <div
      className={`h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-out ${
        open ? "w-[28rem]" : "w-0"
      }`}
    >
      <aside
        className={`flex h-full w-[28rem] flex-col border-l border-border bg-canvas transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {display && (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Icon size={16} className="shrink-0 text-faint" />
                <span className="truncate text-sm font-medium text-ink" title={display.name}>
                  {display.name}
                </span>
              </div>
              <button
                onClick={close}
                className="rounded-md p-1 text-faint hover:bg-elevated hover:text-ink"
                aria-label="Close attachment viewer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="scrollbar-thin flex-1 overflow-auto p-4">
              {display.kind === "image" ? (
                <img src={display.content} alt={display.name} className="max-w-full rounded-lg" />
              ) : isCsv ? (
                <CsvTable text={display.content} />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">
                  {display.content}
                </pre>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
