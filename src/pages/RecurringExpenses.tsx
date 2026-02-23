import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, RefreshCw, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [frequency, setFrequency] = useState("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [description, setDescription] = useState("");
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

  const handleCreate = async () => {
    if (!title.trim() || !amount || parseFloat(amount) <= 0) {
      toast({ title: "Erro", description: "Preencha título e valor.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const day = parseInt(dayOfMonth);
      const now = new Date();
      let nextDue = new Date(now.getFullYear(), now.getMonth(), day);
      if (nextDue <= now) {
        nextDue.setMonth(nextDue.getMonth() + 1);
      }

      const { error } = await supabase.from("recurring_expenses").insert({
        group_id: membership!.group_id,
        created_by: user!.id,
        title: title.trim(),
        description: description.trim() || null,
        amount: parseFloat(amount),
        category,
        frequency,
        day_of_month: day,
        next_due_date: nextDue.toISOString().split("T")[0],
      });
      if (error) throw error;

      toast({ title: "Recorrência criada!", description: `"${title}" será gerada automaticamente.` });
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      setOpen(false);
      setTitle("");
      setAmount("");
      setCategory("other");
      setDescription("");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

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
        _expense_type: "collective",
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif">Recorrências</h1>
          <p className="text-muted-foreground mt-1">Despesas automáticas mensais</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Nova Recorrência</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Nova Despesa Recorrente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
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
                <Button onClick={handleCreate} disabled={saving} className="w-full">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Criar Recorrência
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {recurring?.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma recorrência configurada.</CardContent></Card>
      )}

      <div className="space-y-3">
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
                    <p className="text-lg font-bold font-serif">R$ {Number(r.amount).toFixed(2)}</p>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => generateNow(r)}>
                          <RefreshCw className="h-3 w-3" /> Gerar agora
                        </Button>
                        <Switch checked={r.active} onCheckedChange={() => toggleActive(r.id, r.active)} />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
