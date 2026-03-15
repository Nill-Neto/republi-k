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
import { User, Mail, Phone, Shield, FileText, FileSpreadsheet, Loader2, Download } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { ScrollRevealGroup } from "@/components/ui/scroll-reveal";

export default function Profile() {
  const { profile, membership, isAdmin, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingCsv, setGeneratingCsv] = useState(false);
  const today = new Date();
  const [reportStartDate, setReportStartDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10),
  );
  const [reportEndDate, setReportEndDate] = useState(
    new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10),
  );

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

    if (!reportStartDate || !reportEndDate) {
      toast({
        title: "Informe o período",
        description: "Selecione data inicial e final para gerar o relatório.",
        variant: "destructive",
      });
      return;
    }

    if (reportStartDate > reportEndDate) {
      toast({
        title: "Período inválido",
        description: "A data inicial não pode ser maior que a data final.",
        variant: "destructive",
      });
      return;
    }
    
    const setLoading = format === 'pdf' ? setGeneratingPdf : setGeneratingCsv;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: {
          group_id: membership.group_id,
          format,
          start_date: reportStartDate,
          end_date: reportEndDate,
        },
      });

      if (error) throw error;
      if (!data?.file) throw new Error("Dados do arquivo não recebidos");
      
      // Decode Base64
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
      const ext = format === 'pdf' ? 'pdf' : 'csv';
      const fallbackFileName = `relatorio-${reportStartDate.slice(0, 7)}.${ext}`;
      a.download = data.filename || fallbackFileName;
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
    <div className="space-y-4 max-w-2xl">
      <PageHero
        title="Meu Perfil"
        subtitle="Gerencie suas informações pessoais"
        icon={<User className="h-4 w-4" />}
      />

      <ScrollRevealGroup preset="blur-slide" className="space-y-4">
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
            <FileText className="h-5 w-5" />Relatórios Mensais
          </CardTitle>
          <CardDescription>Baixe o resumo financeiro da moradia</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="report-start-date">Data inicial</Label>
              <Input
                id="report-start-date"
                type="date"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="report-end-date">Data final</Label>
              <Input
                id="report-end-date"
                type="date"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            variant="outline" 
            onClick={() => generateReport('pdf')} 
            disabled={generatingPdf || generatingCsv}
            className="flex-1"
          >
            {generatingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4 text-red-600" />}
            {generatingPdf ? "Gerando PDF..." : "Baixar PDF"}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => generateReport('csv')} 
            disabled={generatingPdf || generatingCsv}
            className="flex-1"
          >
            {generatingCsv ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />}
            {generatingCsv ? "Gerando CSV..." : "Baixar CSV"}
          </Button>
          </div>
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
      </ScrollRevealGroup>
    </div>
  );
}
