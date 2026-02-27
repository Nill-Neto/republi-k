import { useState, useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, AlertTriangle, Minus, PlusCircle, Trash2, ChevronLeft, ChevronRight, LayoutGrid, Loader2 } from "lucide-react";
import { format, addMonths, subMonths, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

  // --- Date Cycle Logic ---
  const { data: groupSettings } = useQuery({
    queryKey: ["group-settings-inventory", membership?.group_id],
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

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory", membership?.group_id, cycleStart.toISOString(), cycleEnd.toISOString()],
    queryFn: async () => {
      const dbStart = format(cycleStart, "yyyy-MM-dd");
      const dbEnd = format(cycleEnd, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("group_id", membership!.group_id)
        .or(`updated_at.gte.${dbStart},created_at.gte.${dbStart}`) 
        .lt("updated_at", dbEnd) 
        .order("category")
        .order("name");
      
      if (error) throw error;
      return data;
    },
    enabled: !!membership?.group_id,
  });

  const addItem = useMutation({
    // ... mutation logic
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
      <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 mb-8 overflow-hidden">
        <div className="bg-success/10 border-b border-success/20 px-4 md:px-8 py-8 md:py-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-success/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-serif text-foreground">Estoque</h1>
              <p className="text-muted-foreground font-medium">Itens movimentados nesta competência</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm border border-success/20 rounded-lg p-1 shadow-sm h-10">
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-success/10" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="px-2 text-sm font-bold min-w-[140px] text-center capitalize text-success-foreground">
                  {format(currentDate, "MMMM yyyy", { locale: ptBR })}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-success/10" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 h-10 bg-success hover:bg-success/90 shadow-lg shadow-success/20"><Plus className="h-4 w-4" /> Novo item</Button>
                </DialogTrigger>
                {/* Dialog Content... */}
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
                    <Button className="w-full bg-success hover:bg-success/90" disabled={!form.name.trim()} onClick={() => addItem.mutate()}>Adicionar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="px-1 space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="bg-success/10 p-1.5 rounded text-success-foreground">
            <Package className="h-4 w-4" />
          </div>
          <span>Competência: <strong>{format(cycleStart, "dd/MM")}</strong> até <strong>{format(subDays(cycleEnd, 1), "dd/MM")}</strong></span>
        </div>

        {lowStock.length > 0 && (
          <Card className="border-warning/50 bg-warning/5 animate-pulse">
            <CardContent className="flex items-center gap-3 py-3">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <p className="text-sm font-medium"><strong>{lowStock.length}</strong> {lowStock.length === 1 ? "item" : "itens"} com estoque baixo ou zerado.</p>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2 flex-wrap items-center">
          <div className="text-xs font-bold text-muted-foreground mr-1 uppercase tracking-wider">Filtrar:</div>
          <Badge variant={filter === "all" ? "default" : "outline"} className="cursor-pointer h-7 px-3" onClick={() => setFilter("all")}>Todos</Badge>
          <Badge variant={filter === "low" ? "destructive" : "outline"} className="cursor-pointer h-7 px-3" onClick={() => setFilter("low")}>
            <AlertTriangle className="h-3 w-3 mr-1" />Baixo Estoque
          </Badge>
          <div className="h-4 w-px bg-border mx-1" />
          {categories.map((c) => (
            <Badge key={c.value} variant={filter === c.value ? "secondary" : "outline"} className="cursor-pointer h-7 px-3" onClick={() => setFilter(c.value)}>{c.label}</Badge>
          ))}
        </div>

        {isLoading ? (
          <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed"><CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center">
            <LayoutGrid className="h-12 w-12 mb-2 opacity-10" />
            <p>Nenhum item movimentado nesta competência.</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => {
              const isLow = Number(item.quantity) <= Number(item.min_quantity);
              return (
                <Card key={item.id} className={cn("group transition-all hover:shadow-md", isLow ? "border-warning/40 bg-warning/5 shadow-sm shadow-warning/5" : "")}>
                  <CardHeader className="pb-2 flex flex-row items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base truncate font-semibold">{item.name}</CardTitle>
                      <Badge variant="secondary" className="text-[10px] h-5 mt-1 bg-background border-0">{categories.find((c) => c.value === item.category)?.label ?? item.category}</Badge>
                    </div>
                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover item?</AlertDialogTitle>
                            <AlertDialogDescription>Tem certeza que deseja remover "{item.name}" do estoque?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteItem.mutate(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </CardHeader>
                  <CardContent className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-3 bg-background rounded-full p-1 border shadow-sm">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary" onClick={() => updateQty.mutate({ id: item.id, delta: -1 })}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <div className="flex flex-col items-center min-w-[40px]">
                        <span className="text-lg font-bold leading-tight">{Number(item.quantity)}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-medium">{item.unit}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary" onClick={() => updateQty.mutate({ id: item.id, delta: 1 })}>
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                    </div>
                    {isLow && (
                      <div className="bg-warning/20 p-2 rounded-full">
                        <AlertTriangle className="h-5 w-5 text-warning" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}