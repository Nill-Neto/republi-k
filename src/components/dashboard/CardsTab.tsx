import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, CreditCard, Plus, PieChart as PieChartIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CHART_COLORS, CATEGORY_COLORS } from "@/constants/categories";

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
          <CardContent className="h-[200px] flex items-center justify-center">
            {cardsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cardsChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {cardsChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(v: number) => `R$ ${v.toFixed(2)}`}
                    contentStyle={{ 
                      borderRadius: "8px", 
                      border: "1px solid #e2e8f0", 
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      fontSize: "12px"
                    }}
                    itemStyle={{ color: "#1e293b" }}
                  />
                  <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground text-sm opacity-60">
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
                <Card key={card.id} className="flex flex-col justify-between hover:shadow-md transition-all border-l-4 border-l-primary/80">
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
                </Card>
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
    </div>
  );
}