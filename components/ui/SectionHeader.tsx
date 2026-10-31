import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

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
        {hint != null && <span className="text-[13px] font-medium tracking-normal text-muted">{hint}</span>}
      </h2>
      {href && (
        <Link href={href} className="aa-section-link">
          {action ?? "See all"}
          <ChevronRight size={15} />
        </Link>
      )}
    </div>
  );
}
