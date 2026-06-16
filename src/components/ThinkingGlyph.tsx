import { useEffect, useState } from "react";

// A unicode asterisk that grows/shrinks through frames — the Claude Code
// "working" effect — used in place of a blinking cursor while streaming.
const FRAMES = ["·", "✢", "✳", "∗", "✻", "✽", "✻", "∗", "✳", "✢"];

export function ThinkingGlyph({ className = "" }: { className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % FRAMES.length), 200);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={className} aria-hidden>
      {FRAMES[i]}
    </span>
  );
}
