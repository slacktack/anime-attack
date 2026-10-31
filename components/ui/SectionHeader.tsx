import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/** Section header with the accent hairline marker used across every screen. */
export function SectionHeader({
  title,
  href,
  action,
  hint,
}: {
  title: string;
  href?: string;
  action?: string;
  hint?: ReactNode;
}) {
  return (
    <div className="aa-section">
      <h2 className="aa-section-title">
        {title}
        {hint && (
          <span className="text-[11px] font-semibold tracking-normal text-white/35">{hint}</span>
        )}
      </h2>
      {href && (
        <Link href={href} className="aa-section-link">
          {action ?? "See all"}
          <ChevronRight size={13} />
        </Link>
      )}
    </div>
  );
}
