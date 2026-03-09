import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, ChevronLeft } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import type { GroupAddress } from "@/components/onboarding/GroupSettingsStep";

type SplittingRule = "equal" | "percentage";

export default function NewGroup() {
  const { user, refreshMembership, setActiveGroupId } = useAuth();
  const navigate = useNavigate();

  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [splittingRule, setSplittingRule] = useState<SplittingRule>("equal");
  const [closingDay, setClosingDay] = useState(1);
  const [dueDay, setDueDay] = useState(10);
  const [address, setAddress] = useState<GroupAddress>({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zipCode: "",
  });
  const [fetchingCep, setFetchingCep] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAddressByCep = useCallback(async (cep: string) => {
    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setAddress((prev) => ({
          ...prev,
          zipCode: cep.slice(0, 5) + "-" + cep.slice(5),
          street: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: data.uf || "",
        }));
      } else {
        toast({ title: "CEP não encontrado", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao buscar CEP", variant: "destructive" });
    } finally {
      setFetchingCep(false);
    }
  }, []);

  const handleCepChange = (value: string) => {
    const clean = value.replace(/\D/g, "");
    let formatted = clean;
    if (clean.length > 5) {
      formatted = clean.slice(0, 5) + "-" + clean.slice(5, 8);
    }
    setAddress((prev) => ({ ...prev, zipCode: formatted }));
    if (clean.length === 8) {
      fetchAddressByCep(clean);
    }
  };

  const updateAddress = (field: keyof GroupAddress, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast({ title: "Erro", description: "Informe o nome do grupo.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("create_group_with_admin", {
        _name: groupName.trim(),
        _description: groupDescription.trim() || null,
        _splitting_rule: splittingRule,
      });
      if (error) throw error;

      const newGroupId = data as string;

      const { error: updateErr } = await supabase
        .from("groups")
        .update({
          street: address.street.trim() || null,
          street_number: address.number.trim() || null,
          complement: address.complement.trim() || null,
          neighborhood: address.neighborhood.trim() || null,
          city: address.city.trim() || null,
          state: address.state.trim() || null,
          zip_code: address.zipCode.replace(/\D/g, "") || null,
          closing_day: closingDay,
          due_day: dueDay,
        })
        .eq("id", newGroupId);
      if (updateErr) throw updateErr;

      await refreshMembership();
      setActiveGroupId(newGroupId);

      toast({ title: "Grupo criado!", description: `"${groupName}" está pronto. Convide seus moradores.` });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-xl">
      <PageHero
        title="Novo Grupo"
        subtitle="Crie uma nova moradia para administrar."
        tone="default"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados da moradia</CardTitle>
          <CardDescription>Você será o administrador deste grupo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="groupName">Nome da moradia</Label>
            <Input
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder='Ex: "República Central"'
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Endereço</Label>
            <div className="space-y-2">
              <div className="relative">
                <Input
                  placeholder="CEP (ex: 01001-000)"
                  value={address.zipCode}
                  onChange={(e) => handleCepChange(e.target.value)}
                  maxLength={9}
                />
                {fetchingCep && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              <Input placeholder="Rua / Logradouro" value={address.street} onChange={(e) => updateAddress("street", e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Número" value={address.number} onChange={(e) => updateAddress("number", e.target.value)} />
                <Input placeholder="Complemento" value={address.complement} onChange={(e) => updateAddress("complement", e.target.value)} />
              </div>
              <Input placeholder="Bairro" value={address.neighborhood} onChange={(e) => updateAddress("neighborhood", e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Cidade" value={address.city} onChange={(e) => updateAddress("city", e.target.value)} />
                <Input placeholder="UF" value={address.state} onChange={(e) => updateAddress("state", e.target.value)} maxLength={2} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupDesc">Descrição (opcional)</Label>
            <Input
              id="groupDesc"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              placeholder="Endereço ou detalhes da moradia"
            />
          </div>

          <div className="space-y-2">
            <Label>Regra de rateio padrão</Label>
            <Select value={splittingRule} onValueChange={(v) => setSplittingRule(v as SplittingRule)}>
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
              <Input type="number" min={1} max={31} value={closingDay} onChange={(e) => setClosingDay(parseInt(e.target.value) || 1)} />
              <p className="text-[10px] text-muted-foreground">
                Lançamentos após este dia entram na competência do mês seguinte.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Dia de Vencimento</Label>
              <Input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(parseInt(e.target.value) || 10)} />
              <p className="text-[10px] text-muted-foreground font-medium">
                Data limite para pagamento será <strong>um dia antes</strong> (Dia {(dueDay - 1) || 30}).
                No dia {dueDay} já será considerado atraso.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button onClick={handleCreate} disabled={saving} className="flex-1">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar Grupo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
