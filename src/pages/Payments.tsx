import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Check, X, Upload, Image } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Payments() {
  const { membership, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [splitId, setSplitId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch payments
  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments", membership?.group_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("group_id", membership!.group_id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Get profile names for paid_by
      const userIds = [...new Set(data.map((p) => p.paid_by))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
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

  const handleSubmitPayment = async () => {
    if (!splitId || !amount || parseFloat(amount) <= 0) {
      toast({ title: "Erro", description: "Selecione a despesa e informe o valor.", variant: "destructive" });
      return;
    }
    if (!receiptFile) {
      toast({ title: "Erro", description: "Anexe o comprovante de pagamento.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Upload receipt
      const ext = receiptFile.name.split(".").pop();
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, receiptFile);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);

      const { error } = await supabase.from("payments").insert({
        group_id: membership!.group_id,
        expense_split_id: splitId,
        paid_by: user!.id,
        amount: parseFloat(amount),
        receipt_url: urlData.publicUrl,
        notes: notes.trim() || null,
      });
      if (error) throw error;

      toast({ title: "Pagamento enviado!", description: "Aguardando confirmação do administrador." });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["my-pending-splits"] });
      setOpen(false);
      setSplitId("");
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

  const selectedSplit = pendingSplits?.find((s) => s.id === splitId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif">Pagamentos</h1>
          <p className="text-muted-foreground mt-1">{payments?.length ?? 0} pagamento(s)</p>
        </div>
        {!isAdmin && (pendingSplits?.length ?? 0) > 0 && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Enviar Pagamento</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Enviar Comprovante</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Despesa</Label>
                  <Select value={splitId} onValueChange={(v) => {
                    setSplitId(v);
                    const s = pendingSplits?.find((ps) => ps.id === v);
                    if (s) setAmount(String(s.amount));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecione a despesa..." /></SelectTrigger>
                    <SelectContent>
                      {pendingSplits?.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.expenses?.title} — R$ {Number(s.amount).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
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

      <Tabs defaultValue={isAdmin ? "pending" : "all"}>
        <TabsList>
          {isAdmin && <TabsTrigger value="pending">Pendentes</TabsTrigger>}
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="pending" className="space-y-3 mt-4">
            {payments?.filter((p) => p.status === "pending").length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum pagamento pendente.</CardContent></Card>
            )}
            {payments?.filter((p) => p.status === "pending").map((p: any) => (
              <PaymentCard key={p.id} payment={p} isAdmin onConfirm={handleConfirm} />
            ))}
          </TabsContent>
        )}

        <TabsContent value="all" className="space-y-3 mt-4">
          {payments?.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum pagamento registrado.</CardContent></Card>
          )}
          {payments?.map((p: any) => (
            <PaymentCard key={p.id} payment={p} isAdmin={isAdmin} onConfirm={handleConfirm} />
          ))}
        </TabsContent>
      </Tabs>
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
            <p className="text-lg font-bold font-serif">R$ {Number(payment.amount).toFixed(2)}</p>
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
