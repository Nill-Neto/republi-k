import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Phone, Shield, FileText, Download, Loader2 } from "lucide-react";

export default function Profile() {
  const { profile, membership, isAdmin, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [generating, setGenerating] = useState(false);

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

  const generateReport = async () => {
    if (!membership) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: { group_id: membership.group_id },
      });
      if (error) throw error;
      
      // data is base64 PDF
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-${new Date().toISOString().slice(0, 7)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Relatório gerado com sucesso!" });
    } catch (e) {
      toast({ title: "Erro ao gerar relatório", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const initials = (profile?.full_name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-serif">Meu Perfil</h1>
        <p className="text-muted-foreground text-sm">Gerencie suas informações pessoais</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatar_url} />
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

      {/* Reports section */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />Relatórios
          </CardTitle>
          <CardDescription>Gere relatórios mensais em PDF</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={generateReport} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {generating ? "Gerando..." : "Gerar relatório mensal (PDF)"}
          </Button>
        </CardContent>
      </Card>

      {/* Security info */}
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
    </div>
  );
}
