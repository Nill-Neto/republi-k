import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  Users, ArrowRight, RefreshCw, DollarSign, AlertTriangle,
  TrendingUp, Receipt, Settings, ClipboardList, BarChart3,
  CheckCircle2, Clock, XCircle, ChevronRight
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCategoryLabel } from "@/constants/categories";
import { Separator } from "@/components/ui/separator";

interface AdminTabProps {
  memberBalances: any[];
  members: any[];
  pendingPaymentsCount: number;
  collectiveExpenses: any[];
  totalMonthExpenses: number;
  cycleStart: Date;
  cycleEnd: Date;
  currentDate: Date;
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
}: AdminTabProps) {
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
    queryClient.invalidateQueries({ queryKey: ["expenses-dashboard"] });
  };

  const membersWithBalance = members.map(m => {
    const bal = memberBalances.find(b => b.user_id === m.user_id);
    return {
      ...m,
      balance: bal ? Number(bal.balance) : 0,
      total_owed: bal ? Number(bal.total_owed) : 0,
      total_paid: bal ? Number(bal.total_paid) : 0,
    };
  });

  const totalReceivable = membersWithBalance.reduce(
    (acc, m) => acc + (m.balance < -0.01 ? Math.abs(m.balance) : 0), 0
  );

  const membersInDebt = membersWithBalance.filter(m => m.balance < -0.05);
  const membersUpToDate = membersWithBalance.filter(m => m.balance >= -0.05);

  const recentExpenses = [...collectiveExpenses]
    .sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime())
    .slice(0, 5);

  const cycleLabel = format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Painel Administrativo</h2>
          <p className="text-sm text-muted-foreground capitalize">
            Ciclo: {cycleLabel}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="h-8 text-xs gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <CardHeader className="pb-2 pl-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Despesas do Ciclo
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pl-5">
            <div className="text-2xl font-bold tabular-nums">
              R$ {totalMonthExpenses.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {collectiveExpenses.length} despesa{collectiveExpenses.length !== 1 ? "s" : ""} coletiva{collectiveExpenses.length !== 1 ? "s" : ""}
            </p>
            <Button variant="link" className="p-0 h-auto text-xs mt-2" asChild>
              <Link to="/expenses">Ver despesas <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-destructive" />
          <CardHeader className="pb-2 pl-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Total a Receber
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pl-5">
            <div className={`text-2xl font-bold tabular-nums ${totalReceivable > 0 ? "text-destructive" : "text-foreground"}`}>
              R$ {totalReceivable.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {membersInDebt.length} morador{membersInDebt.length !== 1 ? "es" : ""} com pendência
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-1 h-full ${pendingPaymentsCount > 0 ? "bg-yellow-500" : "bg-muted"}`} />
          <CardHeader className="pb-2 pl-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Pagamentos Pendentes
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pl-5">
            <div className="text-2xl font-bold tabular-nums">{pendingPaymentsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Aguardando confirmação</p>
            {pendingPaymentsCount > 0 && (
              <Button variant="link" className="p-0 h-auto text-xs mt-2" asChild>
                <Link to="/payments?filter=pending">Confirmar agora <ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Members Balance - takes 3 cols */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Saldo dos Moradores
              </CardTitle>
              <Badge variant="outline" className="text-xs font-normal">
                {members.length} membro{members.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Saldo acumulado do rateio coletivo</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {membersWithBalance
                .sort((a, b) => a.balance - b.balance)
                .map(member => (
                <div key={member.user_id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.profile?.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {member.profile?.full_name?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{member.profile?.full_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {member.role === "admin" ? "Administrador" : "Morador"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    {member.balance < -0.05 ? (
                      <div className="flex items-center gap-1.5 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span className="font-semibold text-sm tabular-nums">
                          -R$ {Math.abs(member.balance).toFixed(2)}
                        </span>
                      </div>
                    ) : member.balance > 0.05 ? (
                      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-500">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span className="font-semibold text-sm tabular-nums">
                          +R$ {member.balance.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-sm">Em dia</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right column - Recent expenses + Quick actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Collective Expenses */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> Últimas Despesas
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground px-6 pb-4">
                  Nenhuma despesa coletiva neste ciclo.
                </p>
              ) : (
                <div className="divide-y">
                  {recentExpenses.map(expense => (
                    <div key={expense.id} className="flex items-center justify-between px-6 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{expense.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {getCategoryLabel(expense.category)} · {format(new Date(expense.purchase_date), "dd/MM")}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums flex-shrink-0 ml-3">
                        R$ {Number(expense.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {collectiveExpenses.length > 5 && (
                <div className="px-6 py-2 border-t">
                  <Button variant="link" className="p-0 h-auto text-xs" asChild>
                    <Link to="/expenses">Ver todas ({collectiveExpenses.length}) <ArrowRight className="h-3 w-3 ml-1" /></Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" /> Ações Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                <Link to="/expenses" className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Gerenciar Despesas</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
                <Link to="/payments" className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Gerenciar Pagamentos</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
                <Link to="/members" className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Gerenciar Moradores</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
                <Link to="/recurring-expenses" className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Despesas Recorrentes</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
                <Link to="/group-settings" className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Configurações do Grupo</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
