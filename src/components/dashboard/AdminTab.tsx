import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { parseLocalDate } from "@/lib/utils";
import {
  Users, ArrowRight, RefreshCw, DollarSign, AlertTriangle,
  TrendingUp, Receipt, Settings, ClipboardList, BarChart3,
  CheckCircle2, Clock, ChevronRight, FileText, UserPlus, Scale, UserMinus,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCategoryLabel } from "@/constants/categories";
import { useMemo } from "react";

interface AdminTabProps {
  memberBalances: any[];
  members: any[];
  pendingPaymentsCount: number;
  collectiveExpenses: any[];
  totalMonthExpenses: number;
  cycleStart: Date;
  cycleEnd: Date;
  currentDate: Date;
  exMembersDebt: number;
  departuresCount: number;
  redistributedCount: number;
}

export function AdminTab({
  memberBalances,
  members,
  pendingPaymentsCount,
  collectiveExpenses,
  totalMonthExpenses,
  cycleStart,
  cycleEnd,
  currentDate,
  exMembersDebt,
  departuresCount,
  redistributedCount,
}: AdminTabProps) {
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
    queryClient.invalidateQueries({ queryKey: ["expenses-dashboard"] });
  };

  const membersWithBalance = useMemo(() =>
    members.map(m => {
      const bal = memberBalances.find(b => b.user_id === m.user_id);
      return {
        ...m,
        balance: bal ? Number(bal.balance) : 0,
        total_owed: bal ? Number(bal.total_owed) : 0,
        total_paid: bal ? Number(bal.total_paid) : 0,
      };
    }).sort((a, b) => a.balance - b.balance),
    [members, memberBalances]
  );

  const totalReceivable = membersWithBalance.reduce(
    (acc, m) => acc + (m.balance < -0.01 ? Math.abs(m.balance) : 0), 0
  );

  const membersInDebt = membersWithBalance.filter(m => m.balance < -0.05);
  const collectRate = members.length > 0
    ? Math.round(((members.length - membersInDebt.length) / members.length) * 100)
    : 100;

  const recentExpenses = useMemo(() =>
    [...collectiveExpenses]
      .sort((a, b) => parseLocalDate(b.purchase_date).getTime() - parseLocalDate(a.purchase_date).getTime())
      .slice(0, 6),
    [collectiveExpenses]
  );

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    collectiveExpenses.forEach(e => {
      const label = getCategoryLabel(e.category);
      map[label] = (map[label] || 0) + Number(e.amount);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [collectiveExpenses]);

  const cycleLabel = format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Quick Actions - moved to top */}
      <Card>
        <CardContent className="p-0">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x">
            <QuickActionLink to="/expenses" icon={ClipboardList} label="Gerenciar Despesas" desc="Lançar e editar despesas coletivas" />
            <QuickActionLink to="/payments?filter=pending" icon={DollarSign} label="Confirmar Pagamentos" desc="Aprovar ou recusar comprovantes" />
            <QuickActionLink to="/members" icon={Users} label="Moradores" desc="Gerenciar membros do grupo" />
            <QuickActionLink to="/recurring-expenses" icon={RefreshCw} label="Despesas Recorrentes" desc="Contas fixas e assinaturas" />
            <QuickActionLink to="/invites" icon={UserPlus} label="Convites" desc="Convidar novos moradores" />
            <QuickActionLink to="/group-settings" icon={Settings} label="Configurações" desc="Regras de rateio e ciclo" />
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Despesas do Ciclo */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Despesas do Ciclo
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              R$ {totalMonthExpenses.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {collectiveExpenses.length} lançamento{collectiveExpenses.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        {/* Total a Receber */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total a Receber
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold tabular-nums ${totalReceivable > 0 ? "text-destructive" : "text-foreground"}`}>
              R$ {totalReceivable.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {membersInDebt.length} pendência{membersInDebt.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        {/* Pagamentos Pendentes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              A Confirmar
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{pendingPaymentsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingPaymentsCount > 0 ? "Aguardando sua ação" : "Nenhum pendente"}
            </p>
            {pendingPaymentsCount > 0 && (
              <Button variant="link" className="p-0 h-auto text-xs mt-1 text-warning" asChild>
                <Link to="/payments?filter=pending">Confirmar <ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Taxa de Adimplência */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Adimplência
            </CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{collectRate}%</div>
            <Progress value={collectRate} className="h-1.5 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {members.length - membersInDebt.length}/{members.length} em dia
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Movimentações de Moradores */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Ex-moradores com débito
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold tabular-nums ${exMembersDebt > 0 ? "text-destructive" : "text-foreground"}`}>
              R$ {exMembersDebt.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pendências abertas fora dos ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Redistribuições no ciclo
            </CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{redistributedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Splits redistribuídos por saídas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Saídas no período
            </CardTitle>
            <UserMinus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{departuresCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Eventos auditados de remoção</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Saldo dos Moradores - 2 cols */}
        <Dialog>
          <DialogTrigger asChild>
            <Card className="lg:col-span-2 cursor-pointer transition-colors hover:bg-muted/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" /> Saldo dos Moradores
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-normal">
                    {members.length} ativo{members.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Saldo acumulado do rateio coletivo · Ordenado por situação
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {membersWithBalance.map(member => {
                    const isDebt = member.balance < -0.05;
                    const isCredit = member.balance > 0.05;

                    return (
                      <div
                        key={member.user_id}
                        className={`flex items-center justify-between px-6 py-3 transition-colors hover:bg-muted/50 ${isDebt ? "bg-destructive/5" : ""}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-9 w-9 border border-border">
                            <AvatarImage src={member.profile?.avatar_url} />
                            <AvatarFallback className="text-xs font-medium bg-muted">
                              {member.profile?.full_name?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{member.profile?.full_name}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground capitalize">
                                {member.role === "admin" ? "Admin" : "Morador"}
                              </span>
                              {isDebt && (
                                <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                                  Pendente
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0 ml-4">
                          {isDebt ? (
                            <span className="font-semibold text-sm tabular-nums text-destructive">
                              -R$ {Math.abs(member.balance).toFixed(2)}
                            </span>
                          ) : isCredit ? (
                            <span className="font-semibold text-sm tabular-nums text-success">
                              +R$ {member.balance.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              Em dia
                            </span>
                          )}
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            Rateio: R$ {member.total_owed.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {membersWithBalance.length === 0 && (
                    <p className="text-sm text-muted-foreground px-6 py-8 text-center">
                      Nenhum morador encontrado.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </DialogTrigger>

          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhamento do saldo dos moradores</DialogTitle>
            </DialogHeader>

            <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
              {membersWithBalance.map(member => {
                const isDebt = member.balance < -0.05;
                const isCredit = member.balance > 0.05;

                return (
                  <div key={`modal-${member.user_id}`} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">{member.profile?.full_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {member.role === "admin" ? "Admin" : "Morador"}
                        </p>
                      </div>
                      <span className={`font-semibold text-sm tabular-nums ${isDebt ? "text-destructive" : isCredit ? "text-success" : "text-foreground"}`}>
                        {isDebt ? "-" : isCredit ? "+" : ""}R$ {Math.abs(member.balance).toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <p>Rateio: <span className="tabular-nums text-foreground">R$ {member.total_owed.toFixed(2)}</span></p>
                      <p>Pago: <span className="tabular-nums text-foreground">R$ {member.total_paid.toFixed(2)}</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Categoria de Despesas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoryBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem despesas neste ciclo.</p>
              ) : (
                <div className="space-y-3">
                  {categoryBreakdown.map(cat => {
                    const pct = totalMonthExpenses > 0
                      ? Math.round((cat.value / totalMonthExpenses) * 100)
                      : 0;
                    return (
                      <div key={cat.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="truncate">{cat.name}</span>
                          <span className="font-medium tabular-nums ml-2">
                            R$ {cat.value.toFixed(2)}
                          </span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Últimas Despesas */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> Recentes
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link to="/expenses">Ver todas</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground px-6 pb-4">Nenhuma despesa neste ciclo.</p>
              ) : (
                <div className="divide-y">
                  {recentExpenses.map(expense => (
                    <div key={expense.id} className="flex items-center justify-between px-6 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{expense.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {getCategoryLabel(expense.category)} · {format(parseLocalDate(expense.purchase_date), "dd/MM")}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums flex-shrink-0 ml-3">
                        R$ {Number(expense.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  );
}

function QuickActionLink({ to, icon: Icon, label, desc }: { to: string; icon: any; label: string; desc: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-6 py-4 hover:bg-muted/50 transition-colors group">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium group-hover:text-primary transition-colors">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{desc}</p>
      </div>
    </Link>
  );
}
