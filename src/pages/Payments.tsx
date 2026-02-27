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
import { Loader2, Plus, Check, X, Upload, Image, ChevronLeft, ChevronRight, ChevronsUpDown, DollarSign, Wallet, Calendar } from "lucide-react";
import { format, addMonths, subMonths, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function Payments() {
  const { membership, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  
  const [open, setOpen] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  
  const [selectedSplitIds, setSelectedSplitIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

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

      const userIds = [...new Set(data.map((p) => p.paid_by))];
      const { data: profiles } = await supabase.from("group_member_profiles").select("id, full_name").eq("group_id", membership!.group_id).in("id", userIds);
      return data.map((p) => ({
        ...p,
        payer_name: profiles?.find((pr) => pr.id === p.paid_by)?.full_name ?? "—",
      }));
    },
    enabled: !!membership?.group_id,
  });

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
      const ext = receiptFile.name.split(".").pop();
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, receiptFile);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);

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
    <div className="space-y-6">
      <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 mb-8 overflow-hidden">
        <div className="bg-warning/10 border-b border-warning/20 px-4 md:px-8 py-8 md:py-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-warning/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-serif text-foreground">Pagamentos</h1>
              <p className="text-muted-foreground font-medium">Histórico e comprovantes de quitação</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm border border-warning/20 rounded-lg p-1 shadow-sm h-10">
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-warning/10" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="px-2 text-sm font-bold min-w-[140px] text-center capitalize text-warning-foreground">
                  {format(currentDate, "MMMM yyyy", { locale: ptBR })}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-warning/10" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {!isAdmin && (pendingSplits?.length ?? 0) > 0 && (
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 h-10 bg-warning hover:bg-warning/90 text-warning-foreground shadow-lg shadow-warning/20">
                      <Plus className="h-4 w-4" /> Enviar Pagamento
                    </Button>
                  </DialogTrigger>
                  {/* Dialog Content... */}
                  <DialogContent className="max-w-md overflow-visible">
                    <DialogHeader>
                      <DialogTitle className="font-serif">Enviar Comprovante</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label>Despesas ({selectedSplitIds.length})</Label>
                        <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={comboboxOpen}
                              className="w-full justify-between font-normal"
                            >
                              {selectedSplitIds.length > 0
                                ? `${selectedSplitIds.length} item(ns) selecionado(s)`
                                : "Selecione as despesas..."}
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
                                    <CommandItem
                                      key={split.id}
                                      value={split.id + split.expenses?.title} 
                                      onSelect={() => toggleSplitSelection(split.id)}
                                      className="cursor-pointer"
                                    >
                                      <div
                                        className={cn(
                                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                          selectedSplitIds.includes(split.id)
                                            ? "bg-primary text-primary-foreground"
                                            : "opacity-50 [&_svg]:invisible"
                                        )}
                                      >
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
                        <Input 
                          type="number" 
                          value={amount} 
                          onChange={(e) => setAmount(e.target.value)} 
                          disabled={selectedSplitIds.length > 1}
                          className={selectedSplitIds.length > 1 ? "bg-muted font-bold" : ""}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Comprovante *</Label>
                        <Input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
                      </div>

                      <div className="space-y-2">
                        <Label>Observações (opcional)</Label>
                        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: Pix enviado às 14h" />
                      </div>

                      <Button onClick={handleSubmitPayment} disabled={saving} className="w-full bg-warning hover:bg-warning/90 text-warning-foreground">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                        Enviar Pagamento
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-1 space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="bg-warning/10 p-1.5 rounded text-warning-foreground">
            <DollarSign className="h-4 w-4" />
          </div>
          <span>Exibindo competência: <strong>{format(cycleStart, "dd/MM")}</strong> até <strong>{format(subDays(cycleEnd, 1), "dd/MM")}</strong></span>
        </div>

        <Tabs defaultValue={isAdmin ? "pending" : "all"}>
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
            {isAdmin && <TabsTrigger value="pending" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 transition-all hover:text-primary">Pendentes</TabsTrigger>}
            <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 transition-all hover:text-primary">Todos</TabsTrigger>
          </TabsList>

          {isAdmin && (
            <TabsContent value="pending" className="space-y-3 mt-6">
              {payments?.filter((p) => p.status === "pending").length === 0 && (
                <Card className="border-dashed py-12"><CardContent className="text-center text-muted-foreground flex flex-col items-center">
                  <Wallet className="h-10 w-10 mb-2 opacity-10" />
                  <p>Nenhum pagamento pendente nesta competência.</p>
                </CardContent></Card>
              )}
              {payments?.filter((p) => p.status === "pending").map((p: any) => (
                <PaymentCard key={p.id} payment={p} isAdmin onConfirm={handleConfirm} />
              ))}
            </TabsContent>
          )}

          <TabsContent value="all" className="space-y-3 mt-6">
            {payments?.length === 0 && (
              <Card className="border-dashed py-12"><CardContent className="text-center text-muted-foreground flex flex-col items-center">
                <Wallet className="h-10 w-10 mb-2 opacity-10" />
                <p>Nenhum pagamento registrado nesta competência.</p>
              </CardContent></Card>
            )}
            {payments?.map((p: any) => (
              <PaymentCard key={p.id} payment={p} isAdmin={isAdmin} onConfirm={handleConfirm} />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
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
    <Card className="group hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{payment.payer_name}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {format(new Date(payment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
            {payment.notes && <p className="text-xs text-muted-foreground mt-2 italic bg-muted/30 p-2 rounded">"{payment.notes}"</p>}
            {payment.receipt_url && (
              <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline mt-3 bg-primary/5 px-2 py-1 rounded">
                <Image className="h-3.5 w-3.5" /> Ver comprovante
              </a>
            )}
          </div>
          <div className="text-right shrink-0 flex flex-col items-end gap-2">
            <p className="text-lg font-bold text-foreground">R$ {Number(payment.amount).toFixed(2)}</p>
            <Badge variant={s.variant} className="text-[10px] h-5 uppercase tracking-wider">{s.label}</Badge>
            {isAdmin && payment.status === "pending" && (
              <div className="flex gap-1.5 mt-2">
                <Button size="sm" variant="default" className="h-8 gap-1 shadow-sm px-3" onClick={() => onConfirm(payment.id, "confirmed")}>
                  <Check className="h-3.5 w-3.5" /> Aceitar
                </Button>
                <Button size="sm" variant="destructive" className="h-8 gap-1 shadow-sm px-3" onClick={() => onConfirm(payment.id, "rejected")}>
                  <X className="h-3.5 w-3.5" /> Negar
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}