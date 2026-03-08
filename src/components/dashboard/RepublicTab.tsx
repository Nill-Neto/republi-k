import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Receipt, DollarSign, Package, AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { CHART_COLORS, CATEGORY_COLORS } from "@/constants/categories";
import { parseLocalDate } from "@/lib/utils";

interface RepublicTabProps {
  collectiveExpenses: any[];
  totalMonthExpenses: number;
  republicChartData: any[];
  totalCollectivePendingPrevious: number;
  totalCollectivePendingCurrent: number;
  isLate: boolean;
  onPayRateio: (scope: "previous" | "current") => void;
}

export function RepublicTab({
  collectiveExpenses,
  totalMonthExpenses,
  republicChartData,
  totalCollectivePendingPrevious,
  totalCollectivePendingCurrent,
  isLate,
  onPayRateio,
}: RepublicTabProps) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* KPI Cards */}
        <Card className={`col-span-1 lg:col-span-2 relative overflow-hidden border-l-4 ${isLate && totalCollectivePendingPrevious > 0 ? "border-l-destructive" : "border-l-primary"} bg-card shadow-sm`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Meu Rateio (Pendente)</CardTitle>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isLate && totalCollectivePendingPrevious > 0 ? "bg-destructive/10" : "bg-primary/10"}`}>
              <DollarSign className={`h-4 w-4 ${isLate && totalCollectivePendingPrevious > 0 ? "text-destructive" : "text-primary"}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">R$ {totalCollectivePendingPrevious.toFixed(2)}</div>
            {totalCollectivePendingCurrent > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Competência atual: R$ {totalCollectivePendingCurrent.toFixed(2)}
              </p>
            )}
            {isLate && totalCollectivePendingPrevious > 0 && (
              <p className="text-xs text-destructive font-bold mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3"/> Pagamento em Atraso
              </p>
            )}
            {(totalCollectivePendingPrevious > 0 || totalCollectivePendingCurrent > 0) && (
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                {totalCollectivePendingPrevious > 0 && (
                  <Button className="w-full sm:w-auto" variant={isLate ? "destructive" : "default"} onClick={() => onPayRateio("previous")}>
                    Pagar competências anteriores
                  </Button>
                )}
                {totalCollectivePendingCurrent > 0 && (
                  <Button className="w-full sm:w-auto" variant="outline" onClick={() => onPayRateio("current")}>
                    Pagar competência atual
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 border-l-4 border-l-secondary bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total da Casa</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
              <Receipt className="h-4 w-4 text-secondary-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">R$ {totalMonthExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Soma de todas despesas coletivas</p>
          </CardContent>
        </Card>

        <Card className="col-span-1 border-l-4 border-l-warning bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estoque Crítico</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/10">
              <Package className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">--</div>
            <Button variant="link" className="h-auto p-0 text-xs text-primary mt-1" asChild>
              <Link to="/inventory">Ver estoque →</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-12">
        {/* Chart */}
        <Card className="md:col-span-4 lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] relative">
            {republicChartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={republicChartData} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60} 
                      outerRadius={80} 
                      paddingAngle={5}
                      stroke="none"
                      cornerRadius={5}
                    >
                      {republicChartData.map((entry, i) => (
                        <Cell 
                          key={i} 
                          fill={CATEGORY_COLORS[entry.name] || CHART_COLORS[i % CHART_COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(v: number) => `R$ ${v.toFixed(2)}`} 
                      contentStyle={{ 
                        borderRadius: "8px", 
                        border: "none", 
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        fontSize: "12px"
                      }}
                      itemStyle={{ color: "#1e293b" }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Label */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                  <span className="text-xs text-muted-foreground block">Total</span>
                  <span className="text-lg font-bold">R$ {totalMonthExpenses.toFixed(0)}</span>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                <span className="opacity-50">Sem dados no período</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* List */}
        <Card className="md:col-span-8 lg:col-span-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Últimas Despesas Coletivas</CardTitle>
            <Link to="/expenses" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px] pr-4">
              <div className="space-y-4">
                {collectiveExpenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">Nenhuma despesa registrada.</p>
                ) : (
                  collectiveExpenses.slice(0, 10).map(e => (
                    <div key={e.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <Receipt className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">{e.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {e.category} • {format(parseLocalDate(e.purchase_date), "dd MMM")}
                          </p>
                        </div>
                      </div>
                      <span className="font-semibold text-sm">R$ {Number(e.amount).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}