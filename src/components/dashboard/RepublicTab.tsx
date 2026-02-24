import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Receipt, DollarSign, Package, AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

const CHART_COLORS = ["#0f172a", "#0d9488", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];

interface RepublicTabProps {
  collectiveExpenses: any[];
  totalMonthExpenses: number;
  republicChartData: any[];
  totalCollectivePending: number;
  isLate: boolean;
  onPayRateio: () => void;
}

export function RepublicTab({
  collectiveExpenses,
  totalMonthExpenses,
  republicChartData,
  totalCollectivePending,
  isLate,
  onPayRateio,
}: RepublicTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* KPI Cards */}
        <Card className={`col-span-1 lg:col-span-2 relative overflow-hidden transition-all ${isLate && totalCollectivePending > 0 ? "border-destructive bg-destructive/5" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Meu Rateio (Pendente)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-serif text-foreground">R$ {totalCollectivePending.toFixed(2)}</div>
            {isLate && totalCollectivePending > 0 && (
              <p className="text-xs text-destructive font-bold mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3"/> Pagamento em Atraso
              </p>
            )}
            {totalCollectivePending > 0 && (
              <Button className="mt-4 w-full sm:w-auto" variant={isLate ? "destructive" : "default"} onClick={onPayRateio}>
                Realizar Pagamento
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total da Casa</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-serif">R$ {totalMonthExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Soma de todas despesas coletivas</p>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estoque Crítico</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-serif">--</div>
            <Button variant="link" className="h-auto p-0 text-xs text-primary mt-1" asChild>
              <Link to="/inventory">Ver estoque →</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Chart */}
        <Card className="md:col-span-4 lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            {republicChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={republicChartData} 
                    dataKey="value" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={50} 
                    outerRadius={70} 
                    paddingAngle={3}
                    stroke="none"
                  >
                    {republicChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(v: number) => `R$ ${v.toFixed(2)}`} 
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  />
                  <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: "11px", marginLeft: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
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
                            {e.category} • {format(new Date(e.purchase_date), "dd MMM")}
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