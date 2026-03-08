import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2, Plus, Trash2, BookOpen } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { ScrollRevealGroup } from "@/components/ui/scroll-reveal";

interface HouseRule {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  active: boolean;
}

export default function HouseRules() {
  const { user, membership, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["house-rules", membership?.group_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("house_rules")
        .select("*")
        .eq("group_id", membership!.group_id)
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as HouseRule[];
    },
    enabled: !!membership?.group_id,
  });

  const createRule = useMutation({
    mutationFn: async () => {
      const maxOrder = rules.length > 0 ? Math.max(...rules.map((r) => r.sort_order)) : 0;
      const { error } = await supabase.from("house_rules").insert({
        group_id: membership!.group_id,
        created_by: user!.id,
        title: title.trim(),
        description: description.trim() || null,
        sort_order: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["house-rules"] });
      setTitle("");
      setDescription("");
      setOpen(false);
      toast({ title: "Regra adicionada!" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("house_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["house-rules"] });
      toast({ title: "Regra removida." });
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Regras da Casa"
        subtitle="Combinados de convivência da república."
        tone="primary"
        icon={<BookOpen className="h-4 w-4" />}
        actions={isAdmin ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Regra</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Adicionar Regra</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Título da regra" value={title} onChange={(e) => setTitle(e.target.value)} />
                <Textarea placeholder="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                <Button onClick={() => createRule.mutate()} disabled={!title.trim() || createRule.isPending} className="w-full">
                  {createRule.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Adicionar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : undefined}
      />

      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma regra cadastrada ainda.</p>
            {isAdmin && <p className="text-sm mt-1">Clique em "Nova Regra" para começar.</p>}
          </CardContent>
        </Card>
      ) : (
        <ScrollRevealGroup preset="blur-slide" className="space-y-3">
          {rules.map((rule, idx) => (
            <Card key={rule.id}>
              <CardContent className="flex items-start gap-4 py-4">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">{rule.title}</h3>
                  {rule.description && <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>}
                </div>
                {isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover regra?</AlertDialogTitle>
                        <AlertDialogDescription>Tem certeza que deseja remover esta regra?</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteRule.mutate(rule.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>
          ))}
        </ScrollRevealGroup>
      )}
    </div>
  );
}