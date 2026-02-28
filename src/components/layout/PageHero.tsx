import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeroProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "primary" | "warning";
}


const toneStyles: Record<NonNullable<PageHeroProps["tone"]>, string> = {
  default: "border-border bg-gradient-to-br from-card via-card/95 to-muted/70",
  primary: "border-primary/25 bg-gradient-to-br from-primary/25 via-primary/10 to-card",
  warning: "border-warning/35 bg-gradient-to-br from-warning/25 via-warning/10 to-card",
};
const toneAccentClass: Record<NonNullable<PageHeroProps["tone"]>, string> = {
  default: "bg-border",
  primary: "bg-primary",
  warning: "bg-warning",
};


const toneGlowClass: Record<NonNullable<PageHeroProps["tone"]>, string> = {
  default: "bg-muted/60",
  primary: "bg-primary/80",
  warning: "bg-warning/80",
};

export function PageHero({
  title,
  subtitle,
  actions,
  badge,
  icon,
  tone = "default",
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-xl border bg-card/70 p-5 backdrop-blur supports-[backdrop-filter]:bg-card/60 sm:p-6">
      <div className={cn("absolute inset-x-0 top-0 h-1", toneAccentClass[tone])} aria-hidden="true" />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          {(badge || icon) && (
            <div className="mb-3 flex items-center gap-2 text-muted-foreground">
              {icon ? <span className="shrink-0">{icon}</span> : null}
              {badge}
            </div>
          )}

          <h1 className="text-3xl font-serif tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground sm:text-base">{subtitle}</p> : null}
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}
