import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
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
import {
  Loader2,
  Plus,
  Calendar,
  Users,
  User,
  Save,
  Edit,
  CreditCard,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCycleDates } from "@/hooks/useCycleDates";

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

type ExpenseRow = {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  description: string | null;
  amount: number;
  category: string;
  expense_type: string;
  due_date: string | null;
  paid_to_provider: boolean;
  receipt_url: string | null;
  recurring_expense_id: string | null;
  created_at: string;
  updated_at: string;
  payment_method: string;
  credit_card_id: string | null;
  installments: number;
  purchase_date: string;
  expense_splits?: Array<{
    id: string;
    user_id: string;
    amount: number;
    status: string;
    paid_at: string | null;
  }>;
};

type InstallmentRow = {
  id: string;
  expense_id: string;
  installment_number: number;
  amount: number;
  bill_month: number;
  bill_year: number;
};

export default function Expenses() {
  const { membership, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();

  // UI State
  const [activeTab, setActiveTab] = useState("all");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<"expense" | "recurring">("expense");

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [customCategory, setCustomCategory] = useState("");
  const [expenseType, setExpenseType] = useState<"collective" | "individual">(isAdmin ? "collective" : "individual");
  const [dateValue, setDateValue] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");

  // Payment Fields
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [creditCardId, setCreditCardId] = useState<string>("none");
  const [installments, setInstallments] = useState("1");

  // Recurring specific fields (only for creation flow)
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDay, setRecurrenceDay] = useState("5");

  // Installment action dialogs
  const [deleteConfirmExpense, setDeleteConfirmExpense] = useState<any>(null);
  const [editConfirmExpense, setEditConfirmExpense] = useState<any>(null);

  // --- Date Cycle Logic ---
  const { currentDate, cycleStart, cycleEnd, nextMonth, prevMonth, loading } = useCycleDates(membership?.group_id);

  useEffect(() => {
    if (!editingId && activeTab !== "recurring") {
      setExpenseType(isAdmin ? "collective" : "individual");
    }
  }, [isAdmin, editingId, activeTab]);

  useEffect(() => {
    if (category !== "other") {
      setCustomCategory("");
    }
  }, [category]);

  // Fetch expenses whose purchase_date falls in the current cycle
  const { data: cycleExpenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses", membership?.group_id, cycleStart.toISOString(), cycleEnd.toISOString()],
    queryFn: async () => {
      const dbStart = format(cycleStart, "yyyy-MM-dd");
      const dbEnd = format(cycleEnd, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("expenses")
        .select("*, expense_splits(id, user_id, amount, status, paid_at)")
        .eq("group_id", membership!.group_id)
        .gte("purchase_date", dbStart)
        .lt("purchase_date", dbEnd)
        .order("purchase_date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ExpenseRow[];
    },
    enabled: !!membership?.group_id,
  });

  // Fetch installments for the current bill month/year
  const { data: monthInstallments = [], isLoading: loadingInstallments } = useQuery({
    queryKey: ["expense-installments-by-month", membership?.group_id, currentDate.getMonth(), currentDate.getFullYear()],
    queryFn: async () => {
      const targetMonth = currentDate.getMonth() + 1;
      const targetYear = currentDate.getFullYear();

      const { data, error } = await supabase
        .from("expense_installments")
        .select("id, expense_id, installment_number, amount, bill_month, bill_year")
        .eq("bill_month", targetMonth)
        .eq("bill_year", targetYear);

      if (error) return [] as InstallmentRow[];
      return (data ?? []) as InstallmentRow[];
    },
    enabled: !!membership?.group_id,
  });

  // Find expense IDs from installments that are NOT already in cycleExpenses
  const missingExpenseIds = useMemo(() => {
    const cycleIds = new Set(cycleExpenses.map((e) => e.id));
    return [...new Set(monthInstallments.map((i) => i.expense_id).filter((id) => !cycleIds.has(id)))];
  }, [cycleExpenses, monthInstallments]);

  // Fetch those missing parent expenses
  const { data: installmentParentExpenses = [], isLoading: loadingParents } = useQuery({
    queryKey: ["installment-parent-expenses", missingExpenseIds],
    queryFn: async () => {
      if (missingExpenseIds.length === 0) return [];
      const { data, error } = await supabase
        .from("expenses")
        .select("*, expense_splits(id, user_id, amount, status, paid_at)")
        .in("id", missingExpenseIds);
      if (error) throw error;
      return (data ?? []) as ExpenseRow[];
    },
    enabled: missingExpenseIds.length > 0,
  });

  // Merge all expenses
  const allExpenses = useMemo(() => {
    const map = new Map<string, ExpenseRow>();
    cycleExpenses.forEach((e) => map.set(e.id, e));
    installmentParentExpenses.forEach((e) => map.set(e.id, e));
    return Array.from(map.values());
  }, [cycleExpenses, installmentParentExpenses]);

  const installmentByExpenseId = useMemo(() => {
    const map = new Map<string, InstallmentRow>();
    monthInstallments.forEach((i) => map.set(i.expense_id, i));
    return map;
  }, [monthInstallments]);

  const { data: recurringExpenses, isLoading: loadingRecurring } = useQuery({
    queryKey: ["recurring-expenses", membership?.group_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_expenses")
        .select("*")
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

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete installments first, then the expense (cascade should handle splits)
      await supabase.from("expense_installments").delete().eq("expense_id", id);
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-installments-by-month"] });
      queryClient.invalidateQueries({ queryKey: ["installment-parent-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["bill-installments"] });
      toast({ title: "Despesa excluída." });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteRecurring = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-expenses"] });
      toast({ title: "Recorrência excluída." });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const handleSave = async () => {
    if (!title.trim() || !amount || parseFloat(amount) <= 0) {
      toast({ title: "Erro", description: "Preencha título e valor.", variant: "destructive" });
      return;
    }

    if (paymentMethod === "credit_card" && (creditCardId === "none" || !creditCardId) && editingType === "expense") {
      toast({ title: "Erro", description: "Selecione um cartão de crédito.", variant: "destructive" });
      return;
    }

    const categoryToSend = category === "other" ? customCategory.trim() : category;
    const finalCreditCardId = creditCardId === "none" ? null : creditCardId;

    setSaving(true);
    try {
      if (editingType === "recurring" && editingId) {
        const { error } = await supabase
          .from("recurring_expenses")
          .update({
            title: title.trim(),
            amount: parseFloat(amount),
            category: categoryToSend,
            description: description.trim() || null,
            next_due_date: dateValue,
            day_of_month: parseInt(dateValue.split("-")[2]),
          })
          .eq("id", editingId);
        if (error) throw error;
        toast({ title: "Recorrência atualizada!" });
        queryClient.invalidateQueries({ queryKey: ["recurring-expenses"] });
      } else if (editingType === "expense" && editingId) {
        const parsedAmount = parseFloat(amount);
        const parsedInstallments = parseInt(installments) || 1;

        const { error } = await supabase
          .from("expenses")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            amount: parsedAmount,
            category: categoryToSend,
            payment_method: paymentMethod,
            credit_card_id: finalCreditCardId,
            installments: parsedInstallments,
            purchase_date: dateValue,
          })
          .eq("id", editingId);
        if (error) throw error;

        // Regenerate installments
        await supabase.from("expense_installments").delete().eq("expense_id", editingId);

        if (paymentMethod === "credit_card" && finalCreditCardId && parsedInstallments > 0) {
          const card = cards.find((c) => c.id === finalCreditCardId);
          if (card) {
            const closingDay = card.closing_day;
            const purchaseDate = new Date(dateValue + "T12:00:00");
            const billBase = new Date(purchaseDate);
            if (purchaseDate.getDate() >= closingDay) {
              billBase.setMonth(billBase.getMonth() + 1);
            }

            const perInstallment = Math.round((parsedAmount / parsedInstallments) * 100) / 100;
            const installmentRows = [];
            for (let i = 1; i <= parsedInstallments; i++) {
              const installDate = new Date(billBase);
              installDate.setMonth(installDate.getMonth() + (i - 1));
              installmentRows.push({
                user_id: user!.id,
                expense_id: editingId,
                installment_number: i,
                amount: perInstallment,
                bill_month: installDate.getMonth() + 1,
                bill_year: installDate.getFullYear(),
              });
            }
            await supabase.from("expense_installments").insert(installmentRows);
          }
        }

        toast({ title: "Despesa atualizada!" });
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        queryClient.invalidateQueries({ queryKey: ["bill-installments"] });
        queryClient.invalidateQueries({ queryKey: ["expense-installments-by-month"] });
        queryClient.invalidateQueries({ queryKey: ["installment-parent-expenses"] });
      } else {
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
          _purchase_date: dateValue,
        });
        if (error) throw error;

        if (isRecurring) {
          const day = parseInt(recurrenceDay);
          const nextMonthDate = new Date();
          nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
          nextMonthDate.setDate(day);

          await supabase.from("recurring_expenses").insert({
            group_id: membership!.group_id,
            created_by: user!.id,
            title: title.trim(),
            description: description.trim() || null,
            amount: parseFloat(amount),
            category: categoryToSend,
            frequency: "monthly",
            day_of_month: day,
            next_due_date: nextMonthDate.toISOString().split("T")[0],
            active: true,
            expense_type: expenseType,
          } as any);
          queryClient.invalidateQueries({ queryKey: ["recurring-expenses"] });
        }

        toast({ title: "Despesa criada!" });
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        queryClient.invalidateQueries({ queryKey: ["expense-installments-by-month"] });
        queryClient.invalidateQueries({ queryKey: ["installment-parent-expenses"] });
      }

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
    setEditingType("expense");
    setTitle("");
    setAmount("");
    setCategory("other");
    setCustomCategory("");
    setExpenseType(isAdmin ? "collective" : "individual");
    setDateValue(format(new Date(), "yyyy-MM-dd"));
    setDescription("");
    setPaymentMethod("cash");
    setCreditCardId("none");
    setInstallments("1");
    setIsRecurring(false);
    setRecurrenceDay("5");
  };

  const openEditExpense = (expense: any) => {
    resetForm();
    setEditingType("expense");
    setEditingId(expense.id);
    setTitle(expense.title);
    setAmount(String(expense.amount));
    setDescription(expense.description || "");
    setDateValue(expense.purchase_date || format(new Date(), "yyyy-MM-dd"));
    setExpenseType(expense.expense_type);
    setPaymentMethod(expense.payment_method || "cash");
    setCreditCardId(expense.credit_card_id || "none");
    setInstallments(String(expense.installments || 1));

    const isStandardCat = CATEGORIES.some((c) => c.value === expense.category);
    if (isStandardCat) {
      setCategory(expense.category);
    } else {
      setCategory("other");
      setCustomCategory(expense.category);
    }
    setOpen(true);
  };

  const openEditRecurring = (recurring: any) => {
    resetForm();
    setEditingType("recurring");
    setEditingId(recurring.id);
    setTitle(recurring.title);
    setAmount(String(recurring.amount));
    setDescription(recurring.description || "");
    setDateValue(recurring.next_due_date);

    const isStandardCat = CATEGORIES.some((c) => c.value === recurring.category);
    if (isStandardCat) {
      setCategory(recurring.category);
    } else {
      setCategory("other");
      setCustomCategory(recurring.category);
    }
    setOpen(true);
  };

  // Decorate expenses with installment info (without modifying the title)
  const decoratedExpenses = useMemo(() => {
    return allExpenses.map((e) => {
      const inst = installmentByExpenseId.get(e.id);
      if (!inst) return e;

      return {
        ...e,
        _installment_number: inst.installment_number,
        _installment_amount: inst.amount,
        _is_installment: true,
      };
    });
  }, [allExpenses, installmentByExpenseId]);

  const filteredAll = (decoratedExpenses ?? []).filter((e: any) => {
    if (e.expense_type === "collective") return true;
    if (e.created_by === user?.id) return true;
    const splits = (e.expense_splits as any[]) || [];
    return splits.some((s: any) => s.user_id === user?.id);
  });

  const filteredMine = (decoratedExpenses ?? []).filter((e: any) => {
    if (e.expense_type !== "individual") return false;
    if (e.created_by === user?.id) return true;
    const splits = (e.expense_splits as any[]) || [];
    return splits.some((s: any) => s.user_id === user?.id);
  });

  const filteredCollective = (decoratedExpenses ?? []).filter((e: any) => e.expense_type === "collective");

  // Handlers for installment-aware edit/delete
  const handleEditClick = (expense: any) => {
    if (expense._is_installment && expense.installments > 1) {
      setEditConfirmExpense(expense);
    } else {
      openEditExpense(expense);
    }
  };

  const handleDeleteClick = (expense: any) => {
    if (expense._is_installment && expense.installments > 1) {
      setDeleteConfirmExpense(expense);
    } else {
      deleteExpenseMutation.mutate(expense.id);
    }
  };

  if (loadingExpenses || loadingRecurring || loading || loadingInstallments || loadingParents) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-serif">Despesas</h1>
          <p className="text-muted-foreground mt-1">Gestão financeira do grupo</p>
        </div>

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

          <Button className="gap-2 h-10" onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Nova Despesa
          </Button>
        </div>

        {/* Edit form dialog */}
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif">
                {editingId ? (editingType === "recurring" ? "Editar Recorrência" : "Editar Despesa") : "Nova Despesa"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {editingType === "expense" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={expenseType} onValueChange={(v) => setExpenseType(v as any)} disabled={!!editingId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {isAdmin && (
                          <SelectItem value="collective">
                            <div className="flex items-center gap-2"><Users className="h-4 w-4" /> Coletiva</div>
                          </SelectItem>
                        )}
                        <SelectItem value="individual">
                          <div className="flex items-center gap-2"><User className="h-4 w-4" /> Individual</div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data da Compra</Label>
                    <Input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
                  </div>
                </div>
              )}

              {editingType === "recurring" && (
                <div className="space-y-2">
                  <Label>Próximo Vencimento</Label>
                  <Input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
                </div>
              )}

              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Mercado Mensal" maxLength={200} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Valor Total (R$)</Label>
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

              {category === "other" && (
                <div className="space-y-2">
                  <Label>Nome da Categoria</Label>
                  <Input placeholder="Ex: Farmácia" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} />
                </div>
              )}

              {editingType === "expense" && (
                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-base font-medium">Pagamento</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Forma</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {paymentMethod === "credit_card" && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Cartão</Label>
                        <Select value={creditCardId} onValueChange={setCreditCardId}>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            {cards.length === 0 && <SelectItem value="none" disabled>Nenhum cartão</SelectItem>}
                            {cards.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                            ))}
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
                        <span className="text-sm text-muted-foreground">
                          x de R$ {(Number(amount) / (parseInt(installments) || 1)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 pt-2 border-t">
                <Label>Descrição (opcional)</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes adicionais" />
              </div>

              {!editingId && editingType === "expense" && (
                <div className="rounded-lg border p-3 bg-muted/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={isRecurring} onCheckedChange={setIsRecurring} id="recurring-switch" />
                    <Label htmlFor="recurring-switch" className="cursor-pointer">Repetir mensalmente?</Label>
                  </div>

                  {isRecurring && (
                    <div className="space-y-2 animate-accordion-down">
                      <Label>Dia do Vencimento (mensal)</Label>
                      <Input type="number" min="1" max="31" value={recurrenceDay} onChange={(e) => setRecurrenceDay(e.target.value)} />
                      <p className="text-xs text-muted-foreground">
                        Será criada uma regra na aba "Recorrentes" para gerar essa despesa todo mês.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {editingId ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit confirmation for installment expenses */}
        <AlertDialog open={!!editConfirmExpense} onOpenChange={(v) => { if (!v) setEditConfirmExpense(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Editar despesa parcelada</AlertDialogTitle>
              <AlertDialogDescription>
                Esta despesa possui {editConfirmExpense?.installments} parcelas. A edição afetará a despesa e <strong>todas as parcelas</strong> serão recalculadas. Deseja continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                const exp = editConfirmExpense;
                setEditConfirmExpense(null);
                openEditExpense(exp);
              }}>
                Editar despesa completa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete confirmation for installment expenses */}
        <AlertDialog open={!!deleteConfirmExpense} onOpenChange={(v) => { if (!v) setDeleteConfirmExpense(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir despesa parcelada?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta despesa possui {deleteConfirmExpense?.installments} parcelas. Ao excluir, <strong>todas as parcelas</strong> serão removidas. Essa ação não pode ser desfeita. Deseja continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const id = deleteConfirmExpense?.id;
                  setDeleteConfirmExpense(null);
                  if (id) deleteExpenseMutation.mutate(id);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir todas as parcelas
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="text-sm text-muted-foreground">
        Exibindo competência: <strong>{format(cycleStart, "dd/MM")}</strong> até{" "}
        <strong>{format(subDays(cycleEnd, 1), "dd/MM")}</strong>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="mine">Minhas</TabsTrigger>
          <TabsTrigger value="collective">Coletivas</TabsTrigger>
          <TabsTrigger value="recurring" className="gap-2">
            <RefreshCw className="h-3 w-3" /> Recorrentes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3 mt-4">
          {filteredAll.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma despesa encontrada nesta competência.</p>}
          {filteredAll.map((e: any) => (
            <ExpenseCard
              key={e.id}
              expense={e}
              userId={user?.id}
              isAdmin={isAdmin}
              cards={cards}
              onEdit={() => handleEditClick(e)}
              onDelete={() => handleDeleteClick(e)}
            />
          ))}
        </TabsContent>

        <TabsContent value="mine" className="space-y-3 mt-4">
          {filteredMine.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma despesa individual encontrada nesta competência.</p>}
          {filteredMine.map((e: any) => (
            <ExpenseCard
              key={e.id}
              expense={e}
              userId={user?.id}
              isAdmin={isAdmin}
              cards={cards}
              onEdit={() => handleEditClick(e)}
              onDelete={() => handleDeleteClick(e)}
            />
          ))}
        </TabsContent>

        <TabsContent value="collective" className="space-y-3 mt-4">
          {filteredCollective.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma despesa coletiva encontrada nesta competência.</p>}
          {filteredCollective.map((e: any) => (
            <ExpenseCard
              key={e.id}
              expense={e}
              userId={user?.id}
              isAdmin={isAdmin}
              cards={cards}
              onEdit={() => handleEditClick(e)}
              onDelete={() => handleDeleteClick(e)}
            />
          ))}
        </TabsContent>

        <TabsContent value="recurring" className="space-y-3 mt-4">
          <p className="text-xs text-muted-foreground mb-4">Modelos de despesas que se repetem (não dependem do filtro de mês).</p>
          {!recurringExpenses?.length && <p className="text-center text-muted-foreground py-8">Nenhuma recorrência configurada.</p>}
          {recurringExpenses?.map((r: any) => (
            <RecurringCard
              key={r.id}
              recurring={r}
              isAdmin={isAdmin}
              userId={user?.id}
              onEdit={() => openEditRecurring(r)}
              onDelete={() => deleteRecurring.mutate(r.id)}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExpenseCard({ expense, userId, isAdmin, cards, onEdit, onDelete }: any) {
  const catLabel = CATEGORIES.find((c) => c.value === expense.category)?.label ?? expense.category;
  const mySplit = expense.expense_splits?.find((s: any) => s.user_id === userId);
  const cardLabel = cards.find((c: any) => c.id === expense.credit_card_id)?.label;
  const canManage = isAdmin || expense.created_by === userId;

  const isInstallment = expense._is_installment && expense.installments > 1;
  const displayAmount = isInstallment ? expense._installment_amount : expense.amount;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-medium">{expense.title}</p>
              <Badge variant="outline" className="text-xs">{catLabel}</Badge>
              <Badge
                variant={expense.expense_type === "collective" ? "default" : "secondary"}
                className="text-xs"
              >
                {expense.expense_type === "collective" ? "Coletiva" : "Individual"}
              </Badge>
              {isInstallment && (
                <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                  Parcela {expense._installment_number}/{expense.installments}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {format(new Date(expense.purchase_date || expense.created_at), "dd/MM/yyyy")}
              </span>
              {expense.payment_method === "credit_card" && (
                <span>
                  <CreditCard className="h-3 w-3 inline mr-1" /> {cardLabel}{" "}
                  {expense.installments > 1 && `(${expense.installments}x)`}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold">R$ {Number(displayAmount).toFixed(2)}</p>
            {isInstallment && (
              <p className="text-[10px] text-muted-foreground">Total: R$ {Number(expense.amount).toFixed(2)}</p>
            )}
            {mySplit && expense.expense_type === "collective" && (
              <Badge variant="secondary" className="text-[10px]">
                Sua parte: R$ {Number(mySplit.amount).toFixed(2)}
              </Badge>
            )}
          </div>
          {canManage && (
            <div className="flex flex-col gap-1 ml-2">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir esta despesa? Essa ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RecurringCard({ recurring, isAdmin, userId, onEdit, onDelete }: any) {
  const catLabel = CATEGORIES.find((c) => c.value === recurring.category)?.label ?? recurring.category;
  const canManage = isAdmin || recurring.created_by === userId;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-medium">{recurring.title}</p>
              <Badge variant="outline" className="text-xs">{catLabel}</Badge>
              <Badge variant={recurring.expense_type === "collective" ? "default" : "secondary"} className="text-xs">
                {recurring.expense_type === "collective" ? "Coletiva" : "Individual"}
              </Badge>
              <Badge variant={recurring.active ? "default" : "secondary"} className="text-xs">
                {recurring.active ? "Ativa" : "Pausada"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Próximo vencimento: {format(new Date(recurring.next_due_date), "dd/MM/yyyy")}
            </p>
          </div>
          <div className="text-right shrink-0 flex flex-col items-end gap-2">
            <p className="text-lg font-bold">R$ {Number(recurring.amount).toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Mensal</p>
          </div>
          {canManage && (
            <div className="flex items-center gap-1 mt-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir recorrência?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir "{recurring.title}"? Novas despesas não serão geradas automaticamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
