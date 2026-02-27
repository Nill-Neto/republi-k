import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarClock, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
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
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Olá, {userName?.split(" ")[0]}</h1>
          <p className="text-muted-foreground mt-1">{groupName}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex items-center bg-card border rounded-lg p-1 shadow-sm h-10">
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
                  className={cn(
                    "absolute aspect-square bg-gradient-to-r from-transparent via-primary to-primary"
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
                    duration: 5,
                    ease: "linear",
                  }}
                />
              </div>
              <Plus className="h-4 w-4" /> Nova Despesa
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1.5 font-normal py-1 px-3 text-sm">
            <CalendarClock className="h-3.5 w-3.5 text-primary" /> 
            Competência: <strong>{format(cycleStart, "dd/MM")}</strong> a <strong>{format(subDays(cycleEnd, 1), "dd/MM")}</strong>
        </Badge>
        <Badge variant="outline" className="gap-1.5 font-normal py-1 px-3 text-sm">
            <Calendar className="h-3.5 w-3.5 text-destructive" /> 
            Pagar até: <strong>{format(cycleLimitDate, "dd/MM")}</strong>
        </Badge>
      </div>
    </div>
  );
}