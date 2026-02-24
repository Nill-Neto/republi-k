import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface PersonalTabProps {
  totalIndividualPending: number;
  individualPending: any[];
  totalPersonalCash: number;
  totalBill: number;
  personalChartData: any[];
  myPersonalExpenses: any[];
  onPayIndividual: () => void;
}

export function PersonalTab({
  totalIndividualPending,
  individualPending,
  totalPersonalCash,
  totalBill,
  personalChartData,
  myPersonalExpenses,
  onPayIndividual,
}: PersonalTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-warning-foreground">Pendências Individuais</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-serif text-warning-foreground">R$ {totalIndividualPending.toFixed(2)}</div>
            {individualPending.length > 0 && (
              <Button variant="outline" size="sm" className="mt-3 w-full border-warning/50 text-warning-foreground hover:bg-warning/20" onClick={onPayIndividual}>
                Ver Detalhes
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gastos à Vista (Ciclo)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-serif">R$ {totalPersonalCash.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Débito, Dinheiro ou Pix</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fatura Atual Estimada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-serif">R$ {totalBill.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Soma de todos os cartões</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        <Card className="md:col-span-8 lg:col-span-8">
          <CardHeader>
            <CardTitle className="text-base">Meus Gastos Individuais</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px] pr-4">
              <div className="space-y-4">
                {myPersonalExpenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">Nenhuma despesa pessoal.</p>
                ) : (
                  myPersonalExpenses.slice(0, 10).map(e => (
                    <div key={e.id} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium">{e.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] h-4 px-1">{e.category}</Badge>
                          <span className="text-xs text-muted-foreground">{format(new Date(e.purchase_date), "dd/MM")} • {e.payment_method === 'credit_card' ? 'Cartão' : 'À vista'}</span>
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

        <Card className="md:col-span-4 lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Categorias</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            {personalChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={personalChartData} layout="vertical" margin={{ left: 5, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 11 }} />
                  <RechartsTooltip cursor={{fill: 'transparent'}} formatter={(v: number) => `R$ ${v.toFixed(2)}`} contentStyle={{ borderRadius: "8px" }} />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem dados</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}