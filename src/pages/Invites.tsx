import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { APP_PUBLIC_URL } from "@/config/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, Copy, RefreshCw, UserPlus, Trash2 } from "lucide-react";
import { z } from "zod";
import { PageHero } from "@/components/layout/PageHero";

type DeliveryStatus = "pending" | "sent" | "failed";

const emailSchema = z.string().trim().email("Email inválido").max(255);

const inviteStatusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  accepted: { label: "Aceito", variant: "default" },
  rejected: { label: "Recusado", variant: "destructive" },
  expired: { label: "Expirado", variant: "secondary" },
};

const deliveryStatusMap: Record<DeliveryStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "E-mail pendente", variant: "outline" },
  sent: { label: "E-mail enviado", variant: "default" },
  failed: { label: "Falha no envio", variant: "destructive" },
};

const sendInviteEmail = async ({
  email,
  token,
  groupName,
  inviterName,
}: {
  email: string;
  token: string;
  groupName?: string;
  inviterName?: string;
}) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    return {
      success: false,
      error: "Sessão inválida para enviar e-mail.",
    };
  }

  try {
    const response = await fetch(
      "https://mqorykrxvqfkifjkveqe.supabase.co/functions/v1/send-invite-email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email, token, groupName, inviterName }),
      },
    );

    if (!response.ok) {
      const bodyText = await response.text();
      return {
        success: false,
        error: bodyText || "Falha ao enviar e-mail.",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro inesperado ao enviar e-mail.",
    };
  }
};

