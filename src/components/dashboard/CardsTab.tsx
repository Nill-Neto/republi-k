import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, CreditCard, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const CHART_COLORS = ["#0f172a", "#0d9488", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];

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
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-primary text-primary-foreground md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary-foreground/80">Total em Faturas</CardTitle>
            <Wallet className="h-4 w-4 text-primary-foreground/60" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-serif">R$ {totalBill.toFixed(2)}</div>
            <p className="text-xs text-primary-foreground/60 mt-1">Referente a {format(currentDate, "MMM/yyyy")}</p>
            <Button variant="secondary" size="sm" className="mt-4 w-full" asChild>
              <Link to="/personal/bills">Ver Extrato Completo</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Composição</CardTitle>
          </CardHeader>
          <CardContent className="h-[160px]">
            {cardsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cardsChartData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} interval={0} />
                  <RechartsTooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} cursor={{fill: 'transparent'}} />
                  <Bar dataKey="value" fill="#64748b" radius={[0, 4, 4, 0]} barSize={15} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Fatura zerada</div>}
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-serif mb-4 flex items-center gap-2">
          <CreditCard className="h-5 w-5" /> Meus Cartões
        </h3>
        
        {creditCards.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 flex flex-col items-center justify-center text-center">
              <CreditCard className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground mb-4">Nenhum cartão cadastrado.</p>
              <Button variant="outline" asChild><Link to="/personal/cards">Cadastrar Cartão</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {creditCards.map(card => {
              const billValue = cardsBreakdown[card.id] || 0;
              return (
                <Card key={card.id} className="flex flex-col justify-between">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{card.label}</CardTitle>
                        <p className="text-xs text-muted-foreground capitalize">{card.brand}</p>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs">Final {card.due_day}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Fatura Atual</p>
                      <p className="text-2xl font-bold font-serif">R$ {billValue.toFixed(2)}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs border-t pt-3">
                      <div>
                        <span className="text-muted-foreground block">Fecha dia</span>
                        <span className="font-medium">{card.closing_day}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Vence dia</span>
                        <span className="font-medium">{card.due_day}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {/* Add Card Button */}
            <Link to="/personal/cards" className="flex flex-col items-center justify-center border border-dashed rounded-lg h-full min-h-[180px] hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
              <Plus className="h-8 w-8 mb-2 opacity-50" />
              <span className="text-sm font-medium">Novo Cartão</span>
            </Link>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base font-medium">Lançamentos na Fatura</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {billInstallments.slice(0, 5).map((i: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-sm border-b pb-2 last:border-0">
                <div className="min-w-0 pr-2">
                  <p className="font-medium truncate">{i.expenses?.title}</p>
                  <p className="text-xs text-muted-foreground">{i.expenses?.category}</p>
                </div>
                <span className="font-bold whitespace-nowrap">R$ {Number(i.amount).toFixed(2)}</span>
              </div>
            ))}
            {billInstallments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum lançamento.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}