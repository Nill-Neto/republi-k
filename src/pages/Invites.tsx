import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, Copy } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().trim().email("Email inválido").max(255);

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  accepted: { label: "Aceito", variant: "default" },
  rejected: { label: "Recusado", variant: "destructive" },
  expired: { label: "Expirado", variant: "secondary" },
};

export default function Invites() {
  const { user, membership } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const { data: invites, isLoading } = useQuery({
    queryKey: ["invites", membership?.group_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("*")
        .eq("group_id", membership!.group_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!membership?.group_id,
  });

  const sendInvite = useMutation({
    mutationFn: async (inviteEmail: string) => {
      const { error } = await supabase.from("invites").insert({
        group_id: membership!.group_id,
        invited_by: user!.id,
        email: inviteEmail.toLowerCase().trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      setEmail("");
      toast({ title: "Convite enviado!", description: "O link foi gerado com sucesso." });
    },
    onError: (err: any) => {
      const msg = err.message?.includes("unique")
        ? "Este email já foi convidado."
        : err.message;
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const handleSend = () => {
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setEmailError(result.error.errors[0].message);
      return;
    }
    setEmailError("");
    sendInvite.mutate(result.data);
  };

  const copyLink = (token: string) => {
    const baseUrl =
      (import.meta.env.VITE_APP_URL
        ? import.meta.env.VITE_APP_URL.replace(/\/$/, "")
        : undefined) || window.location.origin;
    const link = `${baseUrl}/invite?token=${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link copiado!", description: "Envie para o morador." });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif">Convites</h1>
        <p className="text-muted-foreground mt-1">
          Convide moradores para o grupo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Novo convite</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Input
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                placeholder="email@exemplo.com"
                type="email"
                className={emailError ? "border-destructive" : ""}
              />
              {emailError && <p className="text-xs text-destructive">{emailError}</p>}
            </div>
            <Button onClick={handleSend} disabled={sendInvite.isPending}>
              {sendInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="hidden sm:inline ml-2">Enviar</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Convites enviados</h3>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : !invites?.length ? (
          <p className="text-sm text-muted-foreground">Nenhum convite enviado ainda.</p>
        ) : (
          invites.map((inv) => {
            const st = statusMap[inv.status] ?? statusMap.pending;
            return (
              <Card key={inv.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Enviado em {new Date(inv.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={st.variant}>{st.label}</Badge>
                    {inv.status === "pending" && (
                      <Button variant="ghost" size="icon" onClick={() => copyLink(inv.token)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}