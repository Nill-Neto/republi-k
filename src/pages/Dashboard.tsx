import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Users, CreditCard, Shield } from "lucide-react";
import { format, subDays, isAfter, isSameDay, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { RepublicTab } from "@/components/dashboard/RepublicTab";
import { PersonalTab } from "@/components/dashboard/PersonalTab";
import { CardsTab } from "@/components/dashboard/CardsTab";
import { AdminTab } from "@/components/dashboard/AdminTab";
import { PaymentDialogs } from "@/components/dashboard/PaymentDialogs";
import { getCategoryLabel } from "@/constants/categories";

export default function Dashboard() {
  const { profile, membership, user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  
  // Payment State
  const [payRateioOpen, setPayRateioOpen] = useState(false);
  const [payIndividualOpen, setPayIndividualOpen] = useState(false);
  const [selectedIndividualSplit, setSelectedIndividualSplit] = useState<any>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // --- Group Settings & Initial Date Logic ---
  const { data: groupSettings } = useQuery({
    queryKey: ["group-settings-dashboard", membership?.group_id],
    queryFn: async () => {
      const { data } = await supabase.from("groups").select("closing_day, due_day").eq("id", membership!.group_id).single();
      return data;
    },
    enabled: !!membership?.group_id
  });

  const closingDay = groupSettings?.closing_day || 1;
  const dueDay = groupSettings?.due_day || 10;

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
  
  const cycleDueDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dueDay);
  const cycleLimitDate = subDays(cycleDueDate, 1);
  const isLate = isAfter(now, cycleLimitDate) && !isSameDay(now, cycleLimitDate);

  // --- Queries ---

  const { data: expensesInCycle = [] } = useQuery({
    queryKey: ["expenses-dashboard", membership?.group_id, cycleStart.toISOString(), cycleEnd.toISOString()],
    queryFn: async () => {
      const dbStart = format(cycleStart, "yyyy-MM-dd");
      const dbEnd = format(cycleEnd, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("expenses")
        .select(`
          *,
          expense_splits (
            user_id,
            amount
          )
        `)
        .eq("group_id", membership!.group_id)
        .gte("purchase_date", dbStart)
        .lt("purchase_date", dbEnd);
      
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!membership?.group_id
  });

  const { data: pendingSplits = [] } = useQuery({
    queryKey: ["my-pending-splits", membership?.group_id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_splits")
        .select("id, amount, status, expense_id, expenses:expense_id(title, category, group_id, expense_type, created_at, purchase_date)")
        .eq("user_id", user!.id)
        .eq("status", "pending");
      if (error) throw error;
      return (data ?? []).filter((s: any) => s.expenses?.group_id === membership!.group_id);
    },
    enabled: !!membership?.group_id && !!user?.id,
  });

  const { data: creditCards = [] } = useQuery({
    queryKey: ["my-credit-cards", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("credit_cards").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: billInstallments = [] } = useQuery({
    queryKey: ["bill-installments-dashboard", user?.id, currentDate.getMonth(), currentDate.getFullYear()],
    queryFn: async () => {
      const targetMonth = currentDate.getMonth() + 1; 
      const targetYear = currentDate.getFullYear();

      const { data } = await supabase
        .from("expense_installments" as any)
        .select("amount, expenses(title, category, credit_card_id)")
        .eq("user_id", user!.id)
        .eq("bill_month", targetMonth)
        .eq("bill_year", targetYear);

      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: adminData } = useQuery({
    queryKey: ["admin-dashboard-data", membership?.group_id],
    queryFn: async () => {
      if (!isAdmin || !membership?.group_id) return null;

      const [membersRes, balancesRes, pendingPaymentsRes, rolesRes] = await Promise.all([
        supabase.from("group_members").select("user_id, active").eq("group_id", membership.group_id).eq("active", true),
        supabase.rpc("get_member_balances", { _group_id: membership.group_id }),
        supabase.from("payments")
          .select("id, expense_split_id, expense_splits(expenses(expense_type))")
          .eq("group_id", membership.group_id)
          .eq("status", "pending"),
        supabase.from("user_roles").select("user_id, role").eq("group_id", membership.group_id)
      ]);

      const userIds = membersRes.data?.map(m => m.user_id) ?? [];
      const { data: profiles } = await supabase.from("group_member_profiles").select("id, full_name, avatar_url").eq("group_id", membership.group_id).in("id", userIds);

      const members = membersRes.data?.map(m => ({
        ...m,
        profile: profiles?.find(p => p.id === m.user_id),
        role: rolesRes.data?.find(r => r.user_id === m.user_id)?.role ?? 'morador'
      })) ?? [];

      const pendingCollectiveCount = (pendingPaymentsRes.data || []).filter((p: any) => {
        if (!p.expense_split_id) return true;
        const type = p.expense_splits?.expenses?.expense_type;
        return type === 'collective';
      }).length;

      return {
        members,
        balances: balancesRes.data ?? [],
        pendingPaymentsCount: pendingCollectiveCount
      };
    },
    enabled: !!membership?.group_id && isAdmin
  });

  // --- Data Processing ---

  const collectiveExpenses = expensesInCycle.filter(e => e.expense_type === "collective");
  const totalMonthExpenses = collectiveExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  
  const myCollectiveShare = collectiveExpenses.reduce((sum, e) => {
    const splits = (e.expense_splits as unknown as { user_id: string; amount: number }[]) || [];
    const mySplit = splits.find((s) => s.user_id === user?.id);
    return sum + (mySplit ? Number(mySplit.amount) : 0);
  }, 0);

  const republicChartData = useMemo(() => {
    const categories: Record<string, number> = {};
    collectiveExpenses.forEach(e => {
      const label = getCategoryLabel(e.category);
      categories[label] = (categories[label] || 0) + Number(e.amount);
    });
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [collectiveExpenses]);

  const myPersonalExpenses = expensesInCycle.filter(e => e.created_by === user?.id && e.expense_type === "individual");
  
  const totalPersonalCash = myPersonalExpenses
    .filter(e => e.payment_method !== "credit_card")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalPersonalCredit = myPersonalExpenses
    .filter(e => e.payment_method === "credit_card")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalBill = billInstallments.reduce((sum: number, i: any) => sum + Number(i.amount), 0);

  const totalUserExpenses = myCollectiveShare + totalPersonalCredit;

  const personalChartData = useMemo(() => {
    const categories: Record<string, number> = {};
    myPersonalExpenses.forEach(e => {
      const label = getCategoryLabel(e.category);
      categories[label] = (categories[label] || 0) + Number(e.amount);
    });
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [myPersonalExpenses]);

  const filteredPendingSplits = pendingSplits.filter((s: any) => {
    // Show all pending splits regardless of date, or filter by logic if needed
    // Usually pending debts are relevant until paid
    return true; 
  });

  const collectivePending = filteredPendingSplits.filter((s: any) => s.expenses?.expense_type === "collective");
  const individualPending = filteredPendingSplits.filter((s: any) => s.expenses?.expense_type === "individual");
  const totalCollectivePending = collectivePending.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
  const totalIndividualPending = individualPending.reduce((sum: number, s: any) => sum + Number(s.amount), 0);

  const cardsBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    creditCards.forEach(c => map[c.id] = 0);
    billInstallments.forEach((i: any) => {
      const cId = i.expenses?.credit_card_id;
      if (cId && map[cId] !== undefined) {
        map[cId] += Number(i.amount);
      }
    });
    return map;
  }, [creditCards, billInstallments]);

  const cardsChartData = useMemo(() => {
    const categories: Record<string, number> = {};
    billInstallments.forEach((i: any) => {
      const rawCat = i.expenses?.category || "other";
      const label = getCategoryLabel(rawCat);
      categories[label] = (categories[label] || 0) + Number(i.amount);
    });
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [billInstallments]);


  const handlePayRateio = async () => {
    if (!receiptFile) return;
    setSaving(true);
    try {
      const ext = receiptFile.name.split(".").pop();
      const path = `${user!.id}/${Date.now()}_rateio.${ext}`;
      await supabase.storage.from("receipts").upload(path, receiptFile);
      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);

      await supabase.from("payments").insert({
        group_id: membership!.group_id,
        expense_split_id: null,
        paid_by: user!.id,
        amount: totalCollectivePending,
        receipt_url: urlData.publicUrl,
        notes: `Pagamento de Rateio - ${format(currentDate, "MMMM/yyyy", { locale: ptBR })}`
      });

      toast({ title: "Pagamento enviado!" });
      queryClient.invalidateQueries({ queryKey: ["my-pending-splits"] });
      setPayRateioOpen(false);
      setReceiptFile(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePayIndividual = async () => {
    if (!receiptFile || !selectedIndividualSplit) return;
    setSaving(true);
    try {
      const ext = receiptFile.name.split(".").pop();
      const path = `${user!.id}/${Date.now()}_indiv.${ext}`;
      await supabase.storage.from("receipts").upload(path, receiptFile);
      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);

      await supabase.from("payments").insert({
        group_id: membership!.group_id,
        expense_split_id: selectedIndividualSplit.id,
        paid_by: user!.id,
        amount: Number(selectedIndividualSplit.amount),
        receipt_url: urlData.publicUrl,
        notes: `Pagamento individual: ${selectedIndividualSplit.expenses?.title}`
      });

      toast({ title: "Pagamento individual enviado!" });
      queryClient.invalidateQueries({ queryKey: ["my-pending-splits"] });
      setPayIndividualOpen(false);
      setSelectedIndividualSplit(null);
      setReceiptFile(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <DashboardHeader 
        userName={profile?.full_name}
        groupName={membership?.group_name}
        currentDate={currentDate}
        cycleStart={cycleStart}
        cycleEnd={cycleEnd}
        cycleLimitDate={cycleLimitDate}
        onNextMonth={() => setCurrentDate(addMonths(currentDate, 1))}
        onPrevMonth={() => setCurrentDate(subMonths(currentDate, 1))}
      />

      <Tabs defaultValue={isAdmin ? "admin" : "republic"} className="space-y-6">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
          {isAdmin && (
            <TabsTrigger value="admin" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 transition-all hover:text-primary">
              <Shield className="h-4 w-4 mr-2" /> Administração
            </TabsTrigger>
          )}
          <TabsTrigger value="republic" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 transition-all hover:text-primary">
            <Users className="h-4 w-4 mr-2" /> República
          </TabsTrigger>
          <TabsTrigger value="personal" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 transition-all hover:text-primary">
            <User className="h-4 w-4 mr-2" /> Pessoal
          </TabsTrigger>
          <TabsTrigger value="cards" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 transition-all hover:text-primary">
            <CreditCard className="h-4 w-4 mr-2" /> Cartões
          </TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="admin" className="space-y-6">
            {adminData ? (
           <AdminTab 
                memberBalances={adminData.balances} 
                members={adminData.members} 
                pendingPaymentsCount={adminData.pendingPaymentsCount}
                collectiveExpenses={collectiveExpenses}
                totalMonthExpenses={totalMonthExpenses}
                cycleStart={cycleStart}
                cycleEnd={cycleEnd}
                currentDate={currentDate}
              />
            ) : (
              <div className="py-12 text-center text-muted-foreground">Carregando dados administrativos...</div>
            )}
          </TabsContent>
        )}

        <TabsContent value="republic" className="space-y-6">
          <RepublicTab
            collectiveExpenses={collectiveExpenses}
            totalMonthExpenses={totalMonthExpenses}
            republicChartData={republicChartData}
            totalCollectivePending={totalCollectivePending}
            isLate={isLate}
            onPayRateio={() => setPayRateioOpen(true)}
          />
        </TabsContent>

        <TabsContent value="personal" className="space-y-6">
          <PersonalTab
            totalIndividualPending={totalIndividualPending}
            totalCollectivePending={totalCollectivePending} // Adicionado
            individualPending={individualPending}
            totalPersonalCash={totalPersonalCash}
            totalBill={totalBill}
            totalUserExpenses={totalUserExpenses}
            myCollectiveShare={myCollectiveShare}
            personalChartData={personalChartData}
            myPersonalExpenses={myPersonalExpenses}
          />
        </TabsContent>

        <TabsContent value="cards" className="space-y-6">
          <CardsTab 
            totalBill={totalBill}
            currentDate={currentDate}
            cardsChartData={cardsChartData}
            creditCards={creditCards}
            cardsBreakdown={cardsBreakdown}
            billInstallments={billInstallments}
          />
        </TabsContent>
      </Tabs>

      <PaymentDialogs
        payRateioOpen={payRateioOpen}
        setPayRateioOpen={setPayRateioOpen}
        payIndividualOpen={payIndividualOpen}
        setPayIndividualOpen={setPayIndividualOpen}
        selectedIndividualSplit={selectedIndividualSplit}
        setSelectedIndividualSplit={setSelectedIndividualSplit}
        totalCollectivePending={totalCollectivePending}
        collectivePending={collectivePending}
        individualPending={individualPending}
        currentDate={currentDate}
        onPayRateio={handlePayRateio}
        onPayIndividual={handlePayIndividual}
        saving={saving}
        receiptFile={receiptFile}
        setReceiptFile={setReceiptFile}
      />
    </div>
  );
}