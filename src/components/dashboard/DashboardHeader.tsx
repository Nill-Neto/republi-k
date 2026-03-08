import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarClock, Calendar, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { AnimatedGroup } from "@/components/ui/animated-group";
import { TextEffect } from "@/components/ui/text-effect";
import { Variants } from "framer-motion";

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

const transitionVariants: { item: Variants } = {
  item: {
    hidden: {
      opacity: 0,
      filter: 'blur(8px)',
      y: 10,
    },
    visible: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      transition: {
        type: 'spring',
        bounce: 0.3,
        duration: 1.2,
      },
    },
  },
};

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
    <div className="space-y-4 relative">
      {/* Subtle Hero-like Background Elements */}
      <div aria-hidden className="absolute inset-0 pointer-events-none isolate opacity-40 contain-strict hidden md:block z-0">
        <div className="w-[30rem] h-[30rem] -translate-y-[150px] absolute left-0 top-0 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,var(--primary)_0,transparent_100%)] opacity-[0.05]" />
        <div className="w-[20rem] h-[20rem] absolute right-0 top-0 -translate-y-[50px] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,var(--primary)_0,transparent_100%)] opacity-[0.03]" />
      </div>

      <AnimatedGroup 
        variants={{
          container: {
            visible: {
              transition: {
                staggerChildren: 0.1,
                delayChildren: 0.1,
              },
            },
          },
          ...transitionVariants,
        }}
        className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
      >
        <div className="relative" key="header-title">
          <div className="flex items-center gap-2 mb-2 opacity-80">
             <div className="h-1.5 w-6 bg-primary rounded-full" />
             <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Status Financeiro</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-foreground flex items-center gap-3">
            <TextEffect preset="blur" per="word">
              {`Olá, ${userName?.split(" ")[0] || "Usuário"}`}
            </TextEffect>
            <Sparkles className="h-6 w-6 text-primary opacity-50 animate-pulse" />
          </h1>
          <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-lg">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
            <TextEffect preset="fade" per="word" delay={0.3}>
              {groupName || ""}
            </TextEffect>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center" key="header-actions">
          <div className="flex items-center bg-card/80 backdrop-blur-md border border-primary/10 rounded-xl p-1 shadow-sm h-12">
            <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-primary/10 hover:text-primary transition-colors" onClick={onPrevMonth}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="px-5 text-sm font-bold min-w-[160px] text-center capitalize text-primary">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </div>
            <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-primary/10 hover:text-primary transition-colors" onClick={onNextMonth}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          
          <Button className="gap-2 h-12 px-8 shadow-lg shadow-primary/20 rounded-xl font-bold transition-transform hover:scale-[1.02] active:scale-[0.98]" asChild>
            <Link to="/expenses">
              <Plus className="h-5 w-5" /> Nova Despesa
            </Link>
          </Button>
        </div>
      </AnimatedGroup>

      <AnimatedGroup 
        variants={{
          container: {
            visible: {
              transition: {
                staggerChildren: 0.1,
                delayChildren: 0.3,
              },
            },
          },
          ...transitionVariants,
        }}
        className="relative z-10 flex flex-wrap gap-3 mt-4"
      >
        <Badge key="badge-1" variant="outline" className="gap-2 font-semibold py-1.5 px-4 text-xs bg-card/50 backdrop-blur-sm border-primary/20 text-primary shadow-sm rounded-full">
            <CalendarClock className="h-4 w-4" /> 
            Ciclo: <strong className="font-bold">{format(cycleStart, "dd/MM")}</strong> a <strong className="font-bold">{format(subDays(cycleEnd, 1), "dd/MM")}</strong>
        </Badge>
        <Badge key="badge-2" variant="outline" className="gap-2 font-semibold py-1.5 px-4 text-xs bg-destructive/5 backdrop-blur-sm border-destructive/20 text-destructive shadow-sm rounded-full">
            <Calendar className="h-4 w-4" /> 
            Pagar até: <strong className="font-bold">{format(cycleLimitDate, "dd/MM")}</strong>
        </Badge>
      </AnimatedGroup>
    </div>
  );
}
