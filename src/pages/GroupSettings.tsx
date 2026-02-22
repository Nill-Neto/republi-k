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

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description ?? "");
      setSplittingRule(group.splitting_rule);
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
      <div>
        <h1 className="text-3xl font-serif">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie os dados do grupo.</p>
      </div>

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
          <Button onClick={() => updateGroup.mutate()} disabled={updateGroup.isPending}>
            {updateGroup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
