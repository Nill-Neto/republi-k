import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, DollarSign, TrendingUp, Users, Wallet, CheckCircle2, List, Receipt } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { ptBR } from "date-fns/locale";
import { CHART_COLORS, CATEGORY_COLORS, getCategoryLabel } from "@/constants/categories";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PersonalTabProps {
  totalIndividualPending: number;
  totalCollectivePendingPrevious: number;
  totalCollectivePendingCurrent: number;
  collectivePendingPreviousByCompetence: {
    competence: string;
    total: number;
    items: any[];
  }[];
  collectivePendingCurrent: any[];
  individualPending: any[];
  totalPersonalCash: number;
  totalBill: number;
  totalUserExpenses: number;
  myCollectiveShare: number;
  personalChartData: any[];
  myPersonalExpenses: any[];
}

export function PersonalTab({
  totalIndividualPending,
  totalCollectivePendingPrevious,
  totalCollectivePendingCurrent,
  collectivePendingPreviousByCompetence,
  collectivePendingCurrent,
  individualPending,
  totalPersonalCash,
  totalBill,
  totalUserExpenses,
  myCollectiveShare,
  personalChartData,
  myPersonalExpenses,
}: PersonalTabProps) {
  const totalSpentCompetence = totalUserExpenses + totalPersonalCash;

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPreviousCollectiveOpen, setIsPreviousCollectiveOpen] = useState(false);
  const [isCurrentCollectiveOpen, setIsCurrentCollectiveOpen] = useState(false);
  const [isCashDetailOpen, setIsCashDetailOpen] = useState(false);

  const cashExpenses = myPersonalExpenses.filter((e: any) => e.payment_method !== 'credit_card');

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Comprometido (Mês) */}
        <Card className="border-l-4 border-l-primary bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Comprometido</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">R$ {totalUserExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Meu Rateio + Gastos Pessoais.</p>
          </CardContent>
        </Card>

        {/* Rateio pendente (competências anteriores) */}
        <Card className={`border-l-4 ${totalCollectivePendingPrevious > 0 ? "border-l-destructive" : "border-l-success"} bg-card shadow-sm`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rateio Pendente (Anteriores)
            </CardTitle>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${totalCollectivePendingPrevious > 0 ? "bg-destructive/10" : "bg-success/10"}`}>
              <Users className={`h-4 w-4 ${totalCollectivePendingPrevious > 0 ? "text-destructive" : "text-success"}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalCollectivePendingPrevious > 0 ? "text-destructive" : "text-foreground"}`}>
              R$ {totalCollectivePendingPrevious.toFixed(2)}
            </div>
            {totalCollectivePendingPrevious > 0 ? (
              <p className="text-xs text-muted-foreground mt-1">Apenas competências anteriores.</p>
            ) : (
              <p className="text-xs text-success mt-1 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Sem pendências anteriores.
              </p>
            )}
            {collectivePendingPreviousByCompetence.length > 0 && (
              <Dialog open={isPreviousCollectiveOpen} onOpenChange={setIsPreviousCollectiveOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-2 h-7 text-xs gap-1.5">
                    <List className="h-3 w-3" /> Ver detalhamento
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]">
                  <DialogHeader className="px-5 pt-5 pb-4 shrink-0">
                    <DialogTitle className="text-lg font-semibold text-foreground">
                      Rateio Pendente
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">Competências anteriores ao ciclo vigente</p>
                  </DialogHeader>

                  <div className="mx-5 mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Total pendente</span>
                    <span className="text-lg font-bold text-destructive tabular-nums">
                      R$ {totalCollectivePendingPrevious.toFixed(2)}
                    </span>
                  </div>

                  <div className="border-t">
                    <div className="overflow-y-auto max-h-[50vh]">
                      <div className="divide-y">
                        {collectivePendingPreviousByCompetence.map((group) => (
                          <div key={group.competence} className="px-5 py-4 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-foreground">
                                Competência {group.competence}
                              </p>
                              <Badge variant="secondary" className="font-semibold text-xs">
                                R$ {group.total.toFixed(2)}
                              </Badge>
                            </div>

                            <div className="space-y-1.5">
                              {group.items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
                                  <div className="min-w-0 pr-4">
                                    <p className="text-sm font-medium truncate text-foreground">
                                      {item.expenses?.title || "Despesa sem título"}
                                    </p>
                                    <Badge variant="outline" className="text-xs h-5 px-2 font-normal mt-1">
                                      {getCategoryLabel(item.expenses?.category)}
                                    </Badge>
                                  </div>
                                  <span className="text-sm font-semibold tabular-nums whitespace-nowrap text-foreground">
                                    R$ {Number(item.amount).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        {/* Rateio em aberto (competência atual) */}
        <Card className={`border-l-4 ${totalCollectivePendingCurrent > 0 ? "border-l-warning" : "border-l-muted"} bg-card shadow-sm`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rateio em Aberto (Atual)
            </CardTitle>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${totalCollectivePendingCurrent > 0 ? "bg-warning/10" : "bg-muted"}`}>
              <Users className={`h-4 w-4 ${totalCollectivePendingCurrent > 0 ? "text-warning" : "text-muted-foreground"}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalCollectivePendingCurrent > 0 ? "text-warning" : "text-foreground"}`}>
              R$ {totalCollectivePendingCurrent.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Somente itens da competência vigente.</p>
            {collectivePendingCurrent.length > 0 && (
              <Dialog open={isCurrentCollectiveOpen} onOpenChange={setIsCurrentCollectiveOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-2 h-7 text-xs gap-1.5">
                    <List className="h-3 w-3" /> Ver itens atuais ({collectivePendingCurrent.length})
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]">
                  <DialogHeader className="px-5 pt-5 pb-4 shrink-0">
                    <DialogTitle className="text-lg font-semibold text-foreground">
                      Rateio em Aberto
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">Competência vigente</p>
                  </DialogHeader>

                  <div className="mx-5 mb-4 rounded-lg bg-warning/10 border border-warning/20 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Total em aberto</span>
                    <span className="text-lg font-bold text-warning tabular-nums">
                      R$ {totalCollectivePendingCurrent.toFixed(2)}
                    </span>
                  </div>

                  <div className="border-t">
                    <div className="overflow-y-auto max-h-[50vh]">
                      <div className="divide-y">
                        {collectivePendingCurrent.map((item) => (
                          <div key={item.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                            <div className="min-w-0 pr-4">
                              <p className="text-sm font-medium truncate text-foreground">
                                {item.expenses?.title || "Despesa sem título"}
                              </p>
                              <Badge variant="outline" className="text-xs h-5 px-2 font-normal mt-1">
                                {getCategoryLabel(item.expenses?.category)}
                              </Badge>
                            </div>
                            <span className="font-semibold text-sm tabular-nums whitespace-nowrap text-foreground">
                              R$ {Number(item.amount).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        {/* Pendências Individuais */}
        <Card className="border-l-4 border-l-muted bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendências Individuais
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              R$ {totalIndividualPending.toFixed(2)}
            </div>
            
            {individualPending.length > 0 ? (
              <div className="mt-2">
                <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="mt-1 h-7 text-xs gap-1.5">
                      <List className="h-3 w-3" /> Ver lista ({individualPending.length})
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]">
                    <DialogHeader className="px-5 pt-5 pb-4 shrink-0">
                      <DialogTitle className="text-lg font-semibold text-foreground">
                        Controle Individual
                      </DialogTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">Despesas pessoais de acompanhamento próprio</p>
                    </DialogHeader>

                    <div className="mx-5 mb-4 rounded-lg bg-muted/60 border border-border px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Total pendente</span>
                      <span className="text-lg font-bold text-foreground tabular-nums">
                        R$ {totalIndividualPending.toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="border-t">
                      <div className="overflow-y-auto max-h-[50vh]">
                        <div className="divide-y">
                          {individualPending.map((item) => (
                            <div key={item.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                              <div className="min-w-0 pr-4">
                                <p className="text-sm font-medium truncate text-foreground">{item.expenses?.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs h-5 px-2 font-normal">
                                    {getCategoryLabel(item.expenses?.category)}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {item.expenses?.purchase_date ? format(parseLocalDate(item.expenses.purchase_date), "dd/MM/yyyy") : "Data n/d"}
                                  </span>
                                </div>
                              </div>
                              <span className="font-semibold text-sm tabular-nums whitespace-nowrap text-foreground">
                                R$ {Number(item.amount).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="px-5 py-3 bg-muted/30 border-t text-center shrink-0">
                      <p className="text-xs text-muted-foreground">
                        Controle próprio — não envolve o grupo.
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Nenhum controle pendente.</p>
            )}
          </CardContent>
        </Card>

        {/* Gastos à Vista */}
        <Card className="border-l-4 border-l-secondary bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gastos à Vista</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
              <DollarSign className="h-4 w-4 text-secondary-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totalPersonalCash.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Dinheiro, Pix ou Débito.</p>
            {cashExpenses.length > 0 && (
              <Dialog open={isCashDetailOpen} onOpenChange={setIsCashDetailOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-2 h-7 text-xs gap-1.5">
                    <List className="h-3 w-3" /> Ver itens ({cashExpenses.length})
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]">
                  <DialogHeader className="px-5 pt-5 pb-4 shrink-0">
                    <DialogTitle className="text-lg font-semibold text-foreground">
                      Gastos à Vista
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">Dinheiro, Pix e Débito</p>
                  </DialogHeader>

                  <div className="mx-5 mb-4 rounded-lg bg-secondary/50 border border-border px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Total</span>
                    <span className="text-lg font-bold text-foreground tabular-nums">
                      R$ {totalPersonalCash.toFixed(2)}
                    </span>
                  </div>

                  <div className="border-t">
                    <div className="overflow-y-auto max-h-[50vh]">
                      <div className="divide-y">
                        {cashExpenses.map((e: any) => {
                          const methodMap: Record<string, string> = { cash: "Dinheiro", pix: "Pix", debit: "Débito" };
                          return (
                            <div key={e.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                              <div className="min-w-0 pr-4">
                                <p className="text-sm font-medium truncate text-foreground">{e.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs h-5 px-2 font-normal">
                                    {getCategoryLabel(e.category)}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {e.purchase_date ? format(parseLocalDate(e.purchase_date), "dd/MM/yyyy") : ""} · {methodMap[e.payment_method] || e.payment_method}
                                  </span>
                                </div>
                              </div>
                              <span className="font-semibold text-sm tabular-nums whitespace-nowrap text-foreground">
                                R$ {Number(e.amount).toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        {/* Total Gasto na Competência */}
        <Card className="border-l-4 border-l-success bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Gasto (Competência)</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
              <Receipt className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">R$ {totalSpentCompetence.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Comprometido + À Vista.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Despesas Individuais (Competência)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                {myPersonalExpenses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-10 text-muted-foreground">
                    <p className="text-sm">Nenhuma despesa individual nesta competência.</p>
                  </div>
                ) : (
                  [...myPersonalExpenses].sort((a, b) => parseLocalDate(b.purchase_date).getTime() - parseLocalDate(a.purchase_date).getTime()).map(e => (
                    <div key={e.id} className="flex items-center justify-between border-b border-border/40 pb-3 last:border-0 last:pb-0 hover:bg-muted/30 p-2 rounded-md transition-colors">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">{e.title}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs h-5 px-2 font-normal">
                            {getCategoryLabel(e.category)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(parseLocalDate(e.purchase_date), "dd/MM")} · {e.payment_method === 'credit_card' ? 'Cartão' : 'À vista'}
                          </span>
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

        <Card className="lg:col-span-4 flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">Categorias (Pessoal)</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px]">
            {personalChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={personalChartData} 
                  margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10, fill: "#64748b" }} 
                    axisLine={false} 
                    tickLine={false} 
                    interval={0}
                  />
                  <YAxis hide />
                  <RechartsTooltip 
                    cursor={{fill: 'transparent'}} 
                    formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Valor']}
                    contentStyle={{ 
                      borderRadius: "8px", 
                      border: "1px solid #e2e8f0", 
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      fontSize: "12px"
                    }} 
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                     {personalChartData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || CHART_COLORS[index % CHART_COLORS.length]} />
                     ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                <span className="opacity-50">Sem dados para exibir</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
