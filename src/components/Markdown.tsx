import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChartSpec } from "../../shared/types.ts";
import { ChartBlock } from "./ChartBlock.tsx";

const CHART_FENCE = /```chart\s*\n([\s\S]*?)```/g;

type Segment = { type: "md"; text: string } | { type: "chart"; spec: ChartSpec };

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
      // If the JSON is incomplete (mid-stream), keep it as code for now.
      segments.push({ type: "md", text: "```chart\n" + m[1] + "```" });
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    segments.push({ type: "md", text: content.slice(last) });
  }
  return segments;
}

export function Markdown({ content }: { content: string }) {
  const segments = splitChartBlocks(content);
  return (
    <div className="prose-chat">
      {segments.map((seg, i) =>
        seg.type === "chart" ? (
          <ChartBlock key={i} spec={seg.spec} />
        ) : (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
            {seg.text}
          </ReactMarkdown>
        ),
      )}
    </div>
  );
}
