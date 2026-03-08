import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, CreditCard, Plus, PieChart as PieChartIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CHART_COLORS, CATEGORY_COLORS } from "@/constants/categories";
import { DonutChart, type DonutChartSegment } from "@/components/ui/donut-chart";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CardsTabProps {
  totalBill: number;
  currentDate: Date;
  cardsChartData: any[];
  creditCards: any[];
  cardsBreakdown: Record<string, number>;
  billInstallments: any[];
}

export function CardsTab({
  totalBill,
  currentDate,
  cardsChartData,
  creditCards,
  cardsBreakdown,
  billInstallments,
}: CardsTabProps) {
  const [hoveredSegmentLabel, setHoveredSegmentLabel] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<any | null>(null);

  const donutData: DonutChartSegment[] = cardsChartData.map((entry, index) => ({
    label: entry.name,
    value: entry.value,
    color: CATEGORY_COLORS[entry.name] || CHART_COLORS[index % CHART_COLORS.length],
  }));

  const activeSegment = donutData.find(d => d.label === hoveredSegmentLabel);
  const displayValue = activeSegment ? activeSegment.value : totalBill;
  const displayLabel = activeSegment ? activeSegment.label : "Total Fatura";
  const displayPercentage = activeSegment && totalBill > 0 ? (activeSegment.value / totalBill) * 100 : 100;

  const selectedCardInstallments = selectedCard
    ? billInstallments.filter((i: any) => i.expenses?.credit_card_id === selectedCard.id)
    : [];

  const selectedCardTotal = selectedCardInstallments.reduce((sum: number, i: any) => sum + Number(i.amount), 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-primary text-primary-foreground md:col-span-1 shadow-lg shadow-primary/20 border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary-foreground/80">Total em Faturas</CardTitle>
            <Wallet className="h-4 w-4 text-primary-foreground/60" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold tracking-tight">R$ {totalBill.toFixed(2)}</div>
            <p className="text-xs text-primary-foreground/60 mt-2 font-medium bg-primary-foreground/10 inline-block px-2 py-1 rounded">
              {format(currentDate, "MMMM/yyyy")}
            </p>
            <Button variant="secondary" size="sm" className="mt-6 w-full font-medium" asChild>
              <Link to="/personal/bills">Ver Extrato Completo</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Composição da Fatura</CardTitle>
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="h-auto md:h-[280px] flex flex-col md:flex-row items-center justify-center gap-8 p-6">
            {donutData.length > 0 ? (
              <>
                <div className="relative">
                  <DonutChart
                    data={donutData}
                    size={220}
                    strokeWidth={24}
                    animationDuration={1}
                    onSegmentHover={(segment) => setHoveredSegmentLabel(segment?.label || null)}
                    centerContent={
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={displayLabel}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.2 }}
                          className="flex flex-col items-center justify-center text-center p-2"
                        >
                          <p className="text-muted-foreground text-xs font-medium truncate max-w-[140px] uppercase tracking-wider">
                            {displayLabel}
                          </p>
                          <p className="text-2xl font-bold text-foreground">
                            R$ {displayValue.toFixed(0)}
                          </p>
                          {activeSegment && (
                            <p className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full mt-1">
                              {displayPercentage.toFixed(0)}%
                            </p>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    }
                  />
                </div>
                
                <div className="flex flex-col space-y-2 w-full max-w-[240px] overflow-y-auto max-h-[220px] pr-2 scrollbar-thin">
                  {donutData.map((segment) => (
                    <div
                      key={segment.label}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-md transition-colors cursor-default text-sm",
                        hoveredSegmentLabel === segment.label ? "bg-muted" : "hover:bg-muted/50"
                      )}
                      onMouseEnter={() => setHoveredSegmentLabel(segment.label)}
                      onMouseLeave={() => setHoveredSegmentLabel(null)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: segment.color }}
                        />
                        <span className="font-medium truncate text-muted-foreground">
                          {segment.label}
                        </span>
                      </div>
                      <span className="font-semibold tabular-nums">
                        R$ {segment.value.toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground text-sm opacity-60 h-full w-full">
                <CreditCard className="h-8 w-8 mb-2 opacity-20" />
                <p>Fatura zerada neste mês</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2 text-foreground/90">
          <CreditCard className="h-5 w-5 text-primary" /> Meus Cartões
        </h3>
        
        {creditCards.length === 0 ? (
          <Card className="border-dashed bg-muted/20">
            <CardContent className="py-10 flex flex-col items-center justify-center text-center">
              <div className="bg-muted p-3 rounded-full mb-3">
                <CreditCard className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium mb-1">Nenhum cartão cadastrado</p>
              <p className="text-xs text-muted-foreground/70 mb-4 max-w-[200px]">Cadastre seus cartões para controlar as faturas automaticamente.</p>
              <Button variant="outline" asChild><Link to="/personal/cards">Cadastrar Cartão</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {creditCards.map(card => {
              const billValue = cardsBreakdown[card.id] || 0;
              return (
                <Card
                  key={card.id}
                  className="flex flex-col justify-between hover:shadow-md transition-all border-l-4 border-l-primary/80 cursor-pointer"
                  onClick={() => setSelectedCard(card)}
                >
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base font-semibold">{card.label}</CardTitle>
                        <p className="text-xs text-muted-foreground capitalize font-medium">{card.brand}</p>
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px] bg-background">Final {card.due_day}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="mb-4 mt-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Fatura Atual</p>
                      <p className="text-2xl font-bold text-primary">R$ {billValue.toFixed(2)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-muted/40 p-2 rounded border border-border/50">
                      <div>
                        <span className="text-muted-foreground block">Fecha dia</span>
                        <span className="font-bold text-foreground">{card.closing_day}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Vence dia</span>
                        <span className="font-bold text-foreground">{card.due_day}</span>
                      </div>
                    </div>
                  </CardContent>
                </button>
              );
            })}
            
            {/* Add Card Button */}
            <Link to="/personal/cards" className="flex flex-col items-center justify-center border border-dashed rounded-lg h-full min-h-[180px] hover:bg-muted/30 hover:border-primary/50 transition-all group cursor-pointer bg-muted/5">
              <div className="h-10 w-10 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center mb-2 transition-colors">
                <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </div>
              <span className="text-sm font-medium text-muted-foreground group-hover:text-primary">Adicionar Cartão</span>
            </Link>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 border-b bg-muted/5">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Últimos Lançamentos</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            {billInstallments.slice(0, 5).map((i: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center py-3 hover:bg-muted/10 px-2 -mx-2 transition-colors rounded-sm">
                <div className="min-w-0 pr-4 flex flex-col">
                  <span className="text-sm font-medium truncate text-foreground/90">{i.expenses?.title}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted inline-block w-fit px-1.5 rounded-sm mt-0.5">
                    {i.expenses?.category}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-sm block">R$ {Number(i.amount).toFixed(2)}</span>
                  <span className="text-[10px] text-muted-foreground">Parc. {i.installment_number}</span>
                </div>
              </div>
            ))}
            {billInstallments.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                <div className="h-1 w-12 bg-border rounded-full opacity-50 mb-1"></div>
                Nenhum lançamento nesta fatura.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedCard} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Fatura - {selectedCard?.label}</DialogTitle>
            <DialogDescription>
              Competência {format(currentDate, "MMMM/yyyy")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total da Fatura</p>
              <p className="text-2xl font-bold text-primary">R$ {selectedCardTotal.toFixed(2)}</p>
            </div>

            <div className="max-h-[360px] overflow-y-auto border rounded-lg divide-y">
              {selectedCardInstallments.map((item: any, index: number) => (
                <div key={`${item.id}-${index}`} className="flex items-center justify-between p-3">
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-medium truncate">{item.expenses?.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.expenses?.category} • Parcela {item.installment_number}
                    </p>
                  </div>
                  <p className="text-sm font-bold">R$ {Number(item.amount).toFixed(2)}</p>
                </div>
              ))}

              {selectedCardInstallments.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum lançamento encontrado para este cartão nesta competência.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
