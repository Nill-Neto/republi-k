import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { Loader2, Plus, RefreshCw, Calendar, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHero } from "@/components/layout/PageHero";
import { ScrollRevealGroup } from "@/components/ui/scroll-reveal";

const CATEGORIES = [
  { value: "rent", label: "Aluguel" },
  { value: "utilities", label: "Contas" },
  { value: "internet", label: "Internet/TV" },
  { value: "cleaning", label: "Limpeza" },
  { value: "other", label: "Outros" },
];

export default function RecurringExpenses() {
  const { membership, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  
  // State for Create/Edit Dialog
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form Fields
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [frequency, setFrequency] = useState("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [description, setDescription] = useState("");
  const [expenseType, setExpenseType] = useState<"collective" | "individual">(isAdmin ? "collective" : "individual");
  const [saving, setSaving] = useState(false);

  const { data: recurring, isLoading } = useQuery({
    queryKey: ["recurring", membership?.group_id],
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

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setAmount("");
    setCategory("other");
    setFrequency("monthly");
    setDayOfMonth("1");
    setDescription("");
    setExpenseType(isAdmin ? "collective" : "individual");
  };

  const handleOpenEdit = (rec: any) => {
    setEditingId(rec.id);
    setTitle(rec.title);
    setAmount(String(rec.amount));
    setCategory(CATEGORIES.some(c => c.value === rec.category) ? rec.category : "other");
    setFrequency(rec.frequency);
    setDayOfMonth(String(rec.day_of_month || 1));
    setDescription(rec.description || "");
    setExpenseType(rec.expense_type || "collective");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !amount || parseFloat(amount) <= 0) {
      toast({ title: "Erro", description: "Preencha título e valor.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const day = parseInt(dayOfMonth);
      
      const basePayload = {
        group_id: membership!.group_id,
        created_by: user!.id,
        title: title.trim(),
        description: description.trim() || null,
        amount: parseFloat(amount),
        category,
        frequency,
        day_of_month: day,
        expense_type: expenseType,
      } as any;

      if (editingId) {
        const { error } = await supabase.from("recurring_expenses").update(basePayload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Recorrência atualizada!" });
      } else {
        // Calculate next due date only for new items
        const now = new Date();
        let nextDue = new Date(now.getFullYear(), now.getMonth(), day);
        if (nextDue <= now) {
          nextDue.setMonth(nextDue.getMonth() + 1);
        }

        const { error } = await supabase.from("recurring_expenses").insert({
          ...basePayload,
          next_due_date: nextDue.toISOString().split("T")[0]
        });
        if (error) throw error;
        toast({ title: "Recorrência criada!", description: `"${title}" será gerada automaticamente.` });
      }

      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      setOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteRecurring = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      toast({ title: "Recorrência excluída." });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("recurring_expenses").update({ active: !active }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
    }
  };

  const generateNow = async (rec: any) => {
    try {
      const { error } = await supabase.rpc("create_expense_with_splits", {
        _group_id: rec.group_id,
        _title: rec.title,
        _description: rec.description,
        _amount: rec.amount,
        _category: rec.category,
        _expense_type: rec.expense_type || "collective",
        _due_date: rec.next_due_date,
        _recurring_expense_id: rec.id,
      });
      if (error) throw error;

      // Advance next_due_date
      const next = new Date(rec.next_due_date + "T12:00:00");
      if (rec.frequency === "monthly") next.setMonth(next.getMonth() + 1);
      else if (rec.frequency === "weekly") next.setDate(next.getDate() + 7);
      else next.setFullYear(next.getFullYear() + 1);

      await supabase.from("recurring_expenses").update({
        next_due_date: next.toISOString().split("T")[0],
        last_generated_at: new Date().toISOString(),
      }).eq("id", rec.id);

      toast({ title: "Despesa gerada!", description: `"${rec.title}" criada com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
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
      <PageHero
        title="Recorrências"
        subtitle="Despesas automáticas mensais"
        tone="primary"
        icon={<RefreshCw className="h-4 w-4" />}
        actions={
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Nova Recorrência</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">{editingId ? "Editar Recorrência" : "Nova Despesa Recorrente"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Expense Type Selector */}
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={expenseType} onValueChange={(v) => setExpenseType(v as any)} disabled={!!editingId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {isAdmin && <SelectItem value="collective">Coletiva</SelectItem>}
                      <SelectItem value="individual">Individual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Aluguel" maxLength={200} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Frequência</Label>
                    <Select value={frequency} onValueChange={setFrequency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="yearly">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Dia do mês</Label>
                    <Input type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingId ? "Salvar Alterações" : "Criar Recorrência"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {recurring?.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma recorrência configurada.</CardContent></Card>
      )}

      <ScrollRevealGroup preset="blur-slide" className="space-y-3">
        {recurring?.map((r) => {
          const catLabel = CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category;
          return (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{r.title}</p>
                      <Badge variant="outline" className="text-xs">{catLabel}</Badge>
                      <Badge variant={(r as any).expense_type === "collective" ? "default" : "secondary"} className="text-xs">
                        {(r as any).expense_type === "collective" ? "Coletiva" : "Individual"}
                      </Badge>
                      <Badge variant={r.active ? "default" : "secondary"} className="text-xs">
                        {r.active ? "Ativa" : "Pausada"}
                      </Badge>
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Próximo: {format(new Date(r.next_due_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-2">
                    <p className="text-lg font-bold">R$ {Number(r.amount).toFixed(2)}</p>
                    {(isAdmin || r.created_by === user?.id) && (
                      <div className="flex items-center gap-1 mt-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleOpenEdit(r)} title="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir recorrência?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir "{r.title}"? Novas despesas não serão geradas automaticamente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteRecurring.mutate(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <div className="w-px h-4 bg-border mx-1" />
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Gerar agora">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Gerar despesa agora?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Isso criará a despesa "{r.title}" imediatamente na aba Despesas e avançará a próxima data de vencimento.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => generateNow(r)}>
                                Gerar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <Switch checked={r.active} onCheckedChange={() => toggleActive(r.id, r.active)} className="ml-1" />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </ScrollRevealGroup>
    </div>
  );
}