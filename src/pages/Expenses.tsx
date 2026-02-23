import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Calendar, Users, User, Save, Upload, Edit, Trash2, ExternalLink, CheckCircle2, DollarSign } from "lucide-react";
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
  
  // State for Create/Edit
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [customCategory, setCustomCategory] = useState("");
  const [expenseType, setExpenseType] = useState<"collective" | "individual">("individual");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // State for Payments
  const [payProviderOpen, setPayProviderOpen] = useState(false);
  const [paySplitOpen, setPaySplitOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

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

  const collectiveExpenses = (expenses ?? []).filter((e) => e.expense_type === "collective");

  // --- Actions ---

  const handleSave = async () => {
    if (!title.trim() || !amount || parseFloat(amount) <= 0) {
      toast({ title: "Erro", description: "Preencha título e valor.", variant: "destructive" });
      return;
    }

    const isCollective = expenseType === "collective";
    if (isCollective && !isAdmin && !editingId) {
      toast({ title: "Sem permissão", description: "Apenas administradores podem criar despesas coletivas.", variant: "destructive" });
      return;
    }

    if (category === "other" && !customCategory.trim()) {
      toast({ title: "Erro", description: "Informe o nome da categoria.", variant: "destructive" });
      return;
    }

    const categoryToSend = category === "other" ? customCategory.trim() : category;
    const targetUserId = isCollective ? null : user?.id;

    setSaving(true);
    try {
      if (editingId) {
        // Edit Mode
        const { error } = await supabase
          .from("expenses")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            amount: parseFloat(amount),
            category: categoryToSend,
            due_date: dueDate || null,
          })
          .eq("id", editingId);
        
        if (error) throw error;
        toast({ title: "Despesa atualizada!" });
      } else {
        // Create Mode
        const { error } = await supabase.rpc("create_expense_with_splits", {
          _group_id: membership!.group_id,
          _title: title.trim(),
          _description: description.trim() || null,
          _amount: parseFloat(amount),
          _category: categoryToSend,
          _expense_type: expenseType,
          _due_date: dueDate || null,
          _receipt_url: null, // Receipt only on payment
          _target_user_id: targetUserId,
        });
        if (error) throw error;
        toast({ title: "Despesa criada!" });
      }

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

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta despesa?")) return;
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Despesa excluída." });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // Admin pays provider (Collective)
  const handlePayProvider = async () => {
    if (!receiptFile) {
      toast({ title: "Erro", description: "Comprovante é obrigatório.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const ext = receiptFile.name.split(".").pop();
      const path = `${user!.id}/${Date.now()}_provider.${ext}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, receiptFile);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);

      const { error } = await supabase
        .from("expenses")
        .update({
          paid_to_provider: true,
          receipt_url: urlData.publicUrl,
        })
        .eq("id", selectedExpense.id);
      
      if (error) throw error;

      toast({ title: "Pagamento registrado!" });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setPayProviderOpen(false);
      setReceiptFile(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // User pays their split
  const handlePaySplit = async () => {
    if (!receiptFile) {
      toast({ title: "Erro", description: "Comprovante é obrigatório.", variant: "destructive" });
      return;
    }
    const mySplit = selectedExpense.expense_splits.find((s: any) => s.user_id === user!.id);
    if (!mySplit) return;

    setSaving(true);
    try {
      const ext = receiptFile.name.split(".").pop();
      const path = `${user!.id}/${Date.now()}_split.${ext}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, receiptFile);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);

      const { error } = await supabase.from("payments").insert({
        group_id: membership!.group_id,
        expense_split_id: mySplit.id,
        paid_by: user!.id,
        amount: mySplit.amount,
        receipt_url: urlData.publicUrl,
        status: "pending"
      });
      if (error) throw error;

      toast({ title: "Pagamento enviado!", description: "Aguardando confirmação do admin." });
      setPaySplitOpen(false);
      setReceiptFile(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // --- Helpers ---

  const openEdit = (expense: any) => {
    setEditingId(expense.id);
    setTitle(expense.title);
    setAmount(String(expense.amount));
    setDescription(expense.description || "");
    setDueDate(expense.due_date || "");
    setExpenseType(expense.expense_type);
    
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

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setAmount("");
    setCategory("other");
    setCustomCategory("");
    setExpenseType(isAdmin ? "collective" : "individual");
    setDueDate("");
    setDescription("");
    setReceiptFile(null);
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
        
        <Button className="gap-2" onClick={() => { resetForm(); setOpen(true); }}>
          <Plus className="h-4 w-4" />
          {isAdmin ? "Nova despesa" : "Nova despesa individual"}
        </Button>

        {/* Create/Edit Dialog */}
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif">{editingId ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select 
                  value={expenseType} 
                  onValueChange={(v) => setExpenseType(v as "collective" | "individual")}
                  disabled={!!editingId} // Cannot change type on edit
                >
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
                {expenseType === "individual" && !editingId && (
                  <p className="text-xs text-muted-foreground">Esta despesa será registrada no seu nome.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Conta de luz" maxLength={200} />
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
                      {CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  {category === "other" && (
                    <Input className="mt-2" placeholder="Nome da categoria (Obrigatório)" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Vencimento (opcional)</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {editingId ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Pay Provider Dialog (Admin) */}
        <Dialog open={payProviderOpen} onOpenChange={setPayProviderOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Pagar Concessionária/Fornecedor</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Confirme o pagamento da despesa <strong>{selectedExpense?.title}</strong> no valor de <strong>R$ {selectedExpense?.amount}</strong>.
              </p>
              <div className="space-y-2">
                <Label>Comprovante *</Label>
                <Input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPayProviderOpen(false)}>Cancelar</Button>
                <Button onClick={handlePayProvider} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Confirmar Pagamento
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Pay Split Dialog (Resident) */}
        <Dialog open={paySplitOpen} onOpenChange={setPaySplitOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Pagar Minha Parte</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enviar comprovante referente a <strong>{selectedExpense?.title}</strong>. 
                Sua parte é <strong>R$ {selectedExpense?.expense_splits?.find((s:any) => s.user_id === user?.id)?.amount}</strong>.
              </p>
              <div className="space-y-2">
                <Label>Comprovante *</Label>
                <Input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPaySplitOpen(false)}>Cancelar</Button>
                <Button onClick={handlePaySplit} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Enviar Pagamento
                </Button>
              </DialogFooter>
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
          {expenses?.map((e) => (
            <ExpenseCard 
              key={e.id} 
              expense={e} 
              userId={user?.id} 
              isAdmin={isAdmin} 
              onEdit={() => openEdit(e)} 
              onDelete={() => handleDelete(e.id)}
              onPayProvider={() => { setSelectedExpense(e); setReceiptFile(null); setPayProviderOpen(true); }}
              onPaySplit={() => { setSelectedExpense(e); setReceiptFile(null); setPaySplitOpen(true); }}
            />
          ))}
        </TabsContent>

        <TabsContent value="mine" className="space-y-3 mt-4">
          {mySplits.map((s: any) => (
            <ExpenseCard 
              key={s.id} 
              expense={s.expense} 
              userId={user?.id} 
              highlightSplit={s} 
              isAdmin={isAdmin}
              onEdit={() => openEdit(s.expense)} 
              onDelete={() => handleDelete(s.expense.id)}
              onPayProvider={() => { setSelectedExpense(s.expense); setReceiptFile(null); setPayProviderOpen(true); }}
              onPaySplit={() => { setSelectedExpense(s.expense); setReceiptFile(null); setPaySplitOpen(true); }}
            />
          ))}
        </TabsContent>

        <TabsContent value="collective" className="space-y-3 mt-4">
          {collectiveExpenses.map((e) => (
            <ExpenseCard 
              key={e.id} 
              expense={e} 
              userId={user?.id} 
              isAdmin={isAdmin} 
              onEdit={() => openEdit(e)} 
              onDelete={() => handleDelete(e.id)}
              onPayProvider={() => { setSelectedExpense(e); setReceiptFile(null); setPayProviderOpen(true); }}
              onPaySplit={() => { setSelectedExpense(e); setReceiptFile(null); setPaySplitOpen(true); }}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExpenseCard({ 
  expense, userId, highlightSplit, isAdmin, 
  onEdit, onDelete, onPayProvider, onPaySplit 
}: { 
  expense: any; userId?: string; highlightSplit?: any; isAdmin: boolean;
  onEdit: () => void; onDelete: () => void; onPayProvider: () => void; onPaySplit: () => void;
}) {
  const mySplit = highlightSplit ?? expense.expense_splits?.find((s: any) => s.user_id === userId);
  const catLabel = CATEGORIES.find((c) => c.value === expense.category)?.label ?? expense.category;
  const isPast = expense.due_date && new Date(expense.due_date) < new Date();
  
  // Permissions
  const canEdit = isAdmin || (expense.created_by === userId && expense.expense_type === 'individual');
  const showPayProvider = isAdmin && expense.expense_type === 'collective' && !expense.paid_to_provider;
  const showPaySplit = mySplit && mySplit.status === 'pending';

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
              {expense.paid_to_provider && (
                 <Badge variant="outline" className="text-xs border-success text-success flex items-center gap-1">
                   <CheckCircle2 className="h-3 w-3" /> Paga ao fornecedor
                 </Badge>
              )}
            </div>
            {expense.description && <p className="text-xs text-muted-foreground mt-1">{expense.description}</p>}
            
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(expense.created_at), "dd/MM/yyyy", { locale: ptBR })}
              </span>
              {expense.receipt_url && (
                <a href={expense.receipt_url} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> Comprovante (Conta)
                </a>
              )}
            </div>
          </div>

          <div className="text-right shrink-0 flex flex-col items-end gap-1">
            <p className="text-lg font-bold font-serif">R$ {Number(expense.amount).toFixed(2)}</p>
            
            {mySplit && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Sua parte: R$ {Number(mySplit.amount).toFixed(2)}</p>
                <Badge variant={mySplit.status === "paid" ? "default" : mySplit.status === "overdue" ? "destructive" : "secondary"} className="text-xs mt-1">
                  {mySplit.status === "paid" ? "Pago" : mySplit.status === "overdue" ? "Atrasado" : "Pendente"}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Actions Bar */}
        {(canEdit || showPayProvider || showPaySplit) && (
          <div className="mt-4 pt-3 border-t flex items-center justify-between gap-2">
             <div className="flex gap-2">
                {showPayProvider && (
                  <Button size="sm" variant="default" className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={onPayProvider}>
                    <DollarSign className="h-3 w-3" /> Pagar Conta
                  </Button>
                )}
                {showPaySplit && (
                  <Button size="sm" variant="default" className="h-8 gap-1" onClick={onPaySplit}>
                    <DollarSign className="h-3 w-3" /> Pagar Minha Parte
                  </Button>
                )}
             </div>
             
             {canEdit && (
               <div className="flex gap-1">
                 <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit} title="Editar">
                   <Edit className="h-4 w-4" />
                 </Button>
                 <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete} title="Excluir">
                   <Trash2 className="h-4 w-4" />
                 </Button>
               </div>
             )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}