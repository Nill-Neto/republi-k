import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarClock, Calendar, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

interface DashboardHeaderProps {
  userName: string | undefined;
  groupName: string | undefined;
  currentDate: Date;
  cycleStart: Date;
  cycleEnd: Date;
  cycleLimitDate: Date;
  onNextMonth: () => void;
  onPrevMonth: () => void;
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
}: DashboardHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between relative">
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
             <div className="h-2 w-8 bg-primary rounded-full" />
             <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Status Financeiro</span>
          </div>
          <h1 className="text-4xl font-serif text-foreground flex items-center gap-2">
            Olá, {userName?.split(" ")[0]} 
            <Sparkles className="h-5 w-5 text-primary opacity-40" />
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {groupName}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex items-center bg-card/80 backdrop-blur-sm border-2 border-primary/10 rounded-xl p-1 shadow-sm h-11">
            <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-colors" onClick={onPrevMonth}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="px-4 text-sm font-bold min-w-[150px] text-center capitalize text-primary">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-colors" onClick={onNextMonth}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          
          <Button className="relative h-11 gap-2 overflow-hidden px-6 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]" asChild>
            <Link to="/expenses">
              <div
                className={cn(
                  "absolute inset-0 pointer-events-none rounded-[inherit] border-2 border-transparent border-inset [mask-clip:padding-box,border-box]",
                  "[mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
                )}
              >
                <motion.div
                  className={cn(
                    "absolute aspect-square bg-gradient-to-r from-transparent via-white/40 to-white/40"
                  )}
                  animate={{
                    offsetDistance: ["0%", "100%"],
                  }}
                  style={{
                    width: 20,
                    offsetPath: `rect(0 auto auto 0 round 10px)`,
                  }}
                  transition={{
                    repeat: Number.POSITIVE_INFINITY,
                    duration: 4,
                    ease: "linear",
                  }}
                />
              </div>
              <Plus className="h-5 w-5" /> <span className="font-bold">Nova Despesa</span>
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1.5 font-semibold py-1.5 px-4 text-xs bg-card border-primary/20 text-primary shadow-sm">
            <CalendarClock className="h-3.5 w-3.5" /> 
            Ciclo: <strong>{format(cycleStart, "dd/MM")}</strong> a <strong>{format(subDays(cycleEnd, 1), "dd/MM")}</strong>
        </Badge>
        <Badge variant="outline" className="gap-1.5 font-semibold py-1.5 px-4 text-xs bg-destructive/5 border-destructive/20 text-destructive shadow-sm">
            <Calendar className="h-3.5 w-3.5" /> 
            Pagar até: <strong>{format(cycleLimitDate, "dd/MM")}</strong>
        </Badge>
      </div>
    </div>
  );
}