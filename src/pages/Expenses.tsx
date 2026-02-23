import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Calendar, Users, User, Save, Edit, CreditCard } from "lucide-react";
import { format } from "date-fns";

const CATEGORIES = [
  { value: "rent", label: "Aluguel" },
  { value: "utilities", label: "Contas (Luz/Água/Gás)" },
  { value: "internet", label: "Internet/TV" },
  { value: "cleaning", label: "Limpeza" },
  { value: "maintenance", label: "Manutenção" },
  { value: "groceries", label: "Mercado" },
  { value: "other", label: "Outros" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "debit", label: "Débito" },
  { value: "credit_card", label: "Cartão de Crédito" },
];

export default function Expenses() {
  const { membership, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  
  // State for Create/Edit
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [customCategory, setCustomCategory] = useState("");
  const [expenseType, setExpenseType] = useState<"collective" | "individual">(isAdmin ? "collective" : "individual");
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  
  // Payment Fields
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [creditCardId, setCreditCardId] = useState<string>("none");
  const [installments, setInstallments] = useState("1");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingId) {
      setExpenseType(isAdmin ? "collective" : "individual");
    }
  }, [isAdmin, editingId]);

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

  const { data: cards = [] } = useQuery({
    queryKey: ["credit-cards", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("credit_cards").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const myExpenses = (expenses ?? []).filter(e => e.expense_type === 'individual' && e.created_by === user?.id);
  const collectiveExpenses = (expenses ?? []).filter(e => e.expense_type === 'collective');

  const handleSave = async () => {
    if (!title.trim() || !amount || parseFloat(amount) <= 0) {
      toast({ title: "Erro", description: "Preencha título e valor.", variant: "destructive" });
      return;
    }

    if (paymentMethod === "credit_card" && (creditCardId === "none" || !creditCardId)) {
      toast({ title: "Erro", description: "Selecione um cartão de crédito.", variant: "destructive" });
      return;
    }

    const categoryToSend = category === "other" ? customCategory.trim() : category;
    const finalCreditCardId = creditCardId === "none" ? null : creditCardId;

    setSaving(true);
    try {
      if (editingId) {
        // Edit Mode (Direct update)
        const { error } = await supabase
          .from("expenses")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            amount: parseFloat(amount),
            category: categoryToSend,
            payment_method: paymentMethod,
            credit_card_id: finalCreditCardId,
            installments: parseInt(installments) || 1,
            purchase_date: dueDate || format(new Date(), "yyyy-MM-dd"),
          })
          .eq("id", editingId);
        
        if (error) throw error;
        toast({ title: "Despesa atualizada!" });
      } else {
        // Create Mode (via RPC)
        const { error } = await supabase.rpc("create_expense_with_splits", {
          _group_id: membership!.group_id,
          _title: title.trim(),
          _description: description.trim() || null,
          _amount: parseFloat(amount),
          _category: categoryToSend,
          _expense_type: expenseType,
          _due_date: null,
          _receipt_url: null, 
          _recurring_expense_id: null,
          _target_user_id: expenseType === "individual" ? user?.id : null,
          _payment_method: paymentMethod,
          _credit_card_id: finalCreditCardId,
          _installments: parseInt(installments) || 1,
          _purchase_date: dueDate || format(new Date(), "yyyy-MM-dd")
        });
        if (error) throw error;
        toast({ title: "Despesa criada!" });
      }

      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setAmount("");
    setCategory("other");
    setCustomCategory("");
    setExpenseType(isAdmin ? "collective" : "individual");
    setDueDate(format(new Date(), "yyyy-MM-dd"));
    setDescription("");
    setPaymentMethod("cash");
    setCreditCardId("none");
    setInstallments("1");
  };

  const openEdit = (expense: any) => {
    setEditingId(expense.id);
    setTitle(expense.title);
    setAmount(String(expense.amount));
    setDescription(expense.description || "");
    setDueDate(expense.purchase_date || expense.due_date || format(new Date(), "yyyy-MM-dd"));
    setExpenseType(expense.expense_type);
    setPaymentMethod(expense.payment_method || "cash");
    setCreditCardId(expense.credit_card_id || "none");
    setInstallments(String(expense.installments || 1));
    
    const isStandardCat = CATEGORIES.some(c => c.value === expense.category);
    if (isStandardCat) {
      setCategory(expense.category);
      setCustomCategory("");
    } else {
      setCategory("other");
      setCustomCategory(expense.category);
    }
    setOpen(true);
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif">Despesas</h1>
          <p className="text-muted-foreground mt-1">{expenses?.length ?? 0} despesa(s) registrada(s)</p>
        </div>
        <Button className="gap-2" onClick={() => { resetForm(); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Nova Despesa
        </Button>

        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif">{editingId ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={expenseType} onValueChange={(v) => setExpenseType(v as any)} disabled={!!editingId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {isAdmin && <SelectItem value="collective"><div className="flex items-center gap-2"><Users className="h-4 w-4" /> Coletiva</div></SelectItem>}
                      <SelectItem value="individual"><div className="flex items-center gap-2"><User className="h-4 w-4" /> Individual</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data da Compra</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Mercado Mensal" maxLength={200} />
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
                    <SelectContent>{CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>

              {category === "other" && (
                <div className="space-y-2">
                   <Label>Nome da Categoria</Label>
                   <Input placeholder="Ex: Farmácia" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} />
                </div>
              )}

              <div className="space-y-3 pt-2 border-t">
                 <Label className="text-base font-medium">Pagamento</Label>
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                       <Label className="text-xs text-muted-foreground">Forma</Label>
                       <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{PAYMENT_METHODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                       </Select>
                    </div>
                    {paymentMethod === "credit_card" && (
                      <div className="space-y-2">
                         <Label className="text-xs text-muted-foreground">Cartão</Label>
                         <Select value={creditCardId} onValueChange={setCreditCardId}>
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                               {cards.length === 0 && <SelectItem value="none" disabled>Nenhum cartão</SelectItem>}
                               {cards.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                            </SelectContent>
                         </Select>
                      </div>
                    )}
                 </div>

                 {paymentMethod === "credit_card" && (
                    <div className="space-y-2">
                       <Label className="text-xs text-muted-foreground">Parcelas</Label>
                       <div className="flex items-center gap-2">
                          <Input type="number" min="1" max="36" value={installments} onChange={(e) => setInstallments(e.target.value)} className="w-24" />
                          <span className="text-sm text-muted-foreground">x de R$ {(Number(amount) / (parseInt(installments) || 1)).toFixed(2)}</span>
                       </div>
                    </div>
                 )}
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label>Descrição (opcional)</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes adicionais" />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {editingId ? "Atualizar" : "Salvar"}
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
          {(expenses ?? []).length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma despesa encontrada.</p>}
          {(expenses ?? []).map((e) => (
            <ExpenseCard key={e.id} expense={e} userId={user?.id} isAdmin={isAdmin} cards={cards} onEdit={() => openEdit(e)} />
          ))}
        </TabsContent>
        
        <TabsContent value="mine" className="space-y-3 mt-4">
          {myExpenses.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma despesa individual encontrada.</p>}
          {myExpenses.map((e) => (
            <ExpenseCard key={e.id} expense={e} userId={user?.id} isAdmin={isAdmin} cards={cards} onEdit={() => openEdit(e)} />
          ))}
        </TabsContent>

        <TabsContent value="collective" className="space-y-3 mt-4">
          {collectiveExpenses.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma despesa coletiva encontrada.</p>}
          {collectiveExpenses.map((e) => (
            <ExpenseCard key={e.id} expense={e} userId={user?.id} isAdmin={isAdmin} cards={cards} onEdit={() => openEdit(e)} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExpenseCard({ expense, userId, isAdmin, cards, onEdit }: any) {
  const catLabel = CATEGORIES.find((c) => c.value === expense.category)?.label ?? expense.category;
  const mySplit = expense.expense_splits?.find((s: any) => s.user_id === userId);
  const cardLabel = cards.find((c: any) => c.id === expense.credit_card_id)?.label;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-medium">{expense.title}</p>
              <Badge variant="outline" className="text-xs">{catLabel}</Badge>
              <Badge variant={expense.expense_type === "collective" ? "default" : "secondary"} className="text-xs">{expense.expense_type === "collective" ? "Coletiva" : "Individual"}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-2">
               <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(expense.purchase_date || expense.created_at), "dd/MM/yyyy")}</span>
               {expense.payment_method === "credit_card" && <span><CreditCard className="h-3 w-3 inline mr-1" /> {cardLabel} ({expense.installments}x)</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold font-serif">R$ {Number(expense.amount).toFixed(2)}</p>
            {mySplit && expense.expense_type === "collective" && <Badge variant="secondary" className="text-[10px]">Sua parte: R$ {Number(mySplit.amount).toFixed(2)}</Badge>}
          </div>
          {(isAdmin || (expense.created_by === userId && expense.expense_type === "individual")) && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}><Edit className="h-4 w-4" /></Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}