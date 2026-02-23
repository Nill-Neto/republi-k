import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Receipt, TrendingUp, AlertTriangle, Download, Package } from "lucide-react";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const CATEGORY_LABELS: Record<string, string> = {
  rent: "Aluguel", utilities: "Contas", groceries: "Mercado", cleaning: "Limpeza",
  maintenance: "Manutenção", internet: "Internet", other: "Outros",
};
const COLORS = ["hsl(220,65%,18%)", "hsl(164,55%,36%)", "hsl(38,92%,50%)", "hsl(0,72%,51%)", "hsl(270,50%,50%)", "hsl(200,60%,40%)", "hsl(30,70%,50%)"];

export default function Dashboard() {
  const { profile, membership, isAdmin, user } = useAuth();

  const { data: memberCount } = useQuery({
    queryKey: ["member-count", membership?.group_id],
    queryFn: async () => {
      const { count } = await supabase
        .from("group_members")
        .select("*", { count: "exact", head: true })
        .eq("group_id", membership!.group_id)
        .eq("active", true);
      return count ?? 0;
    },
    enabled: !!membership?.group_id,
  });

  const { data: monthExpenses } = useQuery({
    queryKey: ["month-expenses", membership?.group_id],
    queryFn: async () => {
      const now = new Date();
      const startOfM = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .eq("group_id", membership!.group_id)
        .gte("created_at", startOfM);
      return (data ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
    },
    enabled: !!membership?.group_id,
  });

  const { data: myBalance } = useQuery({
    queryKey: ["my-balance", membership?.group_id, user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_member_balances", { _group_id: membership!.group_id });
      const mine = (data as any[])?.find((b: any) => b.user_id === user!.id);
      return mine ?? { total_owed: 0, total_paid: 0, balance: 0 };
    },
    enabled: !!membership?.group_id && !!user?.id,
  });

  const { data: pendingCount } = useQuery({
    queryKey: ["pending-count", membership?.group_id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("expense_splits")
        .select("id, expenses:expense_id(group_id)")
        .eq("user_id", user!.id)
        .eq("status", "pending");
      return (data ?? []).filter((s: any) => s.expenses?.group_id === membership!.group_id).length;
    },
    enabled: !!membership?.group_id && !!user?.id,
  });

  const { data: recentExpenses } = useQuery({
    queryKey: ["recent-expenses", membership?.group_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("id, title, amount, category, created_at, expense_type")
        .eq("group_id", membership!.group_id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!membership?.group_id,
  });

  // Category breakdown for pie chart
  const { data: categoryData } = useQuery({
    queryKey: ["expense-categories", membership?.group_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("category, amount")
        .eq("group_id", membership!.group_id);
      const map: Record<string, number> = {};
      (data ?? []).forEach((e) => {
        map[e.category] = (map[e.category] || 0) + Number(e.amount);
      });
      return Object.entries(map).map(([name, value]) => ({
        name: CATEGORY_LABELS[name] || name,
        value: Math.round(value * 100) / 100,
      }));
    },
    enabled: !!membership?.group_id,
  });

  // Monthly bar chart (last 6 months)
  const { data: monthlyData } = useQuery({
    queryKey: ["monthly-expenses", membership?.group_id],
    queryFn: async () => {
      const now = new Date();
      const sixMonthsAgo = subMonths(startOfMonth(now), 5).toISOString();
      const { data } = await supabase
        .from("expenses")
        .select("amount, created_at")
        .eq("group_id", membership!.group_id)
        .gte("created_at", sixMonthsAgo);
      const map: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(now, i);
        map[format(d, "MMM/yy", { locale: ptBR })] = 0;
      }
      (data ?? []).forEach((e) => {
        const key = format(new Date(e.created_at), "MMM/yy", { locale: ptBR });
        if (key in map) map[key] += Number(e.amount);
      });
      return Object.entries(map).map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }));
    },
    enabled: !!membership?.group_id,
  });

  // Low stock count
  const { data: lowStockCount } = useQuery({
    queryKey: ["low-stock-count", membership?.group_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_items")
        .select("id, quantity, min_quantity")
        .eq("group_id", membership!.group_id);
      return (data ?? []).filter((i) => Number(i.quantity) <= Number(i.min_quantity)).length;
    },
    enabled: !!membership?.group_id,
  });

  const balance = myBalance?.balance ?? 0;

  const exportCSV = () => {
    if (!recentExpenses) return;
    // fetch all for export
    supabase
      .from("expenses")
      .select("title, amount, category, expense_type, created_at, due_date")
      .eq("group_id", membership!.group_id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const header = "Título,Valor,Categoria,Tipo,Data,Vencimento\n";
        const rows = data.map((e) =>
          `"${e.title}",${e.amount},"${CATEGORY_LABELS[e.category] || e.category}","${e.expense_type === "collective" ? "Coletiva" : "Individual"}","${format(new Date(e.created_at), "dd/MM/yyyy")}","${e.due_date || ""}"`
        ).join("\n");
        const blob = new Blob([header + rows], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `despesas-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const stats = [
    { label: "Moradores", value: String(memberCount ?? "—"), icon: Users, color: "text-primary" },
    { label: "Despesas do mês", value: `R$ ${(monthExpenses ?? 0).toFixed(2)}`, icon: Receipt, color: "text-accent" },
    {
      label: "Seu saldo",
      value: `R$ ${Math.abs(balance).toFixed(2)}`,
      icon: TrendingUp,
      color: balance >= 0 ? "text-success" : "text-destructive",
      suffix: balance < 0 ? " (devendo)" : balance > 0 ? " (em dia)" : "",
    },
    { label: "Pendências", value: String(pendingCount ?? 0), icon: AlertTriangle, color: (pendingCount ?? 0) > 0 ? "text-warning" : "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif">Olá, {profile?.full_name?.split(" ")[0]}</h1>
          <p className="text-muted-foreground mt-1">{isAdmin ? "Painel do administrador" : "Painel do morador"} — {membership?.group_name}</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-sm">{s.label}</CardDescription>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-serif">{s.value}</p>
              {"suffix" in s && s.suffix && <p className={`text-xs ${s.color}`}>{s.suffix}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {(lowStockCount ?? 0) > 0 && (
        <Link to="/inventory">
          <Card className="border-warning/50 bg-warning/5 cursor-pointer hover:border-warning transition-colors">
            <CardContent className="flex items-center gap-3 py-3">
              <Package className="h-5 w-5 text-warning" />
              <p className="text-sm"><strong>{lowStockCount}</strong> {lowStockCount === 1 ? "item" : "itens"} com estoque baixo</p>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-serif text-lg">Despesas por Categoria</CardTitle></CardHeader>
          <CardContent>
            {(categoryData?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {categoryData?.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-serif text-lg">Despesas Mensais</CardTitle></CardHeader>
          <CardContent>
            {(monthlyData?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent expenses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-serif text-xl">Últimas Despesas</CardTitle>
          <Link to="/expenses" className="text-sm text-primary hover:underline">Ver todas →</Link>
        </CardHeader>
        <CardContent>
          {(recentExpenses?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma despesa registrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {recentExpenses?.map((e) => (
                <div key={e.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(e.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium font-serif">R$ {Number(e.amount).toFixed(2)}</p>
                    <Badge variant={e.expense_type === "collective" ? "default" : "secondary"} className="text-xs">
                      {e.expense_type === "collective" ? "Coletiva" : "Individual"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
