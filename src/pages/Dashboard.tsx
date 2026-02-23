import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Receipt, TrendingUp, AlertTriangle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

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
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .eq("group_id", membership!.group_id)
        .gte("created_at", startOfMonth);
      return (data ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
    },
    enabled: !!membership?.group_id,
  });

  const { data: myBalance } = useQuery({
    queryKey: ["my-balance", membership?.group_id, user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_member_balances", {
        _group_id: membership!.group_id,
      });
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

  const balance = myBalance?.balance ?? 0;
  const stats = [
    { label: "Moradores", value: String(memberCount ?? "—"), icon: Users, color: "text-primary" },
    { label: "Despesas do mês", value: `R$ ${(monthExpenses ?? 0).toFixed(2)}`, icon: Receipt, color: "text-accent" },
    {
      label: "Seu saldo",
      value: `R$ ${Math.abs(balance).toFixed(2)}`,
      icon: TrendingUp,
      color: balance >= 0 ? "text-green-600" : "text-destructive",
      suffix: balance < 0 ? " (devendo)" : balance > 0 ? " (em dia)" : "",
    },
    { label: "Pendências", value: String(pendingCount ?? 0), icon: AlertTriangle, color: (pendingCount ?? 0) > 0 ? "text-warning" : "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif">
          Olá, {profile?.full_name?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin ? "Painel do administrador" : "Painel do morador"} — {membership?.group_name}
        </p>
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
              {"suffix" in s && s.suffix && (
                <p className={`text-xs ${s.color}`}>{s.suffix}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

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
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(e.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
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
