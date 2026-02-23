import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ShoppingLists() {
  const { membership, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [newList, setNewList] = useState({ name: "", list_type: "collective" });
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemUnit, setNewItemUnit] = useState("un");

  const { data: lists = [] } = useQuery({
    queryKey: ["shopping-lists", membership?.group_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_lists")
        .select("*")
        .eq("group_id", membership!.group_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!membership?.group_id,
  });

  const { data: listItems = [] } = useQuery({
    queryKey: ["shopping-list-items", selectedList],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_list_items")
        .select("*")
        .eq("list_id", selectedList!)
        .order("purchased")
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedList,
  });

  const createList = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shopping_lists").insert({
        group_id: membership!.group_id,
        created_by: user!.id,
        name: newList.name,
        list_type: newList.list_type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
      setOpenNew(false);
      setNewList({ name: "", list_type: "collective" });
      toast({ title: "Lista criada" });
    },
  });

  const addItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shopping_list_items").insert({
        list_id: selectedList!,
        name: newItemName,
        quantity: Number(newItemQty),
        unit: newItemUnit,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping-list-items"] });
      setNewItemName("");
      setNewItemQty("1");
    },
  });

  const togglePurchased = useMutation({
    mutationFn: async ({ id, purchased }: { id: string; purchased: boolean }) => {
      const { error } = await supabase.from("shopping_list_items").update({
        purchased,
        purchased_by: purchased ? user!.id : null,
        purchased_at: purchased ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-list-items"] }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shopping_list_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-list-items"] }),
  });

  const completeList = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shopping_lists").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
      toast({ title: "Lista concluída!" });
    },
  });

  const activeLists = lists.filter((l) => l.status === "active");
  const completedLists = lists.filter((l) => l.status === "completed");
  const currentList = lists.find((l) => l.id === selectedList);
  const purchasedCount = listItems.filter((i) => i.purchased).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif">Listas de Compras</h1>
          <p className="text-muted-foreground text-sm">Coletivas e individuais</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nova lista</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif">Nova lista de compras</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome</Label><Input value={newList.name} onChange={(e) => setNewList({ ...newList, name: e.target.value })} placeholder="Ex: Compras da semana" /></div>
              <div><Label>Tipo</Label>
                <Select value={newList.list_type} onValueChange={(v) => setNewList({ ...newList, list_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="collective">Coletiva</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={!newList.name.trim()} onClick={() => createList.mutate()}>Criar lista</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {selectedList && currentList ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Button variant="ghost" className="mb-1 px-0 text-muted-foreground" onClick={() => setSelectedList(null)}>← Voltar</Button>
              <h2 className="text-xl font-serif">{currentList.name}</h2>
              <div className="flex gap-2 mt-1">
                <Badge variant={currentList.list_type === "collective" ? "default" : "secondary"}>
                  {currentList.list_type === "collective" ? "Coletiva" : "Individual"}
                </Badge>
                <span className="text-xs text-muted-foreground">{purchasedCount}/{listItems.length} comprados</span>
              </div>
            </div>
            {currentList.status === "active" && (
              <Button variant="outline" onClick={() => completeList.mutate(currentList.id)}>
                <CheckCircle2 className="mr-2 h-4 w-4" />Concluir
              </Button>
            )}
          </div>

          {currentList.status === "active" && (
            <div className="flex gap-2">
              <Input placeholder="Nome do item" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="flex-1" onKeyDown={(e) => e.key === "Enter" && newItemName.trim() && addItem.mutate()} />
              <Input type="number" min="1" value={newItemQty} onChange={(e) => setNewItemQty(e.target.value)} className="w-20" />
              <Select value={newItemUnit} onValueChange={setNewItemUnit}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{["un", "kg", "g", "L", "ml", "pacote"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
              <Button disabled={!newItemName.trim()} onClick={() => addItem.mutate()}><Plus className="h-4 w-4" /></Button>
            </div>
          )}

          <div className="space-y-1">
            {listItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhum item ainda. Adicione acima.</p>
            ) : listItems.map((item) => (
              <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border ${item.purchased ? "bg-muted/50 opacity-60" : "bg-card"}`}>
                <Checkbox checked={item.purchased} disabled={currentList.status !== "active"} onCheckedChange={(v) => togglePurchased.mutate({ id: item.id, purchased: !!v })} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${item.purchased ? "line-through" : ""}`}>{item.name}</p>
                  <p className="text-xs text-muted-foreground">{Number(item.quantity)} {item.unit}</p>
                </div>
                {currentList.status === "active" && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteItem.mutate(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Ativas ({activeLists.length})</TabsTrigger>
            <TabsTrigger value="completed">Concluídas ({completedLists.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="space-y-3 mt-4">
            {activeLists.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma lista ativa.</CardContent></Card>
            ) : activeLists.map((list) => (
              <Card key={list.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSelectedList(list.id)}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-primary" />{list.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(list.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                  <Badge variant={list.list_type === "collective" ? "default" : "secondary"}>
                    {list.list_type === "collective" ? "Coletiva" : "Individual"}
                  </Badge>
                </CardHeader>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="completed" className="space-y-3 mt-4">
            {completedLists.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma lista concluída.</CardContent></Card>
            ) : completedLists.map((list) => (
              <Card key={list.id} className="opacity-70 cursor-pointer" onClick={() => setSelectedList(list.id)}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{list.name}</CardTitle>
                  <Badge variant="outline">Concluída</Badge>
                </CardHeader>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
