import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
      <div>
        <h1 className="font-display text-[34px] font-extrabold leading-none tracking-[-0.045em] [font-stretch:85%] lg:text-[52px]">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-[14px] text-muted lg:text-[15.5px]">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}
