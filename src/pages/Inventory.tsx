import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, AlertTriangle, Minus, PlusCircle, Trash2 } from "lucide-react";

const categories = [
  { value: "limpeza", label: "Limpeza" },
  { value: "cozinha", label: "Cozinha" },
  { value: "banheiro", label: "Banheiro" },
  { value: "higiene", label: "Higiene" },
  { value: "alimentos", label: "Alimentos" },
  { value: "geral", label: "Geral" },
];

const units = ["un", "kg", "g", "L", "ml", "pacote", "rolo", "caixa"];

export default function Inventory() {
  const { membership, user, isAdmin } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ name: "", category: "geral", quantity: "1", unit: "un", min_quantity: "1" });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory", membership?.group_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("group_id", membership!.group_id)
        .order("category")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!membership?.group_id,
  });

  const addItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("inventory_items").insert({
        group_id: membership!.group_id,
        created_by: user!.id,
        name: form.name,
        category: form.category,
        quantity: Number(form.quantity),
        unit: form.unit,
        min_quantity: Number(form.min_quantity),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setOpen(false);
      setForm({ name: "", category: "geral", quantity: "1", unit: "un", min_quantity: "1" });
      toast({ title: "Item adicionado ao estoque" });
    },
    onError: () => toast({ title: "Erro ao adicionar item", variant: "destructive" }),
  });

  const updateQty = useMutation({
    mutationFn: async ({ id, delta }: { id: string; delta: number }) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      const newQty = Math.max(0, Number(item.quantity) + delta);
      const { error } = await supabase.from("inventory_items").update({ quantity: newQty }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: "Item removido" });
    },
  });

  const lowStock = items.filter((i) => Number(i.quantity) <= Number(i.min_quantity));
  const filtered = filter === "all" ? items : filter === "low" ? lowStock : items.filter((i) => i.category === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif">Estoque</h1>
          <p className="text-muted-foreground text-sm">Itens compartilhados da república</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Novo item</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif">Adicionar item</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Detergente" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Unidade</Label>
                  <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Quantidade</Label><Input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
                <div><Label>Qtd. mínima</Label><Input type="number" min="0" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: e.target.value })} /></div>
              </div>
              <Button className="w-full" disabled={!form.name.trim()} onClick={() => addItem.mutate()}>Adicionar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {lowStock.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <p className="text-sm"><strong>{lowStock.length}</strong> {lowStock.length === 1 ? "item" : "itens"} com estoque baixo</p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap">
        <Badge variant={filter === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilter("all")}>Todos</Badge>
        <Badge variant={filter === "low" ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilter("low")}>
          <AlertTriangle className="h-3 w-3 mr-1" />Estoque baixo
        </Badge>
        {categories.map((c) => (
          <Badge key={c.value} variant={filter === c.value ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilter(c.value)}>{c.label}</Badge>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum item encontrado.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const isLow = Number(item.quantity) <= Number(item.min_quantity);
            return (
              <Card key={item.id} className={isLow ? "border-warning/50" : ""}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <Badge variant="secondary" className="text-xs mt-1">{categories.find((c) => c.value === item.category)?.label ?? item.category}</Badge>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteItem.mutate(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty.mutate({ id: item.id, delta: -1 })}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="font-serif text-xl w-12 text-center">{Number(item.quantity)}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty.mutate({ id: item.id, delta: 1 })}>
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">{item.unit}</span>
                  </div>
                  {isLow && <AlertTriangle className="h-4 w-4 text-warning" />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
