import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Check, X, Upload, Image as ImageIcon, ChevronLeft, ChevronRight, ChevronsUpDown, CreditCard, Settings, Trash2 } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/layout/PageHero";
import { ScrollRevealGroup } from "@/components/ui/scroll-reveal";
import { useCycleDates } from "@/hooks/useCycleDates";
import { getCompetenceKeyFromDate } from "@/lib/cycleDates";

export default function Payments() {
  const { membership, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  
  const [open, setOpen] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [heroCompact, setHeroCompact] = useState(false);
  
  const [selectedSplitIds, setSelectedSplitIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const { currentDate, cycleStart, cycleEnd, nextMonth, prevMonth, closingDay } = useCycleDates(membership?.group_id);

  // Manage Payment State
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editCompetence, setEditCompetence] = useState("");

  const openManage = (payment: any) => {
    setEditingPayment(payment);
    setEditAmount(String(payment.amount));
    setEditNotes(payment.notes || "");
    setEditStatus(payment.status);

    // Calcula a competência baseada na data de criação do pagamento e dia de fechamento
    const competence = getCompetenceKeyFromDate(new Date(payment.created_at), closingDay);
    setEditCompetence(competence);
  };

  const updatePayment = useMutation({
    mutationFn: async (values: { amount: string; notes: string; status: string; competence: string }) => {
      let newDate = editingPayment.created_at;
      
      if (values.competence) {
        const [yStr, mStr] = values.competence.split("-");
        const y = parseInt(yStr);
        const m = parseInt(mStr) - 1; // 0-based month
        
        // Define uma data segura que caia exatamente dentro do ciclo da competência escolhida.
        // O ciclo da competência 'm' começa no 'closingDay' do mês 'm-1'.
        // Usamos meio-dia para evitar problemas de fuso horário.
        const safeDate = new Date(y, m - 1, closingDay, 12, 0, 0);
        newDate = safeDate.toISOString();
      }

      const { error } = await supabase
        .from("payments")
        .update({
          amount: Number(values.amount),
          notes: values.notes || null,
          status: values.status,
          created_at: newDate,
        })
        .eq("id", editingPayment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["my-pending-splits"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      toast({ title: "Pagamento atualizado!" });
      setEditingPayment(null);
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deletePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["my-pending-splits"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      toast({ title: "Pagamento excluído." });
      setEditingPayment(null);
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

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

  return (
    <div className="space-y-4">
      <PageHero
        onCompactChange={setHeroCompact}
        title="Pagamentos"
        subtitle="Histórico de pagamentos."
        tone="primary"
        icon={<CreditCard className="h-4 w-4" />}
        actions={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 bg-card border rounded-lg p-1 shadow-sm">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-2 text-sm font-medium min-w-[140px] text-center capitalize">
                {format(currentDate, "MMMM yyyy", { locale: ptBR })}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card de Pendentes */}
        <Card className="border-l-4 border-l-warning bg-card shadow-sm flex flex-col">
          <CardContent className="p-0 flex-1 flex flex-col">
            <div className="p-4 border-b bg-muted/20">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-warning"></div>
                Pendentes
                <Badge variant="secondary" className="ml-auto">
                  {payments?.filter((p) => p.status === "pending").length || 0}
                </Badge>
              </h3>
              <p className="text-sm text-muted-foreground">Aguardando confirmação</p>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-auto">
              {payments?.filter((p) => p.status === "pending").length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">Nenhum pagamento pendente.</div>
              ) : (
                payments?.filter((p) => p.status === "pending").map((p: any) => (
                  <PaymentItem key={p.id} payment={p} isAdmin={isAdmin} onConfirm={handleConfirm} onManage={openManage} />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card de Histórico (Todos/Confirmados/Recusados) */}
        <Card className="border-l-4 border-l-success bg-card shadow-sm flex flex-col">
          <CardContent className="p-0 flex-1 flex flex-col">
            <div className="p-4 border-b bg-muted/20">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success"></div>
                Histórico
                <Badge variant="secondary" className="ml-auto">
                  {payments?.filter((p) => p.status !== "pending").length || 0}
                </Badge>
              </h3>
              <p className="text-sm text-muted-foreground">Confirmados e recusados</p>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-auto">
              {payments?.filter((p) => p.status !== "pending").length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">Nenhum pagamento no histórico.</div>
              ) : (
                payments?.filter((p) => p.status !== "pending").map((p: any) => (
                  <PaymentItem key={p.id} payment={p} isAdmin={isAdmin} onConfirm={handleConfirm} onManage={openManage} />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Gerenciamento de Pagamentos (Admin) */}
      <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" min="0.01" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Competência</Label>
                <Input type="month" value={editCompetence} onChange={(e) => setEditCompetence(e.target.value)} />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground -mt-2">
              Selecione o mês para que o sistema direcione este pagamento para a competência correta.
            </p>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="rejected">Recusado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Observações</Label>
              <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>

            <div className="flex justify-between pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir pagamento?</AlertDialogTitle>
                    <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => editingPayment && deletePayment.mutate(editingPayment.id)} className="bg-destructive text-destructive-foreground">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditingPayment(null)}>Cancelar</Button>
                <Button onClick={() => updatePayment.mutate({ amount: editAmount, notes: editNotes, status: editStatus, competence: editCompetence })} disabled={updatePayment.isPending}>
                  {updatePayment.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function PaymentItem({ payment, isAdmin, onConfirm, onManage }: { payment: any; isAdmin: boolean; onConfirm: (id: string, status: "confirmed" | "rejected") => void; onManage?: (payment: any) => void }) {
  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    pending: { label: "Pendente", variant: "secondary" },
    confirmed: { label: "Confirmado", variant: "default" },
    rejected: { label: "Recusado", variant: "destructive" },
  };
  const s = statusMap[payment.status] ?? statusMap.pending;

  return (
    <div className="p-3 bg-background border rounded-lg shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">{payment.payer_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(new Date(payment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
          {payment.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{payment.notes}</p>}
          {payment.receipt_url && (
            <Button variant="outline" size="sm" className="h-7 text-xs mt-2 w-fit gap-1.5" asChild>
              <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer">
                <ImageIcon className="h-3 w-3" /> Ver comprovante
              </a>
            </Button>
          )}
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1">
            <p className="text-sm font-bold">R$ {Number(payment.amount).toFixed(2)}</p>
            {isAdmin && onManage && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => onManage(payment)}>
                <Settings className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Badge variant={s.variant} className="text-[10px] px-1.5 py-0 h-4">{s.label}</Badge>
          {isAdmin && payment.status === "pending" && (
            <div className="flex gap-1 mt-1">
              <Button size="icon" variant="default" className="h-6 w-6" onClick={() => onConfirm(payment.id, "confirmed")}>
                <Check className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="destructive" className="h-6 w-6" onClick={() => onConfirm(payment.id, "rejected")}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}