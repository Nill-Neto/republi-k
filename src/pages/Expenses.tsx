import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Receipt, Calendar, User, Users, Upload } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORIES = [
  { value: "rent", label: "Aluguel" },
  { value: "utilities", label: "Contas (Luz/Água/Gás)" },
  { value: "internet", label: "Internet/TV" },
  { value: "cleaning", label: "Limpeza" },
  { value: "maintenance", label: "Manutenção" },
  { value: "groceries", label: "Mercado" },
  { value: "other", label: "Outros" },
];

export default function Expenses() {
  const { membership, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [expenseType, setExpenseType] = useState<"collective" | "individual">("collective");
  const [dueDate, setDueDate] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [description, setDescription] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", membership?.group_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, expense_splits(id, user_id, amount, status, paid_at)")
        .eq("group_id", membership!.group_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!membership?.group_id,
  });

  const { data: members } = useQuery({
    queryKey: ["members-list", membership?.group_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", membership!.group_id)
        .eq("active", true);
      if (error) throw error;
      const userIds = data.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      return profiles ?? [];
    },
    enabled: !!membership?.group_id,
  });

  const handleCreate = async () => {
    if (!title.trim() || !amount || parseFloat(amount) <= 0) {
      toast({ title: "Erro", description: "Preencha título e valor.", variant: "destructive" });
      return;
    }
    if (expenseType === "individual" && !targetUserId) {
      toast({ title: "Erro", description: "Selecione o morador.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let receiptUrl: string | null = null;
      if (receiptFile && user) {
        const ext = receiptFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("receipts").upload(path, receiptFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
        receiptUrl = urlData.publicUrl;
      }

      const { error } = await supabase.rpc("create_expense_with_splits", {
        _group_id: membership!.group_id,
        _title: title.trim(),
        _description: description.trim() || null,
        _amount: parseFloat(amount),
        _category: category,
        _expense_type: expenseType,
        _due_date: dueDate || null,
        _receipt_url: receiptUrl,
        _target_user_id: expenseType === "individual" ? targetUserId : null,
      });
      if (error) throw error;

      toast({ title: "Despesa criada!", description: `"${title}" registrada com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      setOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setAmount("");
    setCategory("other");
    setExpenseType("collective");
    setDueDate("");
    setTargetUserId("");
    setDescription("");
    setReceiptFile(null);
  };

  const mySplits = expenses?.flatMap((e) =>
    (e.expense_splits ?? [])
      .filter((s: any) => s.user_id === user?.id)
      .map((s: any) => ({ ...s, expense: e }))
  ) ?? [];

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
          <h1 className="text-3xl font-serif">Despesas</h1>
          <p className="text-muted-foreground mt-1">{expenses?.length ?? 0} despesa(s) registrada(s)</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Nova Despesa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif">Nova Despesa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={expenseType} onValueChange={(v) => setExpenseType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="collective"><div className="flex items-center gap-2"><Users className="h-4 w-4" /> Coletiva</div></SelectItem>
                      <SelectItem value="individual"><div className="flex items-center gap-2"><User className="h-4 w-4" /> Individual</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {expenseType === "individual" && (
                  <div className="space-y-2">
                    <Label>Morador</Label>
                    <Select value={targetUserId} onValueChange={setTargetUserId}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {members?.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Conta de luz - Janeiro" maxLength={200} />
                </div>

                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes adicionais" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Vencimento (opcional)</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Comprovante (opcional)</Label>
                  <Input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
                </div>

                <Button onClick={handleCreate} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Criar Despesa
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="mine">Minhas</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3 mt-4">
          {expenses?.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma despesa registrada.</CardContent></Card>
          )}
          {expenses?.map((e) => (
            <ExpenseCard key={e.id} expense={e} userId={user?.id} />
          ))}
        </TabsContent>

        <TabsContent value="mine" className="space-y-3 mt-4">
          {mySplits.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma despesa atribuída a você.</CardContent></Card>
          )}
          {mySplits.map((s: any) => (
            <ExpenseCard key={s.id} expense={s.expense} userId={user?.id} highlightSplit={s} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExpenseCard({ expense, userId, highlightSplit }: { expense: any; userId?: string; highlightSplit?: any }) {
  const mySplit = highlightSplit ?? expense.expense_splits?.find((s: any) => s.user_id === userId);
  const catLabel = CATEGORIES.find((c) => c.value === expense.category)?.label ?? expense.category;
  const isPast = expense.due_date && new Date(expense.due_date) < new Date();

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium">{expense.title}</p>
              <Badge variant="outline" className="text-xs">{catLabel}</Badge>
              <Badge variant={expense.expense_type === "collective" ? "default" : "secondary"} className="text-xs">
                {expense.expense_type === "collective" ? "Coletiva" : "Individual"}
              </Badge>
            </div>
            {expense.description && <p className="text-xs text-muted-foreground mt-1">{expense.description}</p>}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(expense.created_at), "dd/MM/yyyy", { locale: ptBR })}
              </span>
              {expense.due_date && (
                <span className={`flex items-center gap-1 ${isPast && mySplit?.status === 'pending' ? 'text-destructive font-medium' : ''}`}>
                  Vence: {format(new Date(expense.due_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold font-serif">R$ {Number(expense.amount).toFixed(2)}</p>
            {mySplit && (
              <div className="mt-1">
                <p className="text-xs text-muted-foreground">Sua parte: R$ {Number(mySplit.amount).toFixed(2)}</p>
                <Badge variant={mySplit.status === "paid" ? "default" : mySplit.status === "overdue" ? "destructive" : "secondary"} className="text-xs mt-1">
                  {mySplit.status === "paid" ? "Pago" : mySplit.status === "overdue" ? "Atrasado" : "Pendente"}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
