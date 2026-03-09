import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, SlidersHorizontal, User, Mail, Phone, Shield, FileText, FileSpreadsheet } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { ScrollReveal, ScrollRevealGroup } from "@/components/ui/scroll-reveal";

const tabTriggerClass = "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-foreground/60 text-xs font-semibold px-3 py-1.5 rounded-md transition-all";
const tabListClass = "w-full justify-start overflow-x-auto bg-muted/50 rounded-lg p-1 h-auto gap-1";

function AccountTab() {
  const { profile, membership, isAdmin, user, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingCsv, setGeneratingCsv] = useState(false);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name, phone: phone || null })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      toast({ title: "Perfil atualizado!" });
    },
    onError: () => toast({ title: "Erro ao atualizar perfil", variant: "destructive" }),
  });

  const generateReport = async (format: 'pdf' | 'csv') => {
    if (!membership) return;
    const setLoading = format === 'pdf' ? setGeneratingPdf : setGeneratingCsv;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: { group_id: membership.group_id, format },
      });
      if (error) throw error;
      if (!data?.file) throw new Error("Dados do arquivo não recebidos");
      const byteCharacters = atob(data.file);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: `Relatório ${format.toUpperCase()} gerado com sucesso!` });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro ao gerar relatório", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const initials = (profile?.full_name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <ScrollRevealGroup preset="blur-slide" className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="font-serif">{profile?.full_name}</CardTitle>
              <CardDescription>{profile?.email}</CardDescription>
              {membership && (
                <Badge variant={isAdmin ? "default" : "secondary"} className="mt-1">
                  {isAdmin ? "Administrador" : "Morador"} — {membership.group_name}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Separator />
          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2"><User className="h-4 w-4" />Nome completo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="flex items-center gap-2"><Mail className="h-4 w-4" />Email</Label>
              <Input value={profile?.email ?? ""} disabled className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">O email não pode ser alterado (vinculado ao Google)</p>
            </div>
            <div>
              <Label className="flex items-center gap-2"><Phone className="h-4 w-4" />Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="mt-1" />
            </div>
            <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />Relatórios Mensais
          </CardTitle>
          <CardDescription>Baixe o resumo financeiro da moradia</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={() => generateReport('pdf')} disabled={generatingPdf || generatingCsv} className="flex-1">
            {generatingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4 text-destructive" />}
            {generatingPdf ? "Gerando PDF..." : "Baixar PDF"}
          </Button>
          <Button variant="outline" onClick={() => generateReport('csv')} disabled={generatingPdf || generatingCsv} className="flex-1">
            {generatingCsv ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4 text-primary" />}
            {generatingCsv ? "Gerando CSV..." : "Baixar CSV"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Autenticação via Google OAuth 2.0</p>
          <p>Seus dados sensíveis (CPF) são protegidos por RLS e validação server-side</p>
        </CardContent>
      </Card>
    </ScrollRevealGroup>
  );
}

function GroupTab() {
  const { user, membership, refreshMembership } = useAuth();
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

  const { data: myMembership } = useQuery({
    queryKey: ["my-membership", membership?.group_id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("id, participates_in_splits")
        .eq("group_id", membership!.group_id)
        .eq("user_id", user!.id)
        .eq("active", true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!membership?.group_id && !!user?.id,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [splittingRule, setSplittingRule] = useState<string>("equal");
  const [closingDay, setClosingDay] = useState<string>("1");
  const [dueDay, setDueDay] = useState<string>("10");
  const [participatesInSplits, setParticipatesInSplits] = useState(true);

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description ?? "");
      setSplittingRule(group.splitting_rule);
      setClosingDay(String(group.closing_day || 1));
      setDueDay(String(group.due_day || 10));
    }
  }, [group]);

  useEffect(() => {
    if (myMembership) {
      setParticipatesInSplits(myMembership.participates_in_splits);
    }
  }, [myMembership]);

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

      if (myMembership) {
        const { error: memberError } = await supabase
          .from("group_members")
          .update({ participates_in_splits: participatesInSplits })
          .eq("id", myMembership.id);
        if (memberError) throw memberError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group"] });
      queryClient.invalidateQueries({ queryKey: ["my-membership"] });
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
    <ScrollReveal preset="blur-slide">
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
              <Input type="number" min="1" max="31" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} />
              <p className="text-[10px] text-muted-foreground">
                Lançamentos após este dia entram na competência do mês seguinte.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Dia de Vencimento</Label>
              <Input type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
              <p className="text-[10px] text-muted-foreground font-medium text-warning-foreground">
                Data limite para pagamento será <strong>um dia antes</strong> (Dia {parseInt(dueDay) - 1 || 30}). 
                No dia {dueDay} já será considerado atraso.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Participar dos rateios</Label>
              <p className="text-xs text-muted-foreground">
                Desative se você apenas administra o grupo e não participa das despesas.
              </p>
            </div>
            <Switch checked={participatesInSplits} onCheckedChange={setParticipatesInSplits} />
          </div>

          <Button onClick={() => updateGroup.mutate()} disabled={updateGroup.isPending} className="w-full">
            {updateGroup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Alterações
          </Button>
        </CardContent>
      </Card>
    </ScrollReveal>
  );
}

export default function GroupSettings() {
  const [activeTab, setActiveTab] = useState("account");
  const [heroCompact, setHeroCompact] = useState(false);

  const compactTabsList = (
    <TabsList className={tabListClass}>
      <TabsTrigger value="account" className={tabTriggerClass}>
        <User className="h-3.5 w-3.5 mr-1.5" /> Conta
      </TabsTrigger>
      <TabsTrigger value="group" className={tabTriggerClass}>
        <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" /> Grupo
      </TabsTrigger>
    </TabsList>
  );

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 animate-in fade-in duration-500">
      <PageHero
        title="Configurações"
        subtitle="Gerencie sua conta e o grupo."
        tone="primary"
        icon={<SlidersHorizontal className="h-4 w-4" />}
        compactTabs={compactTabsList}
        onCompactChange={setHeroCompact}
      />

      <div className="space-y-4">
        {!heroCompact && (
          <TabsList className={tabListClass}>
            <TabsTrigger value="account" className={tabTriggerClass}>
              <User className="h-3.5 w-3.5 mr-1.5" /> Conta
            </TabsTrigger>
            <TabsTrigger value="group" className={tabTriggerClass}>
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" /> Grupo
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="account" className="space-y-4 mt-4">
          <AccountTab />
        </TabsContent>

        <TabsContent value="group" className="space-y-4 mt-4">
          <GroupTab />
        </TabsContent>
      </div>
    </Tabs>
  );
}
