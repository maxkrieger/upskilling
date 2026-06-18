import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChartSpec } from "../../shared/types.ts";
import { ChartBlock } from "./ChartBlock.tsx";
import { ThinkingGlyph } from "./ThinkingGlyph.tsx";

const CHART_FENCE = /```chart\s*\n([\s\S]*?)```/g;

type Segment =
  | { type: "md"; text: string }
  | { type: "chart"; spec: ChartSpec }
  | { type: "pending" };

/** Split content into markdown text segments and parsed inline chart specs. */
function splitChartBlocks(content: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  CHART_FENCE.lastIndex = 0;
  while ((m = CHART_FENCE.exec(content)) !== null) {
    if (m.index > last) {
      segments.push({ type: "md", text: content.slice(last, m.index) });
    }
    try {
      segments.push({ type: "chart", spec: JSON.parse(m[1]) as ChartSpec });
    } catch {
      segments.push({ type: "pending" });
    }
    last = m.index + m[0].length;
  }

  let tail = content.slice(last);
  // An opening ```chart with no closing fence yet (mid-stream): hide the raw
  // JSON behind a placeholder instead of showing it as a code block.
  const open = tail.indexOf("```chart");
  if (open !== -1) {
    if (open > 0) segments.push({ type: "md", text: tail.slice(0, open) });
    segments.push({ type: "pending" });
    tail = "";
  }
  if (tail) segments.push({ type: "md", text: tail });
  return segments;
}

function PendingChart() {
  return (
    <div className="my-3 flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-6 text-sm text-faint">
      <ThinkingGlyph className="text-accent" />
      Building chart…
    </div>
  );
}

/** Custom renderers that append `cursor` inline to the LAST paragraph of a
 * segment, so the streaming glyph trails the end of the text line (rather than
 * dropping to its own line / below a spliced chip). */
function cursorComponents(cursor: ReactNode, text: string): Components {
  const end = text.trimEnd().length;
  return {
    p({ node, children }) {
      const offset = (node as { position?: { end?: { offset?: number } } } | undefined)?.position?.end
        ?.offset;
      const isLast = offset == null || offset >= end;
      return (
        <p>
          {children}
          {isLast ? cursor : null}
        </p>
      );
    },
  };
}

export function Markdown({ content, cursor }: { content: string; cursor?: ReactNode }) {
  const segments = splitChartBlocks(content);
  const lastIdx = segments.length - 1;
  const lastIsMd = lastIdx >= 0 && segments[lastIdx].type === "md";
  return (
    <div className="prose-chat">
      {segments.map((seg, i) => {
        if (seg.type === "chart") return <ChartBlock key={i} spec={seg.spec} />;
        if (seg.type === "pending") return <PendingChart key={i} />;
        const withCursor = !!cursor && lastIsMd && i === lastIdx;
        return (
          <ReactMarkdown
            key={i}
            remarkPlugins={[remarkGfm]}
            components={withCursor ? cursorComponents(cursor, seg.text) : undefined}
          >
            {seg.text}
          </ReactMarkdown>
        );
      })}
      {/* If the content ends on a chart/placeholder (no trailing paragraph to
          host it), trail the cursor after everything so it never vanishes. */}
      {cursor && !lastIsMd && <span className="align-middle">{cursor}</span>}
    </div>
  );
}
