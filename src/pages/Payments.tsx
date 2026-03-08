import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Check, X, Upload, Image, ChevronLeft, ChevronRight, ChevronsUpDown, CreditCard } from "lucide-react";
import { format, addMonths, subMonths, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/layout/PageHero";
import { ScrollRevealGroup } from "@/components/ui/scroll-reveal";

export default function Payments() {
  const { membership, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  
  const [open, setOpen] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [heroCompact, setHeroCompact] = useState(false);
  
  // Alterado para array de IDs
  const [selectedSplitIds, setSelectedSplitIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // --- Date Cycle Logic ---
  const { data: groupSettings } = useQuery({
    queryKey: ["group-settings-payments", membership?.group_id],
    queryFn: async () => {
      const { data } = await supabase.from("groups").select("closing_day").eq("id", membership!.group_id).single();
      return data;
    },
    enabled: !!membership?.group_id
  });

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  useEffect(() => {
    if (groupSettings) {
      const today = new Date();
      if (today.getDate() >= (groupSettings.closing_day || 1)) {
        setCurrentDate(addMonths(today, 1));
      } else {
        setCurrentDate(today);
      }
    }
  }, [groupSettings]);

  const closingDay = groupSettings?.closing_day || 1;
  const cycleStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, closingDay);
  const cycleEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), closingDay);
  cycleStart.setHours(0, 0, 0, 0);
  cycleEnd.setHours(0, 0, 0, 0);

  // Fetch payments FILTERED by cycle
  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments", membership?.group_id, cycleStart.toISOString(), cycleEnd.toISOString()],
    queryFn: async () => {
      const dbStart = format(cycleStart, "yyyy-MM-dd");
      const dbEnd = format(cycleEnd, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("group_id", membership!.group_id)
        .gte("created_at", dbStart)
        .lt("created_at", dbEnd)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Get profile names for paid_by
      const userIds = [...new Set(data.map((p) => p.paid_by))];
      const { data: profiles } = await supabase.from("group_member_profiles").select("id, full_name").eq("group_id", membership!.group_id).in("id", userIds);
      return data.map((p) => ({
        ...p,
        payer_name: profiles?.find((pr) => pr.id === p.paid_by)?.full_name ?? "—",
      }));
    },
    enabled: !!membership?.group_id,
  });

  // Fetch pending splits for current user
  const { data: pendingSplits } = useQuery({
    queryKey: ["my-pending-splits", membership?.group_id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_splits")
        .select("id, amount, status, expense_id, expenses:expense_id(title, group_id)")
        .eq("user_id", user!.id)
        .eq("status", "pending");
      if (error) throw error;
      return (data ?? []).filter((s: any) => s.expenses?.group_id === membership!.group_id);
    },
    enabled: !!membership?.group_id && !!user?.id,
  });

  // Effect: Update total amount when selection changes
  useEffect(() => {
    if (!pendingSplits) return;
    const total = pendingSplits
      .filter((s) => selectedSplitIds.includes(s.id))
      .reduce((sum, s) => sum + Number(s.amount), 0);
    
    // Only update if greater than 0 to avoid clearing manual edits unnecessarily 
    // (though manual edits are discouraged in multi-select mode)
    if (selectedSplitIds.length > 0) {
      setAmount(total.toFixed(2));
    } else {
      setAmount("");
    }
  }, [selectedSplitIds, pendingSplits]);

  const toggleSplitSelection = (id: string) => {
    setSelectedSplitIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmitPayment = async () => {
    if (selectedSplitIds.length === 0 || !amount || parseFloat(amount) <= 0) {
      toast({ title: "Erro", description: "Selecione pelo menos uma despesa.", variant: "destructive" });
      return;
    }
    if (!receiptFile) {
      toast({ title: "Erro", description: "Anexe o comprovante de pagamento.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // 1. Upload receipt once
      const ext = receiptFile.name.split(".").pop();
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, receiptFile);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);

      // 2. Insert payment records (one per split)
      const paymentsToInsert = selectedSplitIds.map((splitId) => {
        const split = pendingSplits?.find(s => s.id === splitId);
        // We use the exact split amount for the record to ensure accounting consistency
        const splitAmount = split ? Number(split.amount) : 0;
        
        return {
          group_id: membership!.group_id,
          expense_split_id: splitId,
          paid_by: user!.id,
          amount: splitAmount,
          receipt_url: urlData.publicUrl,
          notes: notes.trim() || (selectedSplitIds.length > 1 ? "Pagamento em lote" : null),
        };
      });

      const { error } = await supabase.from("payments").insert(paymentsToInsert);
      if (error) throw error;

      toast({ title: "Pagamento enviado!", description: "Aguardando confirmação do administrador." });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["my-pending-splits"] });
      
      // Reset form
      setOpen(false);
      setSelectedSplitIds([]);
      setAmount("");
      setNotes("");
      setReceiptFile(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async (paymentId: string, status: "confirmed" | "rejected") => {
    try {
      const { error } = await supabase.rpc("confirm_payment", {
        _payment_id: paymentId,
        _status: status,
      });
      if (error) throw error;
      toast({ title: status === "confirmed" ? "Pagamento confirmado" : "Pagamento recusado" });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const defaultTab = isAdmin ? "pending" : "all";

  const tabTriggerClass = "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-foreground/60 text-xs font-semibold px-3 py-1.5 rounded-md transition-all";
  const tabListClass = "w-full justify-start overflow-x-auto bg-muted/50 rounded-lg p-1 h-auto gap-1";

  const compactTabsList = (
    <TabsList className={tabListClass}>
      {isAdmin && <TabsTrigger value="pending" className={tabTriggerClass}>Pendentes</TabsTrigger>}
      <TabsTrigger value="all" className={tabTriggerClass}>Todos</TabsTrigger>
    </TabsList>
  );

  return (
    <Tabs defaultValue={defaultTab}>
    <div className="space-y-4">
      <PageHero
        compactTabs={compactTabsList}
        onCompactChange={setHeroCompact}
        title="Pagamentos"
        subtitle="Histórico de pagamentos."
        tone="primary"
        icon={<CreditCard className="h-4 w-4" />}
        actions={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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

            {!isAdmin && (pendingSplits?.length ?? 0) > 0 && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 h-10"><Plus className="h-4 w-4" /> Enviar Pagamento</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md overflow-visible">
                  <DialogHeader>
                    <DialogTitle className="font-serif">Enviar Comprovante</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Despesas ({selectedSplitIds.length})</Label>
                      <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" aria-expanded={comboboxOpen} className="w-full justify-between font-normal">
                            {selectedSplitIds.length > 0 ? `${selectedSplitIds.length} item(ns) selecionado(s)` : "Selecione as despesas..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[350px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar despesa..." />
                            <CommandList>
                              <CommandEmpty>Nenhuma despesa pendente.</CommandEmpty>
                              <CommandGroup className="max-h-[200px] overflow-auto">
                                {pendingSplits?.map((split: any) => (
                                  <CommandItem key={split.id} value={split.id + split.expenses?.title} onSelect={() => toggleSplitSelection(split.id)} className="cursor-pointer">
                                    <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", selectedSplitIds.includes(split.id) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                      <Check className={cn("h-4 w-4")} />
                                    </div>
                                    <div className="flex flex-1 justify-between items-center gap-2 overflow-hidden">
                                      <span className="truncate">{split.expenses?.title}</span>
                                      <span className="text-muted-foreground whitespace-nowrap">R$ {Number(split.amount).toFixed(2)}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>Valor Total (R$)</Label>
                      <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={selectedSplitIds.length > 1} className={selectedSplitIds.length > 1 ? "bg-muted font-bold" : ""} />
                      {selectedSplitIds.length > 1 && <p className="text-[10px] text-muted-foreground">Soma automática das despesas selecionadas.</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Comprovante *</Label>
                      <Input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
                      <p className="text-xs text-muted-foreground">Foto ou PDF do comprovante de pagamento</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Observações (opcional)</Label>
                      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: Pix enviado às 14h" />
                    </div>
                    <Button onClick={handleSubmitPayment} disabled={saving} className="w-full">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      Enviar Pagamento
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        }
      />

      <div className="text-sm text-muted-foreground">
        Exibindo competência: <strong>{format(cycleStart, "dd/MM")}</strong> até <strong>{format(subDays(cycleEnd, 1), "dd/MM")}</strong>
      </div>

      {!heroCompact && (
        <TabsList className={tabListClass}>
          {isAdmin && <TabsTrigger value="pending" className={tabTriggerClass}>Pendentes</TabsTrigger>}
          <TabsTrigger value="all" className={tabTriggerClass}>Todos</TabsTrigger>
        </TabsList>
      )}

      {isAdmin && (
        <TabsContent value="pending" className="space-y-3 mt-4">
          {payments?.filter((p) => p.status === "pending").length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum pagamento pendente nesta competência.</CardContent></Card>
          )}
          {payments?.filter((p) => p.status === "pending").map((p: any) => (
            <PaymentCard key={p.id} payment={p} isAdmin onConfirm={handleConfirm} />
          ))}
        </TabsContent>
      )}

      <TabsContent value="all" className="space-y-3 mt-4">
        {payments?.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum pagamento registrado nesta competência.</CardContent></Card>
        )}
        {payments?.map((p: any) => (
          <PaymentCard key={p.id} payment={p} isAdmin={isAdmin} onConfirm={handleConfirm} />
        ))}
      </TabsContent>
    </div>
    </Tabs>
  );
}

function PaymentCard({ payment, isAdmin, onConfirm }: { payment: any; isAdmin: boolean; onConfirm: (id: string, status: "confirmed" | "rejected") => void }) {
  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    pending: { label: "Pendente", variant: "secondary" },
    confirmed: { label: "Confirmado", variant: "default" },
    rejected: { label: "Recusado", variant: "destructive" },
  };
  const s = statusMap[payment.status] ?? statusMap.pending;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{payment.payer_name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(payment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
            {payment.notes && <p className="text-xs text-muted-foreground mt-1">{payment.notes}</p>}
            {payment.receipt_url && (
              <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                <Image className="h-3 w-3" /> Ver comprovante
              </a>
            )}
          </div>
          <div className="text-right shrink-0 flex flex-col items-end gap-2">
            <p className="text-lg font-bold">R$ {Number(payment.amount).toFixed(2)}</p>
            <Badge variant={s.variant}>{s.label}</Badge>
            {isAdmin && payment.status === "pending" && (
              <div className="flex gap-1 mt-1">
                <Button size="sm" variant="default" className="h-7 gap-1" onClick={() => onConfirm(payment.id, "confirmed")}>
                  <Check className="h-3 w-3" /> Confirmar
                </Button>
                <Button size="sm" variant="destructive" className="h-7 gap-1" onClick={() => onConfirm(payment.id, "rejected")}>
                  <X className="h-3 w-3" /> Recusar
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}