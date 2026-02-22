import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isValidCPF, formatCPF } from "@/lib/cpf";
import { toast } from "@/hooks/use-toast";
import { Loader2, ChevronRight, ChevronLeft } from "lucide-react";

type Step = "terms" | "cpf" | "group";

export default function Onboarding() {
  const { user, profile, membership, refreshProfile, refreshMembership } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("terms");
  const [accepted, setAccepted] = useState(false);
  const [cpf, setCpf] = useState("");
  const [cpfError, setCpfError] = useState("");
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState("");

  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [splittingRule, setSplittingRule] = useState<"equal" | "percentage">("equal");

  const [saving, setSaving] = useState(false);
  const [inviteFlag, setInviteFlag] = useState(false);

  const hasInvite = !!membership || inviteFlag;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setInviteFlag(window.sessionStorage.getItem("accepted-invite") === "true");
  }, []);

  useEffect(() => {
    if (!membership) return;
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem("accepted-invite");
    setInviteFlag(false);
  }, [membership]);

  const clearInviteFlag = () => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem("accepted-invite");
    setInviteFlag(false);
  };

  const hasInviteParam = hasInvite;

  const handleCpfChange = (value: string) => {
    const formatted = formatCPF(value);
    setCpf(formatted);
    setCpfError("");
  };

  const validateCpf = () => {
    const cleaned = cpf.replace(/\D/g, "");
    if (!isValidCPF(cleaned)) {
      setCpfError("CPF inválido. Verifique os dígitos.");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!user) return;

    if (!validateCpf()) return;
    if (!fullName.trim()) {
      toast({ title: "Erro", description: "Informe seu nome completo.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const cleanedCpf = cpf.replace(/\D/g, "");
      const { error: cpfErr } = await supabase
        .from("profile_sensitive")
        .upsert({ user_id: user.id, cpf: cleanedCpf });
      if (cpfErr) throw cpfErr;

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          onboarding_completed: hasInviteParam,
        })
        .eq("id", user.id);
      if (profileErr) throw profileErr;

      if (hasInviteParam) {
        await refreshProfile();
        toast({ title: "Bem-vindo!", description: "Seu cadastro foi concluído." });
        clearInviteFlag();
        navigate("/", { replace: true });
      } else {
        setStep("group");
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateGroup = async () => {
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

      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user!.id);

      await Promise.all([refreshProfile(), refreshMembership()]);

      toast({ title: "Grupo criado!", description: `"${groupName}" está pronto. Convide seus moradores.` });
      clearInviteFlag();
      navigate("/", { replace: true });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  if (step === "terms") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Termos de Uso</CardTitle>
            <CardDescription>
              {hasInviteParam
                ? "Você foi convidado para uma moradia. Leia e aceite os termos para continuar."
                : "Ao continuar, você será o administrador de uma nova moradia."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground max-h-60 overflow-y-auto space-y-3">
              <p>
                <strong>1. Dados pessoais:</strong> Seu CPF será armazenado de forma segura e visível apenas para
                você e o administrador do seu grupo.
              </p>
              <p>
                <strong>2. Despesas:</strong> O administrador é responsável por registrar despesas coletivas e definir
                regras de rateio.
              </p>
              <p>
                <strong>3. Comprovantes:</strong> Pagamentos devem ser acompanhados de comprovantes (fotos) para
                prestação de contas.
              </p>
              <p>
                <strong>4. Transparência:</strong> Todas as movimentações financeiras são registradas e visíveis aos
                membros do grupo.
              </p>
              <p>
                <strong>5. Sugestões:</strong> Moradores podem sugerir alterações, que serão avaliadas pelo
                administrador.
              </p>
              <p>
                <strong>6. Saída:</strong> Ao deixar o grupo, você poderá exportar todo o seu histórico de dados.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="accept"
                checked={accepted}
                onCheckedChange={(checked) => setAccepted(checked === true)}
              />
              <Label htmlFor="accept" className="text-sm cursor-pointer">
                Li e concordo com os termos de uso
              </Label>
            </div>

            <Button onClick={() => setStep("cpf")} disabled={!accepted} className="w-full" size="lg">
              Continuar <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "cpf") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Seus Dados</CardTitle>
            <CardDescription>Complete seu cadastro para continuar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={cpf}
                onChange={(e) => handleCpfChange(e.target.value)}
                placeholder="000.000.000-00"
                maxLength={14}
                className={cpfError ? "border-destructive" : ""}
              />
              {cpfError && <p className="text-sm text-destructive">{cpfError}</p>}
              <p className="text-xs text-muted-foreground">Visível apenas para você e o administrador do grupo.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone (opcional)</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("terms")} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {hasInviteParam ? "Concluir Cadastro" : "Próximo"}
                {!hasInviteParam && <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Criar Moradia</CardTitle>
          <CardDescription>Você será o administrador deste grupo. Configure os detalhes da moradia.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="groupName">Nome da moradia</Label>
            <Input id="groupName" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder='Ex: "República Central"' />
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
            <Select value={splittingRule} onValueChange={(v) => setSplittingRule(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal">Divisão igualitária</SelectItem>
                <SelectItem value="percentage">Por peso/percentual</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {splittingRule === "equal"
                ? "Despesas coletivas divididas igualmente entre todos."
                : "Cada morador terá um percentual definido por você."}
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("cpf")} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button onClick={handleCreateGroup} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Criar Grupo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}