import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Receipt, TrendingUp, Package, DollarSign, Loader2, ListChecks, User, Calendar, CreditCard, Plus, CalendarClock, Info, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { format, subDays, isAfter, isSameDay, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function Dashboard() {
  const { profile, membership, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  
  // Date State for Navigation
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Payment State
  const [payRateioOpen, setPayRateioOpen] = useState(false);
  const [payIndividualOpen, setPayIndividualOpen] = useState(false);
  const [selectedIndividualSplit, setSelectedIndividualSplit] = useState<any>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // --- Group Settings ---
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

  // Initialize Date Logic based on Closing Day
  // If today is after closing day, the "current" financial month is technically next month.
  // But usually dashboards default to "This Month". Let's stick to the current calendar month unless adjusted.
  // The Month Selector will drive the logic.

  // Calculate Cycle Dates based on currentDate state
  // Cycle Start: Month - 1, Day = closingDay
  // Cycle End: Month, Day = closingDay (Exclusive)
  const cycleStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, closingDay);
  const cycleEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), closingDay);
  
  // Calculate Due Date for this specific selected month
  // If selected month is Nov, and due day is 10. The due date is Nov 10.
  const cycleDueDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dueDay);
  
  // Limit Date (D-1)
  const cycleLimitDate = subDays(cycleDueDate, 1);
  
  // Check if Late (only relevant if looking at current or past months)
  const now = new Date();
  const isLate = isAfter(now, cycleLimitDate) && !isSameDay(now, cycleLimitDate);

  // --- Queries ---

  // 1. Month Expenses (Group Spend) - Filtered by Cycle
  const { data: monthExpenses } = useQuery({
    queryKey: ["month-expenses", membership?.group_id, cycleStart.toISOString(), cycleEnd.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .eq("group_id", membership!.group_id)
        .gte("created_at", cycleStart.toISOString())
        .lt("created_at", cycleEnd.toISOString());
      
      return (data ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
    },
    enabled: !!membership?.group_id
  });

  // 2. Pending Splits (Debts) - ALWAYS Current Status (All Time)
  // We don't filter debts by month because a debt is a debt until paid.
  const { data: pendingSplits } = useQuery({
    queryKey: ["my-pending-splits", membership?.group_id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_splits")
        .select("id, amount, status, expense_id, expenses:expense_id(title, group_id, expense_type)")
        .eq("user_id", user!.id)
        .eq("status", "pending");
      if (error) throw error;
      return (data ?? []).filter((s: any) => s.expenses?.group_id === membership!.group_id);
    },
    enabled: !!membership?.group_id && !!user?.id,
  });

  // 3. Personal Bill - Filtered by Month/Year of currentDate
  const { data: currentBill } = useQuery({
    queryKey: ["personal-bill-summary", user?.id, currentDate.getMonth(), currentDate.getFullYear()],
    queryFn: async () => {
      const targetMonth = currentDate.getMonth() + 1; // 1-12
      const targetYear = currentDate.getFullYear();

      const { data } = await supabase
        .from("expense_installments")
        .select("amount")
        .eq("user_id", user!.id)
        .eq("bill_month", targetMonth)
        .eq("bill_year", targetYear);

      return (data ?? []).reduce((sum, i) => sum + Number(i.amount), 0);
    },
    enabled: !!user,
  });

  // 4. Recent Activity (Global)
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

  // Split calculations
  const collectivePending = (pendingSplits ?? []).filter((s: any) => s.expenses?.expense_type === "collective");
  const individualPending = (pendingSplits ?? []).filter((s: any) => s.expenses?.expense_type === "individual");
  const totalCollective = collectivePending.reduce((sum, s: any) => sum + Number(s.amount), 0);

  // --- Handlers ---
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
        amount: totalCollective,
        receipt_url: urlData.publicUrl,
        notes: "Pagamento de Rateio Coletivo"
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
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-serif">Olá, {profile?.full_name?.split(" ")[0]}</h1>
          <p className="text-muted-foreground mt-1">{membership?.group_name}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
           {/* Month Selector */}
           <div className="flex items-center gap-2 bg-card border rounded-lg p-1 shadow-sm">
             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
               <ChevronLeft className="h-4 w-4" />
             </Button>
             <div className="px-2 text-sm font-medium min-w-[140px] text-center capitalize">
               {format(currentDate, "MMMM yyyy", { locale: ptBR })}
             </div>
             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
               <ChevronRight className="h-4 w-4" />
             </Button>
           </div>
           
           <div className="flex gap-2">
             <Button variant="outline" size="sm" asChild className="h-10">
               <Link to="/personal/bills"><Calendar className="h-4 w-4 mr-2" /> Faturas</Link>
             </Button>
           </div>
        </div>
      </div>

      {/* Info Badges (Dynamic Dates) */}
      {groupSettings && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1.5 font-normal py-1 px-3 text-sm">
              <CalendarClock className="h-3.5 w-3.5 text-primary" /> 
              Fecha: <strong>{format(cycleEnd, "dd/MM")}</strong>
          </Badge>
          <Badge variant="outline" className="gap-1.5 font-normal py-1 px-3 text-sm">
              <Calendar className="h-3.5 w-3.5 text-destructive" /> 
              Pagar até: <strong>{format(cycleLimitDate, "dd/MM")}</strong>
          </Badge>
        </div>
      )}

      {/* Main Financial Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* Collective Debt (Rateio) - This is mostly "All time" but we show alert based on current view date */}
        <Card className={`relative overflow-hidden transition-all ${isLate && totalCollective > 0 ? "border-destructive bg-destructive/10" : "border-destructive/20 bg-destructive/5"}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardDescription className={isLate && totalCollective > 0 ? "text-destructive font-bold" : "text-destructive font-medium"}>
                {isLate && totalCollective > 0 ? "Rateio em Atraso" : "Rateio Pendente"}
              </CardDescription>
              <div className="flex items-center gap-1 mt-1">
                {isLate && totalCollective > 0 && <AlertCircle className="h-3 w-3 text-destructive" />}
                <p className={`text-[10px] ${isLate && totalCollective > 0 ? "text-destructive font-bold" : "text-destructive/80"}`}>
                   Vencimento da ref.: {format(cycleLimitDate, "dd/MM")}
                </p>
              </div>
            </div>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-serif">R$ {totalCollective.toFixed(2)}</p>
            {totalCollective > 0 && (
              <Button size="sm" className="mt-3 h-8 w-full gap-2 bg-destructive hover:bg-destructive/90" onClick={() => setPayRateioOpen(true)}>
                <DollarSign className="h-4 w-4" /> Pagar Casa
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Individual Pending */}
        <Card className="border-warning/20 bg-warning/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="text-warning-foreground font-medium">Gastos Individuais Pendentes</CardDescription>
            <User className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-serif">R$ {individualPending.reduce((s:number, i:any)=>s+Number(i.amount),0).toFixed(2)}</p>
            {individualPending.length > 0 && (
              <Button variant="outline" size="sm" className="mt-3 h-8 w-full gap-2" onClick={() => setPayIndividualOpen(true)}>
                <ListChecks className="h-4 w-4" /> Ver Detalhes
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Credit Card Bill (Dynamic by Month) */}
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="text-primary-foreground/70">Fatura Pessoal ({format(currentDate, "MMM")})</CardDescription>
            <CreditCard className="h-4 w-4 text-primary-foreground/70" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-serif">R$ {(currentBill ?? 0).toFixed(2)}</p>
            <p className="text-[10px] uppercase tracking-wider mt-2 opacity-60">Cartões de Crédito</p>
          </CardContent>
        </Card>

        {/* Group Spend (Dynamic by Cycle) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
               <CardDescription>Gastos da República</CardDescription>
               <Tooltip>
                 <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                 <TooltipContent><p>Soma das despesas na competência de {format(currentDate, "MMMM")}.</p></TooltipContent>
               </Tooltip>
            </div>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-serif">R$ {(monthExpenses ?? 0).toFixed(2)}</p>
            <p className="text-[10px] uppercase tracking-wider mt-2 text-muted-foreground">
              Competência {format(currentDate, "MM/yy")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Expenses List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-serif text-xl">Últimas Atividades</CardTitle>
            <Link to="/expenses" className="text-sm text-primary hover:underline">Ver todas →</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentExpenses?.map((e) => (
                <div key={e.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{e.title}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(e.created_at), "dd/MM/yyyy")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">R$ {Number(e.amount).toFixed(2)}</p>
                    <Badge variant={e.expense_type === "collective" ? "default" : "secondary"} className="text-[10px] h-4">
                      {e.expense_type === "collective" ? "Coletiva" : "Individual"}
                    </Badge>
                  </div>
                </div>
              ))}
              {recentExpenses?.length === 0 && <p className="text-sm text-muted-foreground py-4">Sem registros.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions / Stock */}
        <div className="space-y-6">
           <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                 <CardTitle className="text-sm font-medium">Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                 <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/expenses">
                       <Plus className="h-5 w-5" />
                       <span className="text-xs">Nova Despesa</span>
                    </Link>
                 </Button>
                 <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/inventory">
                       <Package className="h-5 w-5" />
                       <span className="text-xs">Estoque</span>
                    </Link>
                 </Button>
              </CardContent>
           </Card>
        </div>
      </div>

      {/* Dialogs for Payments */}
      <Dialog open={payRateioOpen} onOpenChange={setPayRateioOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Pagar Rateio Coletivo</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Total a pagar à república</p>
              <p className="text-3xl font-bold font-serif text-primary mt-1">R$ {totalCollective.toFixed(2)}</p>
            </div>

            {/* Detalhamento das despesas */}
            {collectivePending.length > 0 && (
              <div className="border rounded-md p-3 bg-card">
                 <p className="text-xs font-semibold text-muted-foreground mb-2">Detalhamento das despesas:</p>
                 <ScrollArea className="h-[150px] pr-2">
                    <div className="space-y-2">
                      {collectivePending.map((s: any) => (
                        <div key={s.id} className="flex justify-between text-sm border-b pb-1 last:border-0 last:pb-0 border-muted">
                          <span className="truncate pr-4 text-muted-foreground flex-1 text-left">{s.expenses?.title}</span>
                          <span className="font-medium whitespace-nowrap">R$ {Number(s.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                 </ScrollArea>
              </div>
            )}

            <div className="space-y-2">
              <Label>Comprovante *</Label>
              <Input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayRateioOpen(false)}>Cancelar</Button>
              <Button onClick={handlePayRateio} disabled={saving || !receiptFile}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Enviar Pagamento
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={payIndividualOpen} onOpenChange={(v) => { if (!v) { setPayIndividualOpen(false); setSelectedIndividualSplit(null); } else setPayIndividualOpen(true); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Despesas Individuais Pendentes</DialogTitle></DialogHeader>
          {!selectedIndividualSplit ? (
            <ScrollArea className="max-h-[300px] pr-4">
              <div className="space-y-3">
                {individualPending.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-medium truncate">{s.expenses?.title}</p>
                      <p className="text-xs text-muted-foreground">R$ {Number(s.amount).toFixed(2)}</p>
                    </div>
                    <Button size="sm" onClick={() => setSelectedIndividualSplit(s)}>Pagar</Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="space-y-4">
               <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Valor: {selectedIndividualSplit.expenses?.title}</p>
                  <p className="text-2xl font-bold font-serif text-primary mt-1">R$ {Number(selectedIndividualSplit.amount).toFixed(2)}</p>
               </div>
               <div className="space-y-2">
                  <Label>Comprovante *</Label>
                  <Input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
               </div>
               <DialogFooter>
                 <Button variant="outline" onClick={() => setSelectedIndividualSplit(null)}>Voltar</Button>
                 <Button onClick={handlePayIndividual} disabled={saving || !receiptFile}>Enviar</Button>
               </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}