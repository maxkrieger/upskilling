import ReactMarkdown from "react-markdown";
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

export function Markdown({ content }: { content: string }) {
  const segments = splitChartBlocks(content);
  return (
    <div className="prose-chat">
      {segments.map((seg, i) =>
        seg.type === "chart" ? (
          <ChartBlock key={i} spec={seg.spec} />
        ) : seg.type === "pending" ? (
          <PendingChart key={i} />
        ) : (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
            {seg.text}
          </ReactMarkdown>
        ),
      )}
    </div>
  );
}