export default function Invites() {
  const { user, membership } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

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

  const { data: group } = useQuery({
    queryKey: ["group", membership?.group_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("name")
        .eq("id", membership!.group_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!membership?.group_id,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const sendInvite = useMutation({
    mutationFn: async (inviteEmail: string) => {
      const { data: invite, error } = await supabase
        .from("invites")
        .insert({
          group_id: membership!.group_id,
          invited_by: user!.id,
          email: inviteEmail.toLowerCase().trim(),
          email_delivery_status: "pending",
          email_error: null,
          email_sent_at: null,
        })
        .select()
        .single();
      if (error) throw error;

      const deliveryResult = await sendInviteEmail({
        email: invite.email,
        token: invite.token,
        groupName: group?.name,
        inviterName: profile?.full_name,
      });

      const deliveryStatus: DeliveryStatus = deliveryResult.success ? "sent" : "failed";
      const deliveryError = deliveryResult.success ? null : deliveryResult.error;

      const { error: updateError } = await supabase
        .from("invites")
        .update({
          email_delivery_status: deliveryStatus,
          email_error: deliveryError,
          email_sent_at: deliveryResult.success ? new Date().toISOString() : null,
        })
        .eq("id", invite.id);
      if (updateError) throw updateError;

      return {
        deliveryStatus,
        deliveryError,
      };
    },
    onSuccess: ({ deliveryStatus, deliveryError }) => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      setEmail("");

      if (deliveryStatus === "sent") {
        toast({
          title: "Convite criado",
          description: "Convite criado e e-mail enviado com sucesso.",
        });
        return;
      }

      toast({
        title: "Convite criado",
        description: `Convite criado, mas o e-mail falhou. ${deliveryError ?? "Tente reenviar."}`,
        variant: "destructive",
      });
    },
    onError: (err: Error) => {
      const msg = err.message?.includes("unique")
        ? "Este email já foi convidado."
        : err.message;
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const resendInviteEmail = useMutation({
    mutationFn: async (inviteId: string) => {
      const invite = invites?.find((item) => item.id === inviteId);
      if (!invite) {
        throw new Error("Convite não encontrado para reenvio.");
      }

      const { error: pendingError } = await supabase
        .from("invites")
        .update({ email_delivery_status: "pending", email_error: null })
        .eq("id", inviteId);
      if (pendingError) throw pendingError;

      const deliveryResult = await sendInviteEmail({
        email: invite.email,
        token: invite.token,
        groupName: group?.name,
        inviterName: profile?.full_name,
      });

      const { error: updateError } = await supabase
        .from("invites")
        .update({
          email_delivery_status: deliveryResult.success ? "sent" : "failed",
          email_error: deliveryResult.success ? null : deliveryResult.error,
          email_sent_at: deliveryResult.success ? new Date().toISOString() : null,
        })
        .eq("id", inviteId);
      if (updateError) throw updateError;

      return deliveryResult;
    },
    onMutate: (inviteId) => setResendingId(inviteId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      if (result.success) {
        toast({ title: "E-mail enviado", description: "O convite foi reenviado com sucesso." });
        return;
      }

      toast({
        title: "Falha no reenvio",
        description: result.error ?? "Não foi possível reenviar o convite.",
        variant: "destructive",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
    onSettled: () => setResendingId(null),
  });

  const regenerateInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const newToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("invites")
        .update({ token: newToken, expires_at: expiresAt })
        .eq("id", inviteId)
        .eq("status", "pending");
      if (error) throw error;
      return newToken;
    },
    onMutate: (inviteId) => setRegeneratingId(inviteId),
    onSuccess: (newToken) => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      copyLink(newToken, "Novo link gerado!");
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
    onSettled: () => setRegeneratingId(null),
  });

  const deleteInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from("invites")
        .delete()
        .eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      toast({ title: "Convite excluído" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
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

  const copyLink = (token: string, title = "Link copiado!") => {
    const link = `${APP_PUBLIC_URL}/invite?token=${token}`;
    navigator.clipboard.writeText(link);
    toast({ title, description: "Envie para o morador." });
  };

  return (
    <div className="space-y-4 min-h-[calc(100vh-8rem)] overflow-x-hidden">
      <PageHero
        title="Convites"
        subtitle="Convide moradores para o grupo."
        tone="primary"
        icon={<UserPlus className="h-4 w-4" />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Novo convite</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
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

      <div className="space-y-3 min-h-[20rem]">
        <h3 className="text-sm font-medium text-muted-foreground">Convites enviados</h3>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : !invites?.length ? (
          <p className="text-sm text-muted-foreground">Nenhum convite enviado ainda.</p>
        ) : (
          invites.map((inv) => {
            const inviteStatus = inviteStatusMap[inv.status] ?? inviteStatusMap.pending;
            const deliveryStatus = deliveryStatusMap[(inv.email_delivery_status as DeliveryStatus) ?? "pending"];
            const isRegenLoading = regeneratingId === inv.id && regenerateInvite.isPending;
            const isResendLoading = resendingId === inv.id && resendInviteEmail.isPending;

            return (
              <Card key={inv.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Enviado em {new Date(inv.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    {inv.email_error && inv.email_delivery_status === "failed" && (
                      <p className="text-xs text-destructive mt-1 truncate">{inv.email_error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={inviteStatus.variant}>{inviteStatus.label}</Badge>
                    <Badge variant={deliveryStatus.variant}>{deliveryStatus.label}</Badge>

                    {inv.email_delivery_status === "failed" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => resendInviteEmail.mutate(inv.id)}
                        disabled={isResendLoading}
                        title="Reenviar e-mail"
                        aria-label={`Reenviar e-mail do convite para ${inv.email}`}
                      >
                        {isResendLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    )}

                    {inv.status === "pending" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyLink(inv.token)}
                          title="Copiar link"
                          aria-label={`Copiar link de convite para ${inv.email}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => regenerateInvite.mutate(inv.id)}
                          disabled={isRegenLoading}
                          title="Gerar novo link"
                          aria-label={`Gerar novo link de convite para ${inv.email}`}
                        >
                          {isRegenLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteInvite.mutate(inv.id)}
                          disabled={deleteInvite.isPending}
                          title="Excluir convite"
                          aria-label={`Excluir convite para ${inv.email}`}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {inv.status !== "pending" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteInvite.mutate(inv.id)}
                        disabled={deleteInvite.isPending}
                        title="Excluir convite"
                        aria-label={`Excluir convite para ${inv.email}`}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
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
