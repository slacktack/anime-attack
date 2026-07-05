"use client";
import { ChevronRight } from "lucide-react";

type Line =
  | { kind: "bullet"; content: string }
  | { kind: "numbered"; index: string; content: string }
  | { kind: "heading"; content: string }
  | { kind: "paragraph"; content: string }
  | { kind: "space" };

const NUMBERED_RE = /^(\d+)[.)]\s+(.*)$/;
const HEADING_KEYWORDS = ["answers:", "fun facts", "fun facts:", "quiz", "summary:"];

function classifyLine(raw: string): Line {
  const line = raw.trim();

  if (line.length === 0) {
    return { kind: "space" };
  }

  if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("•")) {
    const content = line.replace(/^[-*•]\s*/, "");
    return { kind: "bullet", content };
  }

  const numberedMatch = line.match(NUMBERED_RE);
  if (numberedMatch) {
    return { kind: "numbered", index: numberedMatch[1], content: numberedMatch[2] };
  }

  const lower = line.toLowerCase();
  const isShortHeading = line.endsWith(":") && line.length < 40;
  const isKeywordHeading = HEADING_KEYWORDS.some((kw) => lower.startsWith(kw));
  if (isShortHeading || isKeywordHeading) {
    return { kind: "heading", content: line.replace(/:$/, "") };
  }

  return { kind: "paragraph", content: line };
}

export function AiReport({ text }: { text: string }) {
  const lines = text.split("\n").map(classifyLine);

  return (
    <div className="rounded-2xl bg-black/30 border border-white/10 p-4 font-body">
      <div className="flex flex-col gap-1.5">
        {lines.map((line, i) => {
          switch (line.kind) {
            case "space":
              return <div key={i} className="h-2" />;
            case "heading":
              return (
                <p
                  key={i}
                  className="mt-2 font-display text-sm uppercase tracking-wide text-white/50 first:mt-0"
                >
                  {line.content}
                </p>
              );
            case "bullet":
              return (
                <div key={i} className="flex items-start gap-1.5 pl-1">
                  <ChevronRight
                    size={16}
                    color="currentColor"
                    className="mt-0.5 shrink-0 text-accent-purple"
                  />
                  <span className="leading-relaxed text-white/85">{line.content}</span>
                </div>
              );
            case "numbered":
              return (
                <div key={i} className="flex items-start gap-2 pl-1">
                  <span className="shrink-0 font-semibold text-accent-purple">{line.index}.</span>
                  <span className="leading-relaxed text-white/85">{line.content}</span>
                </div>
              );
            case "paragraph":
              return (
                <p key={i} className="leading-relaxed text-white/85">
                  {line.content}
                </p>
              );
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
