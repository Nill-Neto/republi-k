import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";

export default function GroupSettings() {
  const { membership, refreshMembership } = useAuth();
  const queryClient = useQueryClient();

  const { data: group, isLoading } = useQuery({
    queryKey: ["group", membership?.group_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("id", membership!.group_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!membership?.group_id,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [splittingRule, setSplittingRule] = useState<string>("equal");
  const [closingDay, setClosingDay] = useState<string>("1");
  const [dueDay, setDueDay] = useState<string>("10");

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description ?? "");
      setSplittingRule(group.splitting_rule);
      setClosingDay(String(group.closing_day || 1));
      setDueDay(String(group.due_day || 10));
    }
  }, [group]);

  const updateGroup = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("groups")
        .update({
          name: name.trim(),
          description: description.trim() || null,
          splitting_rule: splittingRule as any,
          closing_day: parseInt(closingDay),
          due_day: parseInt(dueDay),
        })
        .eq("id", membership!.group_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group"] });
      refreshMembership();
      toast({ title: "Salvo!", description: "Configurações atualizadas." });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <PageHero
        title="Configurações"
        subtitle="Gerencie os dados do grupo."
        tone="warning"
        icon={<SlidersHorizontal className="h-4 w-4" />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados da moradia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Regra de rateio</Label>
            <Select value={splittingRule} onValueChange={setSplittingRule}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal">Divisão igualitária</SelectItem>
                <SelectItem value="percentage">Por peso/percentual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dia de Fechamento</Label>
              <Input 
                type="number" 
                min="1" 
                max="31" 
                value={closingDay} 
                onChange={(e) => setClosingDay(e.target.value)} 
              />
              <p className="text-[10px] text-muted-foreground">
                Lançamentos após este dia entram na competência do mês seguinte.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Dia de Vencimento</Label>
              <Input 
                type="number" 
                min="1" 
                max="31" 
                value={dueDay} 
                onChange={(e) => setDueDay(e.target.value)} 
              />
              <p className="text-[10px] text-muted-foreground font-medium text-warning-foreground">
                Data limite para pagamento será <strong>um dia antes</strong> (Dia {parseInt(dueDay) - 1 || 30}). 
                No dia {dueDay} já será considerado atraso.
              </p>
            </div>
          </div>

          <Button onClick={() => updateGroup.mutate()} disabled={updateGroup.isPending} className="w-full">
            {updateGroup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Alterações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}