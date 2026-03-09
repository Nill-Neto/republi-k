import { useState, useEffect, useRef } from "react";
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
import { Loader2, Save, SlidersHorizontal, User, Mail, Phone, Shield, FileText, FileSpreadsheet, Upload, Check, MapPin } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { ScrollReveal, ScrollRevealGroup } from "@/components/ui/scroll-reveal";
import { formatCPF, isValidCPF } from "@/lib/cpf";

const tabTriggerClass = "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-foreground/60 text-xs font-semibold px-3 py-1.5 rounded-md transition-all";
const tabListClass = "w-full justify-start overflow-x-auto bg-muted/50 rounded-lg p-1 h-auto gap-1";

function AccountTab() {
  const { profile, membership, isAdmin, user, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [cpf, setCpf] = useState("");
  const [cpfError, setCpfError] = useState("");
  const [cpfLoaded, setCpfLoaded] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingCsv, setGeneratingCsv] = useState(false);

  // Document upload states
  const [rgFront, setRgFront] = useState<File | null>(null);
  const [rgBack, setRgBack] = useState<File | null>(null);
  const [rgDigital, setRgDigital] = useState<File | null>(null);
  const [hasExistingDocs, setHasExistingDocs] = useState({ front: false, back: false, digital: false });
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const digitalRef = useRef<HTMLInputElement>(null);

  // Load CPF
  useEffect(() => {
    if (!user) return;
    supabase.rpc("read_my_cpf").then(({ data }) => {
      if (data) setCpf(formatCPF(data));
      setCpfLoaded(true);
    });
    // Check existing docs
    supabase.from("profile_sensitive").select("rg_front_url, rg_back_url, rg_digital_url").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setHasExistingDocs({
          front: !!data.rg_front_url,
          back: !!data.rg_back_url,
          digital: !!data.rg_digital_url,
        });
      }
    });
  }, [user]);

  useEffect(() => {
    if (profile) {
      setName(profile.full_name);
      setNickname(profile.nickname ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const handleCpfChange = (value: string) => {
    setCpf(formatCPF(value));
    setCpfError("");
  };

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!user) return;

      // Validate CPF if provided
      const cleanedCpf = cpf.replace(/\D/g, "");
      if (cleanedCpf.length > 0 && cleanedCpf.length !== 11) {
        throw new Error("CPF deve ter 11 dígitos");
      }
      if (cleanedCpf.length === 11 && !isValidCPF(cleanedCpf)) {
        throw new Error("CPF inválido");
      }

      // Update profile
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          full_name: name.trim(),
          nickname: nickname.trim() || null,
          phone: phone.trim() || null,
        })
        .eq("id", user.id);
      if (profileErr) throw profileErr;

      // Update CPF & docs if CPF is valid
      if (cleanedCpf.length === 11) {
        const docUpdates: Record<string, string | null> = {};

        // Upload new docs
        if (rgFront) {
          const ext = rgFront.name.split(".").pop() || "jpg";
          await supabase.storage.from("documents").upload(`${user.id}/rg-front.${ext}`, rgFront, { upsert: true });
          docUpdates.rg_front_url = `${user.id}/rg-front.${ext}`;
        }
        if (rgBack) {
          const ext = rgBack.name.split(".").pop() || "jpg";
          await supabase.storage.from("documents").upload(`${user.id}/rg-back.${ext}`, rgBack, { upsert: true });
          docUpdates.rg_back_url = `${user.id}/rg-back.${ext}`;
        }
        if (rgDigital) {
          await supabase.storage.from("documents").upload(`${user.id}/rg-digital.pdf`, rgDigital, { upsert: true });
          docUpdates.rg_digital_url = `${user.id}/rg-digital.pdf`;
        }

        const { error: cpfErr } = await supabase
          .from("profile_sensitive")
          .upsert({
            user_id: user.id,
            cpf: cleanedCpf,
            ...docUpdates,
          });
        if (cpfErr) throw cpfErr;
      }
    },
    onSuccess: async () => {
      await refreshProfile();
      setRgFront(null);
      setRgBack(null);
      setRgDigital(null);
      toast({ title: "Perfil atualizado!" });
    },
    onError: (err: any) => {
      if (err.message?.includes("CPF")) {
        setCpfError(err.message);
      } else {
        toast({ title: "Erro ao atualizar perfil", description: err.message, variant: "destructive" });
      }
    },
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
              <Label className="flex items-center gap-2"><User className="h-4 w-4" />Apelido</Label>
              <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Como prefere ser chamado" className="mt-1" />
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

            <Separator />

            {/* CPF */}
            <div>
              <Label>CPF</Label>
              <Input
                value={cpf}
                onChange={(e) => handleCpfChange(e.target.value)}
                placeholder="000.000.000-00"
                maxLength={14}
                className={`mt-1 ${cpfError ? "border-destructive" : ""}`}
              />
              {cpfError && <p className="text-sm text-destructive mt-1">{cpfError}</p>}
              <p className="text-xs text-muted-foreground mt-1">Visível apenas para você e o administrador do grupo.</p>
            </div>

            {/* RG Documents */}
            <div className="space-y-3">
              <Label>RG — Frente e Verso</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input ref={frontRef} type="file" accept="image/*" className="hidden" onChange={(e) => setRgFront(e.target.files?.[0] || null)} />
                  <Button type="button" variant={(rgFront || hasExistingDocs.front) ? "default" : "outline"} className="w-full gap-2 h-auto py-3" onClick={() => frontRef.current?.click()}>
                    {(rgFront || hasExistingDocs.front) ? <Check className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                    <span className="text-xs">{rgFront ? "Novo ✓" : hasExistingDocs.front ? "Enviado ✓" : "Frente"}</span>
                  </Button>
                </div>
                <div>
                  <input ref={backRef} type="file" accept="image/*" className="hidden" onChange={(e) => setRgBack(e.target.files?.[0] || null)} />
                  <Button type="button" variant={(rgBack || hasExistingDocs.back) ? "default" : "outline"} className="w-full gap-2 h-auto py-3" onClick={() => backRef.current?.click()}>
                    {(rgBack || hasExistingDocs.back) ? <Check className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                    <span className="text-xs">{rgBack ? "Novo ✓" : hasExistingDocs.back ? "Enviado ✓" : "Verso"}</span>
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ou RG Digital (PDF)</Label>
              <input ref={digitalRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => setRgDigital(e.target.files?.[0] || null)} />
              <Button type="button" variant={(rgDigital || hasExistingDocs.digital) ? "default" : "outline"} className="w-full gap-2" onClick={() => digitalRef.current?.click()}>
                {(rgDigital || hasExistingDocs.digital) ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                {rgDigital ? rgDigital.name : hasExistingDocs.digital ? "RG Digital enviado ✓" : "Selecionar PDF"}
              </Button>
            </div>

            <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending} className="w-full">
              {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
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
          <p>Seus dados sensíveis (CPF) são protegidos por criptografia e validação server-side</p>
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

  // Address fields
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [fetchingCep, setFetchingCep] = useState(false);

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description ?? "");
      setSplittingRule(group.splitting_rule);
      setClosingDay(String(group.closing_day || 1));
      setDueDay(String(group.due_day || 10));
      setStreet(group.street ?? "");
      setStreetNumber(group.street_number ?? "");
      setComplement(group.complement ?? "");
      setNeighborhood(group.neighborhood ?? "");
      setCity(group.city ?? "");
      setState(group.state ?? "");
      setZipCode(group.zip_code ?? "");
    }
  }, [group]);

  useEffect(() => {
    if (myMembership) {
      setParticipatesInSplits(myMembership.participates_in_splits);
    }
  }, [myMembership]);

  const handleCepChange = async (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const formatted = cleaned.length > 5 ? `${cleaned.slice(0, 5)}-${cleaned.slice(5, 8)}` : cleaned;
    setZipCode(formatted);

    if (cleaned.length === 8) {
      setFetchingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setStreet(data.logradouro || "");
          setNeighborhood(data.bairro || "");
          setCity(data.localidade || "");
          setState(data.uf || "");
        }
      } catch { /* ignore */ } finally {
        setFetchingCep(false);
      }
    }
  };

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
          street: street.trim() || null,
          street_number: streetNumber.trim() || null,
          complement: complement.trim() || null,
          neighborhood: neighborhood.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          zip_code: zipCode.replace(/\D/g, "") || null,
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
    <ScrollRevealGroup preset="blur-slide" className="space-y-4">
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
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: República masculina próxima à USP" />
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
        </CardContent>
      </Card>

      {/* Address Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Endereço
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>CEP</Label>
            <div className="relative">
              <Input value={zipCode} onChange={(e) => handleCepChange(e.target.value)} placeholder="00000-000" maxLength={9} />
              {fetchingCep && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Rua</Label>
              <Input value={street} onChange={(e) => setStreet(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Apto, Bloco..." />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={2} placeholder="SP" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => updateGroup.mutate()} disabled={updateGroup.isPending} className="w-full">
        {updateGroup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Salvar Alterações
      </Button>
    </ScrollRevealGroup>
  );
}

export default function GroupSettings() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("account");
  const [heroCompact, setHeroCompact] = useState(false);

  const tabItems = (
    <>
      <TabsTrigger value="account" className={tabTriggerClass}>
        <User className="h-3.5 w-3.5 mr-1.5" /> Conta
      </TabsTrigger>
      {isAdmin && (
        <TabsTrigger value="group" className={tabTriggerClass}>
          <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" /> Grupo
        </TabsTrigger>
      )}
    </>
  );

  const compactTabsList = (
    <TabsList className={tabListClass}>{tabItems}</TabsList>
  );

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 animate-in fade-in duration-500">
      <PageHero
        title="Configurações"
        subtitle={isAdmin ? "Gerencie sua conta e o grupo." : "Gerencie sua conta."}
        tone="primary"
        icon={<SlidersHorizontal className="h-4 w-4" />}
        compactTabs={compactTabsList}
        onCompactChange={setHeroCompact}
      />

      <div className="space-y-4">
        {!heroCompact && (
          <TabsList className={tabListClass}>{tabItems}</TabsList>
        )}

        <TabsContent value="account" className="space-y-4 mt-4">
          <AccountTab />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="group" className="space-y-4 mt-4">
            <GroupTab />
          </TabsContent>
        )}
      </div>
    </Tabs>
  );
}
