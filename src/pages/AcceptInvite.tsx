import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useInviteFlag } from "@/hooks/useInviteFlag";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface AcceptInviteResponse {
  success: boolean;
  error?: string;
  group_id?: string;
}

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const { user, loading: authLoading, signInWithGoogle, refreshMembership } = useAuth();
  const { markInviteAccepted } = useInviteFlag();

  const [status, setStatus] = useState<"loading" | "needs-login" | "accepting" | "success" | "error">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      setStatus("error");
      setErrorMsg("Link de convite inválido.");
      return;
    }

    if (!user) {
      setStatus("needs-login");
      return;
    }

    acceptInvite();
  }, [user, authLoading, token]);

  const acceptInvite = async () => {
    setStatus("accepting");
    try {
      const { data, error } = await supabase.rpc("accept_invite", { _token: token! });
      if (error) throw error;

      const result = data as unknown as AcceptInviteResponse;
      if (!result.success) {

        setStatus("error");
        setErrorMsg(result.error || "Erro ao aceitar convite.");
        return;
      }

      await refreshMembership();
      markInviteAccepted();
      setStatus("success");
      toast({ title: "Convite aceito!", description: "Bem-vindo ao grupo." });

      setTimeout(() => navigate("/onboarding", { replace: true }), 2000);
    } catch (err: any) {
      setStatus("error");
      const message = String(err?.message || "");
      if (message.toLowerCase().includes("débitos pendentes") || message.toLowerCase().includes("pending")) {
        setErrorMsg("Você possui débitos pendentes neste grupo. Regularize para retornar.");
      } else {
        setErrorMsg(message || "Erro ao aceitar convite.");
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Convite Republi-K</CardTitle>
          <CardDescription>Você foi convidado para uma moradia</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === "loading" && <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />}

          {status === "needs-login" && (
            <>
              <p className="text-muted-foreground">Faça login para aceitar o convite.</p>
              <Button onClick={signInWithGoogle} size="lg" className="w-full">
                Entrar com Google
              </Button>
            </>
          )}

          {status === "accepting" && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Aceitando convite...</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <p className="font-medium text-foreground">Convite aceito com sucesso!</p>
              <p className="text-sm text-muted-foreground">Redirecionando para o cadastro...</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-3">
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="font-medium text-foreground">{errorMsg}</p>
              <Button variant="outline" onClick={() => navigate("/login")}>
                Ir para Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
