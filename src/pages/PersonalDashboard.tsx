import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Calendar, ArrowRight } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { getCategoryLabel, CHART_COLORS } from "@/constants/categories";
import { PageHero } from "@/components/layout/PageHero";

export default function PersonalDashboard() {
  const { user } = useAuth();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // 1. Fetch Cards (for closing dates)
  const { data: cards = [], isSuccess: cardsLoaded } = useQuery({
    queryKey: ["credit-cards", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("credit_cards").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  // 2. Fetch Open Bill Installments (Smart Calculation)
  const { data: openBillItems = [] } = useQuery({
    queryKey: ["personal-open-bill-items", user?.id, currentMonth, currentYear, cards],
    queryFn: async () => {
      if (cards.length === 0) return [];
      
      let nextMonth = currentMonth + 1;
      let nextYear = currentYear;
      if (nextMonth > 12) { nextMonth = 1; nextYear++; }

      const { data } = await supabase
        .from("expense_installments" as any)
        .select("*, expenses!inner(title, credit_card_id)")
        .eq("user_id", user!.id)
        .or(`and(bill_month.eq.${currentMonth},bill_year.eq.${currentYear}),and(bill_month.eq.${nextMonth},bill_year.eq.${nextYear})`);

      // Filter: Only keep items that belong to the OPEN bill of their respective card
      return ((data as any[]) ?? []).filter((item) => {
        const card = cards.find((c: any) => c.id === item.expenses?.credit_card_id);
        if (!card) return false;

        const today = new Date();
        let targetM = today.getMonth() + 1;
        let targetY = today.getFullYear();
        if (today.getDate() >= card.closing_day) {
           targetM++;
           if (targetM > 12) { targetM = 1; targetY++; }
        }
        return item.bill_month === targetM && item.bill_year === targetY;
      });
    },
    enabled: !!user && cardsLoaded,
  });

  // 3. Fetch Individual Expenses (Cash/Debit/Pix) this month
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
        .neq("payment_method", "credit_card") // Exclude credit card (handled above)
        .gte("purchase_date", start)
        .lte("purchase_date", end);
      return (data as any[]) ?? [];
    },
    enabled: !!user,
  });

  // 4. Fetch shared pending
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

  const totalBill = openBillItems.reduce((sum, i) => sum + Number(i.amount), 0);
  const totalPersonalCash = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalShared = sharedPending.reduce((sum, s) => sum + Number(s.amount), 0);
  
  // Total spending graph (Cash + Bill)
  const totalSpending = totalPersonalCash + totalBill;

  // Chart Data
  const methodData = [
    { name: "Fatura Aberta", value: totalBill },
    ...Object.entries(
      expenses.reduce((acc: any, e) => {
        // Here we map payment methods to friendly names
        const methodMap: Record<string, string> = { cash: "Dinheiro", pix: "Pix", debit: "Débito" };
        const rawMethod = (e as any).payment_method || 'cash';
        const method = methodMap[rawMethod] || rawMethod;
        
        acc[method] = (acc[method] || 0) + Number(e.amount);
        return acc;
      }, {})
    ).map(([name, value]) => ({ name, value: Number(value) }))
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      <PageHero
        title="Meu Financeiro"
        subtitle="Gastos individuais e faturas."
        icon={<CreditCard className="h-4 w-4" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/expenses"><Calendar className="h-4 w-4 mr-2" /> Todas Despesas</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary-foreground/70">Fatura Atual (Aberta)</CardDescription>
            <CardTitle className="text-3xl font-bold">R$ {totalBill.toFixed(2)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-primary-foreground/60 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Competência Vigente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gastos à Vista (Mês)</CardDescription>
            <CardTitle className="text-3xl font-bold">R$ {totalPersonalCash.toFixed(2)}</CardTitle>
          </CardHeader>
          <CardContent>
             <Progress value={Math.min(100, (totalPersonalCash / (totalSpending || 1)) * 100)} className="h-1" />
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-destructive">Rateio Coletivo Pendente</CardDescription>
            <CardTitle className="text-3xl font-bold text-destructive">R$ {totalShared.toFixed(2)}</CardTitle>
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
          <CardHeader><CardTitle className="text-lg font-bold">Distribuição de Gastos</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              {methodData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={methodData} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60} 
                      outerRadius={80} 
                      paddingAngle={5} 
                      dataKey="value"
                      stroke="none"
                    >
                      {methodData.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Sem gastos individuais este mês.</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Lançamentos na Fatura Aberta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {openBillItems.slice(0, 5).map((i: any) => (
                <div key={i.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{i.expenses?.title}</p>
                    <p className="text-[10px] text-muted-foreground">Parc. {i.installment_number}</p>
                  </div>
                  <p className="text-sm font-bold shrink-0">R$ {Number(i.amount).toFixed(2)}</p>
                </div>
              ))}
              {openBillItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma parcela na fatura aberta.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}