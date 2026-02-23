import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Calendar, ArrowRight, BarChart3 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#0f172a", "#0d9488", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function PersonalDashboard() {
  const { user } = useAuth();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // 1. Fetch Individual Expenses (this month)
  const { data: expenses = [] } = useQuery({
    queryKey: ["personal-expenses-month", user?.id],
    queryFn: async () => {
      const start = startOfMonth(now).toISOString();
      const end = endOfMonth(now).toISOString();
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("created_by", user!.id)
        .eq("expense_type", "individual")
        .gte("purchase_date", start)
        .lte("purchase_date", end);
      return (data as any[]) ?? [];
    },
    enabled: !!user,
  });

  // 2. Fetch Installments for current month
  const { data: installments = [] } = useQuery({
    queryKey: ["personal-installments-month", user?.id, currentMonth, currentYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("expense_installments" as any)
        .select("*, expenses(title)")
        .eq("user_id", user!.id)
        .eq("bill_month", currentMonth)
        .eq("bill_year", currentYear);
      return (data as any[]) ?? [];
    },
    enabled: !!user,
  });

  // 3. Fetch shared pending
  const { data: sharedPending = [] } = useQuery({
    queryKey: ["my-shared-pending", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("expense_splits")
        .select("amount")
        .eq("user_id", user!.id)
        .eq("status", "pending");
      return (data as any[]) ?? [];
    },
    enabled: !!user,
  });

  const totalPersonal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalBill = installments.reduce((sum, i) => sum + Number(i.amount), 0);
  const totalShared = sharedPending.reduce((sum, s) => sum + Number(s.amount), 0);

  const methodData = Object.entries(
    expenses.reduce((acc: any, e) => {
      const method = (e as any).payment_method || 'cash';
      acc[method] = (acc[method] || 0) + Number(e.amount);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif">Meu Financeiro</h1>
          <p className="text-muted-foreground mt-1">Gastos individuais e faturas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/expenses"><Calendar className="h-4 w-4 mr-2" /> Todas Despesas</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/personal/bills"><CreditCard className="h-4 w-4 mr-2" /> Minhas Faturas</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary-foreground/70">Fatura deste mês</CardDescription>
            <CardTitle className="text-3xl font-serif">R$ {totalBill.toFixed(2)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-primary-foreground/60 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Competência: {format(now, "MMMM", { locale: ptBR })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Individuais (Mês atual)</CardDescription>
            <CardTitle className="text-3xl font-serif">R$ {totalPersonal.toFixed(2)}</CardTitle>
          </CardHeader>
          <CardContent>
             <Progress value={Math.min(100, (totalPersonal / 2000) * 100)} className="h-1" />
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-destructive">Rateio Coletivo Pendente</CardDescription>
            <CardTitle className="text-3xl font-serif text-destructive">R$ {totalShared.toFixed(2)}</CardTitle>
          </CardHeader>
          <CardContent>
             <Link to="/payments" className="text-xs font-medium text-destructive hover:underline flex items-center gap-1">
               Ir para pagamentos <ArrowRight className="h-3 w-3" />
             </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader><CardTitle className="text-lg font-serif">Distribuição de Gastos</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              {methodData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={methodData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {methodData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Sem gastos individuais este mês.</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg font-serif">Próximas Parcelas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {installments.slice(0, 5).map((i: any) => (
                <div key={i.id} className="flex items-center justify-between">
                  <div className="min-w-0"><p className="text-sm font-medium truncate">{i.expenses?.title}</p></div>
                  <p className="text-sm font-bold shrink-0">R$ {Number(i.amount).toFixed(2)}</p>
                </div>
              ))}
              {installments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma parcela futura.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}