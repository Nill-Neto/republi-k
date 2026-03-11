import { useState, useEffect } from "react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AdminTab } from "@/components/dashboard/AdminTab";

export default function Admin() {
  const { user, membership, isAdmin } = useAuth();
  
  const { data: groupSettings } = useQuery({
    queryKey: ["group-settings", membership?.group_id],
    queryFn: async () => {
      const { data } = await supabase.from("groups").select("closing_day, due_day").eq("id", membership!.group_id).single();
      return data;
    },
    enabled: !!membership?.group_id
  });

  const closingDay = groupSettings?.closing_day || 1;

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  useEffect(() => {
    if (groupSettings) {
      const today = new Date();
      if (today.getDate() >= groupSettings.closing_day) {
        setCurrentDate(addMonths(today, 1));
      } else {
        setCurrentDate(today);
      }
    }
  }, [groupSettings]);

  const cycleStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, closingDay);
  const cycleEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), closingDay);

  const { data: expensesInCycle = [] } = useQuery({
    queryKey: ["expenses-dashboard", membership?.group_id, cycleStart.toISOString(), cycleEnd.toISOString()],
    queryFn: async () => {
      const dbStart = format(cycleStart, "yyyy-MM-dd");
      const dbEnd = format(cycleEnd, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("expenses")
        .select(`
          id, amount, expense_type, title, category, purchase_date,
          expense_splits ( user_id, amount )
        `)
        .eq("group_id", membership!.group_id)
        .gte("purchase_date", dbStart)
        .lt("purchase_date", dbEnd);
      
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!membership?.group_id
  });

  const collectiveExpenses = expensesInCycle.filter(e => e.expense_type === "collective");
  const totalMonthExpenses = collectiveExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const { data: adminData, isLoading } = useQuery({
    queryKey: ["admin-dashboard-data", membership?.group_id, cycleStart.toISOString(), cycleEnd.toISOString()],
    queryFn: async () => {
      if (!isAdmin || !membership?.group_id) return null;

      const dbStart = format(cycleStart, "yyyy-MM-dd");
      const dbEnd = format(cycleEnd, "yyyy-MM-dd");

      const [membersRes, rolesRes, cycleSplitsRes, allPaymentsRes, departuresRes] = await Promise.all([
        supabase.from("group_members").select("user_id, active").eq("group_id", membership.group_id).eq("active", true),
        supabase.from("user_roles").select("user_id, role").eq("group_id", membership.group_id),
        supabase
          .from("expense_splits")
          .select("id, user_id, amount, status, expenses!inner(id, title, description, amount, category, group_id, expense_type, purchase_date)")
          .eq("expenses.group_id", membership.group_id)
          .eq("expenses.expense_type", "collective")
          .gte("expenses.purchase_date", dbStart)
          .lt("expenses.purchase_date", dbEnd),
        supabase.from("payments")
          .select("id, paid_by, amount, expense_split_id, status, notes, created_at, expense_splits(expenses(expense_type))")
          .eq("group_id", membership.group_id)
          .in("status", ["pending", "confirmed"]),
        supabase
          .from("audit_log")
          .select("created_at, details")
          .eq("group_id", membership.group_id)
          .eq("action", "remove_member")
          .gte("created_at", cycleStart.toISOString())
          .lt("created_at", cycleEnd.toISOString())
      ]);

      const cycleSplits = cycleSplitsRes.data || [];
      const allPayments = allPaymentsRes.data || [];
      const cycleLabel = format(currentDate, "MMMM/yyyy", { locale: ptBR });
      const cycleStartMs = cycleStart.getTime();
      const cycleEndMs = cycleEnd.getTime();

      const cycleBalances = (membersRes.data || []).map(m => {
        const userSplits = cycleSplits.filter(s => s.user_id === m.user_id);
        const totalOwed = userSplits.reduce((acc, s) => acc + Number(s.amount), 0);
        
        const linkedPayments = allPayments.filter(p => 
          p.paid_by === m.user_id && 
          p.expense_split_id && 
          userSplits.some(s => s.id === p.expense_split_id)
        );
        
        const bulkPayments = allPayments.filter(p => 
          p.paid_by === m.user_id && 
          !p.expense_split_id &&
          (
            (p.notes && p.notes.includes(cycleLabel)) || 
            (!p.notes && new Date(p.created_at).getTime() >= cycleStartMs && new Date(p.created_at).getTime() <= cycleEndMs + (10 * 86400000))
          )
        );
        
        const totalPaid = [...linkedPayments, ...bulkPayments].reduce((acc, p) => acc + Number(p.amount), 0);
        const paidSplitsTotal = userSplits.reduce((acc, s) => acc + (s.status === 'paid' ? Number(s.amount) : 0), 0);
        const finalPaid = Math.max(totalPaid, paidSplitsTotal);

        return {
           ...m,
           total_owed: totalOwed,
           total_paid: finalPaid,
           balance: finalPaid - totalOwed
        };
      });

      const userIds = membersRes.data?.map(m => m.user_id) ?? [];
      const { data: profiles } = await supabase.from("group_member_profiles").select("id, full_name, avatar_url").eq("group_id", membership.group_id).in("id", userIds);

      const members = cycleBalances.map(m => ({
        ...m,
        profile: profiles?.find(p => p.id === m.user_id),
        role: rolesRes.data?.find(r => r.user_id === m.user_id)?.role ?? 'morador'
      }));

      const pendingPaymentsCount = allPayments.filter(p => {
         if (p.status !== 'pending') return false;
         if (!p.expense_split_id) return true;
         return p.expense_splits?.expenses?.expense_type === 'collective';
      }).length;

      const departuresCount = (departuresRes.data || []).length;
      const redistributedCount = (departuresRes.data || []).reduce((sum: number, log: any) => {
        const value = Number(log?.details?.redistributed_pending_splits || 0);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);

      let exMembersDebt = 0;
      if (collectiveExpenses.length > 0) {
        const { data: exMembersSplits } = await supabase
          .from("expense_splits")
          .select("id, user_id, amount")
          .eq("status", "pending")
          .in("expense_id", collectiveExpenses.map(e => e.id));
          
        const activeUserIds = new Set(members.map(m => m.user_id));
        exMembersDebt = (exMembersSplits || [])
          .filter((s: any) => !activeUserIds.has(s.user_id))
          .reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);
      }

      return {
        members,
        pendingPaymentsCount,
        exMembersDebt,
        departuresCount,
        redistributedCount,
        cycleSplits,
      };
    },
    enabled: !!membership?.group_id && !!collectiveExpenses && isAdmin
  });

  if (!membership) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return <div className="p-8 text-center text-foreground">Acesso restrito a administradores.</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8 pt-24 space-y-8 animate-fade-in relative z-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Administração</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Gerenciamento e visão geral da república
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Carregando dados administrativos...</div>
      ) : adminData ? (
        <AdminTab 
          members={adminData.members} 
          pendingPaymentsCount={adminData.pendingPaymentsCount}
          collectiveExpenses={collectiveExpenses}
          totalMonthExpenses={totalMonthExpenses}
          cycleStart={cycleStart}
          cycleEnd={cycleEnd}
          currentDate={currentDate}
          exMembersDebt={adminData.exMembersDebt}
          departuresCount={adminData.departuresCount}
          redistributedCount={adminData.redistributedCount}
          cycleSplits={adminData.cycleSplits}
          closingDay={closingDay}
        />
      ) : null}
    </div>
  );
}
