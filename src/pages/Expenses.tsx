import { useEffect, useState } from "react";
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
import { Loader2, Plus, Calendar, Users, User, Save } from "lucide-react";
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
  const [customCategory, setCustomCategory] = useState("");
  const [expenseType, setExpenseType] = useState<"collective" | "individual">(isAdmin ? "collective" : "individual");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setExpenseType(isAdmin ? "collective" : "individual");
  }, [isAdmin]);

  useEffect(() => {
    if (category !== "other") {
      setCustomCategory("");
    }
  }, [category]);

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

  const collectiveExpenses = (expenses ?? []).filter((e) => e.expense_type === "collective");

  const handleCreate = async () => {
    if (!title.trim() || !amount || parseFloat(amount) <= 0) {
      toast({ title: "Erro", description: "Preencha título e valor.", variant: "destructive" });
      return;
    }

    const isCollective = expenseType === "collective";
    if (isCollective && !isAdmin) {
      toast({ title: "Sem permissão", description: "Apenas administradores podem criar despesas coletivas.", variant: "destructive" });
      return;
    }

    const targetUserId = isCollective ? null : user?.id;
    if (!isCollective && !targetUserId) {
      toast({ title: "Erro", description: "Não foi possível identificar o usuário.", variant: "destructive" });
      return;
    }

    if (category === "other" && !customCategory.trim()) {
      toast({ title: "Erro", description: "Informe o nome da categoria.", variant: "destructive" });
      return;
    }

    const categoryToSend = category === "other" ? customCategory.trim() : category;

    setSaving(true);
    try {
      const { error } = await supabase.rpc("create_expense_with_splits", {
        _group_id: membership!.group_id,
        _title: title.trim(),
        _description: description.trim() || null,
        _amount: parseFloat(amount),
        _category: categoryToSend,
        _expense_type: expenseType,
        _due_date: dueDate || null,
        _receipt_url: null,
        _target_user_id: targetUserId,
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
    setCustomCategory("");
    setExpenseType(isAdmin ? "collective" : "individual");
    setDueDate("");
    setDescription("");
  };

  const mySplits =
    expenses?.flatMap((e) =>
      (e.expense_splits ?? [])
        .filter((s: any) => s.user_id === user?.id)
        .map((s: any) => ({ ...s, expense: e })),
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {isAdmin ? "Nova despesa" : "Nova despesa individual"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif">Nova Despesa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                {isAdmin ? (
                  <Select value={expenseType} onValueChange={(v) => setExpenseType(v as "collective" | "individual")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="collective">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" /> Coletiva
                        </div>
                      </SelectItem>
                      <SelectItem value="individual">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" /> Individual
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">Você pode registrar apenas despesas individuais para você.</p>
                )}
                {expenseType === "individual" && (
                  <p className="text-xs text-muted-foreground">Esta despesa será registrada no seu nome.</p>
                )}
              </div>

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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {category === "other" && (
                    <Input
                      className="mt-2"
                      placeholder="Nome da categoria"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Vencimento (opcional)</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>

              <Button onClick={handleCreate} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar despesa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="mine">Minhas</TabsTrigger>
          <TabsTrigger value="collective">Coletivas</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3 mt-4">
          {expenses?.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">Nenhuma despesa registrada.</CardContent>
            </Card>
          )}
          {expenses?.map((e) => (
            <ExpenseCard key={e.id} expense={e} userId={user?.id} />
          ))}
        </TabsContent>

        <TabsContent value="mine" className="space-y-3 mt-4">
          {mySplits.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">Nenhuma despesa atribuída a você.</CardContent>
            </Card>
          )}
          {mySplits.map((s: any) => (
            <ExpenseCard key={s.id} expense={s.expense} userId={user?.id} highlightSplit={s} />
          ))}
        </TabsContent>

        <TabsContent value="collective" className="space-y-3 mt-4">
          {collectiveExpenses.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">Nenhuma despesa coletiva registrada.</CardContent>
            </Card>
          )}
          {collectiveExpenses.map((e) => (
            <ExpenseCard key={e.id} expense={e} userId={user?.id} />
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
              <Badge variant="outline" className="text-xs">
                {catLabel}
              </Badge>
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
                <span className={`flex items-center gap-1 ${isPast && mySplit?.status === "pending" ? "text-destructive font-medium" : ""}`}>
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
                <Badge
                  variant={
                    mySplit.status === "paid"
                      ? "default"
                      : mySplit.status === "overdue"
                        ? "destructive"
                        : "secondary"
                  }
                  className="text-xs mt-1"
                >
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