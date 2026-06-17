import { useEffect, useState } from "react";

// A unicode asterisk that grows/shrinks through frames — the Claude Code
// "working" effect — used in place of a blinking cursor while streaming.
const FRAMES = ["·", "✢", "✳", "∗", "✻", "✽", "✻", "∗", "✳", "✢"];

export function ThinkingGlyph({
  className = "",
  fixedWidth = true,
}: {
  className?: string;
  /** Fixed centered box so varying glyph widths don't shift a following label.
   * Turn off for a standalone trailing cursor (avoids extra left indent). */
  fixedWidth?: boolean;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % FRAMES.length), 200);
    return () => clearInterval(t);
  }, []);
  return (
    <span
      className={`${fixedWidth ? "inline-block w-[1.15em] text-center" : ""} leading-none ${className}`}
      aria-hidden
    >
      {FRAMES[i]}
    </span>
  );
}
