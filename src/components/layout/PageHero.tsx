import { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AnimatedGroup } from "@/components/ui/animated-group";
import { TextEffect } from "@/components/ui/text-effect";
import { motion, type Variants, useMotionValueEvent, useScroll } from "framer-motion";

interface PageHeroProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "primary" | "warning";
}

const toneAccentClass: Record<NonNullable<PageHeroProps["tone"]>, string> = {
  default: "bg-border",
  primary: "bg-primary",
  warning: "bg-warning",
};

const accentVariants: Variants = {
  hidden: { scaleX: 0, opacity: 0 },
  visible: {
    scaleX: 1,
    opacity: 1,
    transition: { type: "spring" as const, bounce: 0.2, duration: 0.6 },
  },
};

export function PageHero({
  title,
  subtitle,
  actions,
  badge,
  icon,
  tone = "default",
}: PageHeroProps) {
  const [isCompact, setIsCompact] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When the sentinel scrolls out of view, go compact
        setIsCompact(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "-1px 0px 0px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Sentinel element — when this scrolls out, hero contracts */}
      <div ref={sentinelRef} className="h-0 w-full" aria-hidden="true" />

      <motion.section
        layout
        className={cn(
          "relative overflow-hidden rounded-xl border transition-all duration-300 z-30",
          isCompact
            ? "sticky top-0 bg-background/70 backdrop-blur-xl shadow-lg p-3 sm:p-3"
            : "bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60 p-5 sm:p-6"
        )}
      >
        <motion.div
          className={cn("absolute inset-x-0 top-0 h-1 origin-left", toneAccentClass[tone])}
          variants={accentVariants}
          initial="hidden"
          animate="visible"
          aria-hidden="true"
        />

        <div
          className={cn(
            "grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center transition-all duration-300",
            isCompact && "gap-2"
          )}
        >
          <div className="min-w-0">
            {(badge || icon) && !isCompact && (
              <AnimatedGroup preset="fade" className="mb-3 flex items-center gap-2 text-muted-foreground">
                {icon ? <span className="shrink-0">{icon}</span> : null}
                {badge ? <span>{badge}</span> : null}
              </AnimatedGroup>
            )}

            {isCompact ? (
              <div className="flex items-center gap-2 min-w-0">
                {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
                <h1 className="text-lg font-serif tracking-tight text-foreground truncate">
                  {title}
                </h1>
              </div>
            ) : (
              <>
                <TextEffect
                  preset="blur"
                  per="word"
                  as="h1"
                  className="text-3xl font-serif tracking-tight text-foreground"
                  delay={0.1}
                >
                  {title}
                </TextEffect>

                {subtitle ? (
                  <TextEffect
                    preset="fade"
                    per="word"
                    as="p"
                    className="mt-1 text-sm text-muted-foreground sm:text-base"
                    delay={0.3}
                  >
                    {subtitle}
                  </TextEffect>
                ) : null}
              </>
            )}
          </div>

          {actions ? (
            isCompact ? (
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {actions}
              </div>
            ) : (
              <AnimatedGroup preset="blur-slide" className="flex flex-wrap items-center gap-2 lg:justify-end">
                {actions}
              </AnimatedGroup>
            )
          ) : null}
        </div>
      </motion.section>
    </>
  );
}
