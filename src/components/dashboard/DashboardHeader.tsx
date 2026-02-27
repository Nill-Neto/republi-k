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
    <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 mb-8 overflow-hidden">
      <div className="bg-primary/10 border-b border-primary/20 px-4 md:px-8 py-8 md:py-12 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-serif text-foreground tracking-tight">Olá, <span className="text-primary">{userName?.split(" ")[0]}</span></h1>
            <p className="text-muted-foreground font-medium">{groupName}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex items-center bg-background/80 backdrop-blur-sm border border-primary/20 rounded-lg p-1 shadow-sm h-10">
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" onClick={onPrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-3 text-sm font-bold min-w-[140px] text-center capitalize text-primary">
                {format(currentDate, "MMMM yyyy", { locale: ptBR })}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" onClick={onNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <Button className="h-10 gap-2 shadow-lg shadow-primary/20" asChild>
              <Link to="/expenses">
                <Plus className="h-4 w-4" /> Nova Despesa
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap gap-2 mt-6">
          <Badge variant="outline" className="gap-1.5 font-semibold py-1.5 px-4 text-sm bg-background/50 border-primary/30 text-primary">
              <CalendarClock className="h-3.5 w-3.5" /> 
              Competência: {format(cycleStart, "dd/MM")} a {format(subDays(cycleEnd, 1), "dd/MM")}
          </Badge>
          <Badge variant="outline" className="gap-1.5 font-semibold py-1.5 px-4 text-sm bg-destructive/10 border-destructive/30 text-destructive">
              <Calendar className="h-3.5 w-3.5" /> 
              Pagar até: {format(cycleLimitDate, "dd/MM")}
          </Badge>
        </div>
      </div>
    </div>
  );
}