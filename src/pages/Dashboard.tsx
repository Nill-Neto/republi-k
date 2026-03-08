import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Users, CreditCard, Shield } from "lucide-react";
import { format, subDays, isAfter, isSameDay, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { parseLocalDate } from "@/lib/utils";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { RepublicTab } from "@/components/dashboard/RepublicTab";
import { PersonalTab } from "@/components/dashboard/PersonalTab";
import { CardsTab } from "@/components/dashboard/CardsTab";
import { AdminTab } from "@/components/dashboard/AdminTab";
import { PaymentDialogs, type RateioScope } from "@/components/dashboard/PaymentDialogs";
import { getCategoryLabel } from "@/constants/categories";
import { useLocation } from "react-router-dom";

export default function Dashboard() {
  const { profile, membership, user, isAdmin } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const now = new Date();
  const isPersonalFinancePage = location.pathname === "/personal/financas";
  
  // Payment State
  const [payRateioOpen, setPayRateioOpen] = useState(false);
  const [payIndividualOpen, setPayIndividualOpen] = useState(false);
  const [selectedIndividualSplit, setSelectedIndividualSplit] = useState<any>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [rateioScope, setRateioScope] = useState<RateioScope>("previous");
  const [activeTab, setActiveTab] = useState(isPersonalFinancePage ? "personal" : (isAdmin ? "admin" : "republic"));
  const [heroCompact, setHeroCompact] = useState(false);

  useEffect(() => {
    if (isPersonalFinancePage) {
      setActiveTab("personal");
    } else {
      setActiveTab(isAdmin ? "admin" : "republic");
    }
  }, [isPersonalFinancePage, isAdmin]);

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
        .select("id, amount, status, expense_id, expenses:expense_id(title, category, group_id, expense_type, created_at, purchase_date, payment_method, credit_card_id, credit_cards:credit_card_id(closing_day))")
        .eq("user_id", user!.id)
        .eq("status", "pending");
      if (error) throw error;
      return (data ?? []).filter((s: any) => s.expenses?.group_id === membership!.group_id);
    },
    enabled: !!membership?.group_id && !!user?.id,
  });

  const collectivePendingExpenseIds = useMemo(() => {
    return [...new Set(
      pendingSplits
        .filter((s: any) => s.expenses?.expense_type === "collective")
        .map((s: any) => s.expense_id)
        .filter(Boolean)
    )];
  }, [pendingSplits]);

  const { data: collectiveInstallments = [] } = useQuery({
    queryKey: ["collective-installments-dashboard", collectivePendingExpenseIds],
    queryFn: async () => {
      if (collectivePendingExpenseIds.length === 0) return [];
      const { data, error } = await supabase
        .from("expense_installments" as any)
        .select("expense_id, installment_number, bill_month, bill_year")
        .in("expense_id", collectivePendingExpenseIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: collectivePendingExpenseIds.length > 0,
  });

  const { data: creditCards = [], isLoading: isLoadingCreditCards } = useQuery({
    queryKey: ["my-credit-cards", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("credit_cards").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: billInstallments = [], isLoading: isLoadingBillInstallments } = useQuery({
    queryKey: ["bill-installments-dashboard", user?.id, currentDate.getMonth(), currentDate.getFullYear()],
    queryFn: async () => {
      const targetMonth = currentDate.getMonth() + 1; 
      const targetYear = currentDate.getFullYear();

      const [groupRes, personalRes] = await Promise.all([
        supabase
          .from("expense_installments" as any)
          .select("id, amount, installment_number, expenses(title, category, credit_card_id, expense_type, purchase_date, installments)")
          .eq("user_id", user!.id)
          .eq("bill_month", targetMonth)
          .eq("bill_year", targetYear)
          .limit(1000),
        supabase
          .from("personal_expense_installments")
          .select("id, amount, installment_number, personal_expenses(title, credit_card_id, purchase_date, installments)")
          .eq("user_id", user!.id)
          .eq("bill_month", targetMonth)
          .eq("bill_year", targetYear)
          .limit(1000),
      ]);

      const groupItems = (groupRes.data as any[] ?? []);
      const personalItems = (personalRes.data as any[] ?? []).map((p: any) => ({
        ...p,
        expenses: {
          title: p.personal_expenses?.title,
          category: "other",
          credit_card_id: p.personal_expenses?.credit_card_id,
          expense_type: "personal",
          purchase_date: p.personal_expenses?.purchase_date,
          installments: p.personal_expenses?.installments ?? 1,
        },
      }));

      return [...groupItems, ...personalItems];
    },
    enabled: !!user,
  });

  const { data: adminData } = useQuery({
    queryKey: ["admin-dashboard-data", membership?.group_id],
    queryFn: async () => {
      if (!isAdmin || !membership?.group_id) return null;

      const [membersRes, balancesRes, pendingPaymentsRes, rolesRes, pendingCollectiveSplitsRes, departuresRes] = await Promise.all([
        supabase.from("group_members").select("user_id, active").eq("group_id", membership.group_id).eq("active", true),
        supabase.rpc("get_member_balances", { _group_id: membership.group_id }),
        supabase.from("payments")
          .select("id, expense_split_id, expense_splits(expenses(expense_type))")
          .eq("group_id", membership.group_id)
          .eq("status", "pending"),
        supabase.from("user_roles").select("user_id, role").eq("group_id", membership.group_id),
        supabase
          .from("expense_splits")
          .select("user_id, amount, status, expenses!inner(group_id, expense_type)")
          .eq("status", "pending")
          .eq("expenses.group_id", membership.group_id)
          .eq("expenses.expense_type", "collective"),
        supabase
          .from("audit_log")
          .select("created_at, details")
          .eq("group_id", membership.group_id)
          .eq("action", "remove_member")
          .gte("created_at", cycleStart.toISOString())
          .lt("created_at", cycleEnd.toISOString())
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

      const activeUserIds = new Set(members.map((m) => m.user_id));
      const exMembersDebt = (pendingCollectiveSplitsRes.data || [])
        .filter((s: any) => !activeUserIds.has(s.user_id))
        .reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);

      const departuresCount = (departuresRes.data || []).length;
      const redistributedCount = (departuresRes.data || []).reduce((sum: number, log: any) => {
        const value = Number(log?.details?.redistributed_pending_splits || 0);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);

      return {
        members,
        balances: balancesRes.data ?? [],
        pendingPaymentsCount: pendingCollectiveCount,
        exMembersDebt,
        departuresCount,
        redistributedCount,
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

  const totalBill = billInstallments.reduce((sum: number, i: any) => sum + Number(i.amount), 0);

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

  // Filtering Logic for Pending Splits (Debts)
  
  // 1. Collective Debt (Rateio Pendente)
  const currentCompetenceKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

  const getCompetenceKeyFromPurchaseDate = (purchaseDate?: string | null) => {
    if (!purchaseDate) return null;

    const [yearRaw, monthRaw, dayRaw] = purchaseDate.split("-");
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);

    if (!year || !month || !day) return null;

    let competenceYear = year;
    let competenceMonth = month;

    if (day >= closingDay) {
      competenceMonth += 1;
      if (competenceMonth > 12) {
        competenceMonth = 1;
        competenceYear += 1;
      }
    }

    return `${competenceYear}-${String(competenceMonth).padStart(2, "0")}`;
  };

  const collectivePending = pendingSplits
    .filter((s: any) => s.expenses?.expense_type === "collective")
    .map((split: any) => ({
      ...split,
      competenceKey: getCompetenceKeyFromPurchaseDate(split.expenses?.purchase_date),
    }));

  const collectivePendingCurrent = collectivePending.filter((s: any) => s.competenceKey === currentCompetenceKey);
  const collectivePendingPrevious = collectivePending.filter((s: any) => !s.competenceKey || s.competenceKey < currentCompetenceKey);
  const totalCollectivePendingPrevious = collectivePendingPrevious.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
  const totalCollectivePendingCurrent = collectivePendingCurrent.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
  const collectivePendingPreviousByCompetence = useMemo(() => {
    const grouped = collectivePendingPrevious.reduce((acc: Record<string, any[]>, item: any) => {
      const purchaseDate = item.expenses?.purchase_date ? parseLocalDate(item.expenses.purchase_date) : null;
      const competence = purchaseDate ? format(purchaseDate, "MM/yyyy") : "Sem competência";
      if (!acc[competence]) acc[competence] = [];
      acc[competence].push(item);
      return acc;
    }, {} as Record<string, any[]>);

    return Object.entries(grouped)
      .map(([competence, items]: [string, any[]]) => ({
        competence,
        items,
        total: items.reduce((sum: number, split: any) => sum + Number(split.amount), 0),
      }))
      .sort((a, b) => {
        const [monthA, yearA] = a.competence.split("/").map(Number);
        const [monthB, yearB] = b.competence.split("/").map(Number);

        if (!monthA || !yearA) return 1;
        if (!monthB || !yearB) return -1;

        const dateA = new Date(yearA, monthA - 1, 1).getTime();
        const dateB = new Date(yearB, monthB - 1, 1).getTime();
        return dateB - dateA;
      });
  }, [collectivePendingPrevious]);

  // 2. Individual Pending (Manual + Installments)
  // A. Manual pending splits (Cash/Pix/Debit that are pending) - EXCLUDE credit card splits here as they are parcelled
  const manualIndividualPending = pendingSplits.filter((s: any) => 
    s.expenses?.expense_type === "individual" && 
    s.expenses?.payment_method !== "credit_card"
  );

  // B. Installments for the CURRENT MONTH (Credit Card)
  // These represent what I need to pay "now" (in this month's bill) for my individual credit card expenses
  const installmentIndividualPending = billInstallments.filter((i: any) => 
    i.expenses?.expense_type === "individual"
  ).map((i: any) => ({
    id: i.id, // Installment ID
    amount: i.amount,
    expenses: i.expenses // { title, category, purchase_date }
  }));

  // Combine them for the list
  const individualPending = [...manualIndividualPending, ...installmentIndividualPending];
  const totalIndividualPending = individualPending.reduce((sum: number, item: any) => sum + Number(item.amount), 0);

  // Total User Expenses (Comprometido) = Share + Individual Pending (Cash/Installments)
  const totalUserExpenses = myCollectiveShare + totalIndividualPending;

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


  const handlePayRateio = async (scope: RateioScope) => {
    if (!receiptFile) return;
    setSaving(true);
    try {
      const ext = receiptFile.name.split(".").pop();
      const path = `${user!.id}/${Date.now()}_rateio.${ext}`;
      await supabase.storage.from("receipts").upload(path, receiptFile);
      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);

      const amount = scope === "previous" ? totalCollectivePendingPrevious : totalCollectivePendingCurrent;

      await supabase.from("payments").insert({
        group_id: membership!.group_id,
        expense_split_id: null,
        paid_by: user!.id,
        amount,
        receipt_url: urlData.publicUrl,
        notes: scope === "previous"
          ? `Pagamento de Rateio - competências anteriores (${format(currentDate, "MMMM/yyyy", { locale: ptBR })})`
          : `Pagamento de Rateio - competência atual (${format(currentDate, "MMMM/yyyy", { locale: ptBR })})`
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

  const tabTriggerClass = "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-foreground/60 text-xs font-semibold px-3 py-1.5 rounded-md transition-all";
  const tabListClass = "w-full justify-start overflow-x-auto bg-muted/50 rounded-lg p-1 h-auto gap-1";

  const compactTabsList = (
    <TabsList className={tabListClass}>
      {!isPersonalFinancePage && isAdmin && (
        <TabsTrigger value="admin" className={tabTriggerClass}>
          <Shield className="h-3.5 w-3.5 mr-1.5" /> Admin
        </TabsTrigger>
      )}
      {!isPersonalFinancePage && (
        <TabsTrigger value="republic" className={tabTriggerClass}>
          <Users className="h-3.5 w-3.5 mr-1.5" /> República
        </TabsTrigger>
      )}
      {isPersonalFinancePage && (
        <>
          <TabsTrigger value="personal" className={tabTriggerClass}>
            <User className="h-3.5 w-3.5 mr-1.5" /> Pessoal
          </TabsTrigger>
          <TabsTrigger value="cards" className={tabTriggerClass}>
            <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Cartões
          </TabsTrigger>
        </>
      )}
    </TabsList>
  );

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 animate-in fade-in duration-500">
      <DashboardHeader 
        userName={profile?.full_name}
        groupName={membership?.group_name}
        currentDate={currentDate}
        cycleStart={cycleStart}
        cycleEnd={cycleEnd}
        cycleLimitDate={cycleLimitDate}
        onNextMonth={() => setCurrentDate(addMonths(currentDate, 1))}
        onPrevMonth={() => setCurrentDate(subMonths(currentDate, 1))}
        compactTabs={compactTabsList}
        onCompactChange={setHeroCompact}
      />

      <div className="space-y-6">
        {!heroCompact && (
        <TabsList className={tabListClass}>
          {!isPersonalFinancePage && isAdmin && (
            <TabsTrigger value="admin" className={tabTriggerClass}>
              <Shield className="h-3.5 w-3.5 mr-1.5" /> Admin
            </TabsTrigger>
          )}
          {!isPersonalFinancePage && (
            <TabsTrigger value="republic" className={tabTriggerClass}>
              <Users className="h-3.5 w-3.5 mr-1.5" /> República
            </TabsTrigger>
          )}
          {isPersonalFinancePage && (
            <>
              <TabsTrigger value="personal" className={tabTriggerClass}>
                <User className="h-3.5 w-3.5 mr-1.5" /> Pessoal
              </TabsTrigger>
              <TabsTrigger value="cards" className={tabTriggerClass}>
                <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Cartões
              </TabsTrigger>
            </>
          )}
        </TabsList>
        )}

        {!isPersonalFinancePage && isAdmin && (
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
                exMembersDebt={adminData.exMembersDebt}
                departuresCount={adminData.departuresCount}
                redistributedCount={adminData.redistributedCount}
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
            totalCollectivePendingPrevious={totalCollectivePendingPrevious}
            totalCollectivePendingCurrent={totalCollectivePendingCurrent}
            isLate={isLate}
            onPayRateio={(scope) => { setRateioScope(scope); setPayRateioOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="personal" className="space-y-6">
          <PersonalTab
            totalIndividualPending={totalIndividualPending}
            totalCollectivePendingPrevious={totalCollectivePendingPrevious}
            totalCollectivePendingCurrent={totalCollectivePendingCurrent}
            collectivePendingPreviousByCompetence={collectivePendingPreviousByCompetence}
            collectivePendingCurrent={collectivePendingCurrent}
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
            isLoading={isLoadingCreditCards || isLoadingBillInstallments}
          />
        </TabsContent>
      </div>

      <PaymentDialogs
        payRateioOpen={payRateioOpen}
        setPayRateioOpen={setPayRateioOpen}
        payIndividualOpen={payIndividualOpen}
        setPayIndividualOpen={setPayIndividualOpen}
        selectedIndividualSplit={selectedIndividualSplit}
        setSelectedIndividualSplit={setSelectedIndividualSplit}
        collectivePendingByScope={{
          previous: { total: totalCollectivePendingPrevious, items: collectivePendingPrevious },
          current: { total: totalCollectivePendingCurrent, items: collectivePendingCurrent },
        }}
        rateioScope={rateioScope}
        individualPending={individualPending}
        currentDate={currentDate}
        onPayRateio={handlePayRateio}
        onPayIndividual={handlePayIndividual}
        saving={saving}
        receiptFile={receiptFile}
        setReceiptFile={setReceiptFile}
      />
    </Tabs>
  );
}
