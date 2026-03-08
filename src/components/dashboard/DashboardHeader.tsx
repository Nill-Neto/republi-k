import { ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarClock, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AnimatedGroup } from "@/components/ui/animated-group";
import { TextEffect } from "@/components/ui/text-effect";

interface DashboardHeaderProps {
  userName: string | undefined;
  groupName: string | undefined;
  currentDate: Date;
  cycleStart: Date;
  cycleEnd: Date;
  cycleLimitDate: Date;
  onNextMonth: () => void;
  onPrevMonth: () => void;
  compactTabs?: ReactNode;
  onCompactChange?: (isCompact: boolean) => void;
}

export function DashboardHeader({
  userName,
  groupName,
  currentDate,
  cycleStart,
  cycleEnd,
  cycleLimitDate,
  onNextMonth,
  onPrevMonth,
  compactTabs,
  onCompactChange,
}: DashboardHeaderProps) {
  const [isCompact, setIsCompact] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCompact(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "-1px 0px 0px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    onCompactChange?.(isCompact);
  }, [isCompact, onCompactChange]);

  return (
    <>
      <div ref={sentinelRef} className="h-0 w-full" aria-hidden="true" />

      <motion.section
        layout
        className={cn(
          "relative overflow-hidden rounded-xl border transition-all duration-300 z-30",
          isCompact
            ? "sticky top-0 bg-transparent backdrop-blur-xl shadow-lg p-3 sm:p-3"
            : "bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60 p-4 sm:p-5"
        )}
      >
        {/* Accent bar */}
        <motion.div
          className="absolute inset-x-0 top-0 h-1 origin-left bg-primary"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          aria-hidden="true"
        />

        <div
          className={cn(
            "grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center transition-all duration-300",
            isCompact && "gap-2"
          )}
        >
          {/* Left: Title + subtitle */}
          <div className="min-w-0">
            {isCompact ? (
              <h1 className="text-lg font-serif tracking-tight text-foreground truncate">
                {`Olá, ${userName?.split(" ")[0] ?? ""}`}
              </h1>
            ) : (
              <>
                <TextEffect
                  preset="blur"
                  per="word"
                  as="h1"
                  className="text-3xl font-serif text-foreground"
                  delay={0.05}
                >
                  {`Olá, ${userName?.split(" ")[0] ?? ""}`}
                </TextEffect>
                {groupName ? (
                  <TextEffect
                    preset="fade"
                    per="word"
                    as="p"
                    className="text-muted-foreground mt-1"
                    delay={0.25}
                  >
                    {groupName}
                  </TextEffect>
                ) : null}
              </>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex items-center bg-card/80 border rounded-lg p-1 shadow-sm h-10">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-3 text-sm font-medium min-w-[140px] text-center capitalize">
                {format(currentDate, "MMMM yyyy", { locale: ptBR })}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="outline" className="relative h-10 gap-2 overflow-hidden" asChild>
              <Link to="/expenses">
                <div
                  className={cn(
                    "absolute inset-0 pointer-events-none rounded-[inherit] border-2 border-transparent border-inset [mask-clip:padding-box,border-box]",
                    "[mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
                  )}
                >
                  <motion.div
                    className="absolute aspect-square bg-gradient-to-r from-transparent via-primary to-primary"
                    animate={{ offsetDistance: ["0%", "100%"] }}
                    style={{ width: 20, offsetPath: `rect(0 auto auto 0 round 10px)` }}
                    transition={{ repeat: Number.POSITIVE_INFINITY, duration: 5, ease: "linear" }}
                  />
                </div>
                <Plus className="h-4 w-4" /> Nova Despesa
              </Link>
            </Button>
          </div>
        </div>

        {/* Badges — hidden when compact */}
        {!isCompact && (
          <AnimatedGroup preset="blur-slide" className="flex flex-wrap gap-2 mt-4">
            <Badge variant="outline" className="gap-1.5 font-normal py-1 px-3 text-sm">
              <CalendarClock className="h-3.5 w-3.5 text-primary" />
              Competência: <strong>{format(cycleStart, "dd/MM")}</strong> a <strong>{format(subDays(cycleEnd, 1), "dd/MM")}</strong>
            </Badge>
            <Badge variant="outline" className="gap-1.5 font-normal py-1 px-3 text-sm">
              <Calendar className="h-3.5 w-3.5 text-destructive" />
              Pagar até: <strong>{format(cycleLimitDate, "dd/MM")}</strong>
            </Badge>
          </AnimatedGroup>
        )}

        {/* Compact tabs — shown only when sticky */}
        {isCompact && compactTabs && (
          <div className="mt-2 -mb-1 border-t border-border/40 pt-2">
            {compactTabs}
          </div>
        )}
      </motion.section>
    </>
  );
}
