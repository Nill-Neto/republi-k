import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHero } from "@/components/layout/PageHero";
import { ScrollRevealGroup } from "@/components/ui/scroll-reveal";

const actionLabels: Record<string, string> = {
  create: "Criou",
  update: "Atualizou",
  delete: "Removeu",
  accept_invite: "Aceitou convite",
};

export default function AuditLog() {
  const { membership } = useAuth();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-log", membership?.group_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("group_id", membership!.group_id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const userIds = [...new Set((data || []).map((l) => l.user_id).filter(Boolean))] as string[];
      const { data: profiles } = await supabase
        .from("group_member_profiles")
        .select("id, full_name")
        .eq("group_id", membership!.group_id)
        .in("id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) ?? []);
      return (data || []).map((l) => ({ ...l, profiles: l.user_id ? { full_name: profileMap.get(l.user_id) ?? null } : null }));
    },
    enabled: !!membership?.group_id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHero
        title="Histórico"
        subtitle="Log de atividades do grupo."
        tone="default"
        icon={<History className="h-4 w-4" />}
      />

      {!logs?.length ? (
        <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
      ) : (
        <ScrollRevealGroup preset="fade" className="space-y-2">
          {logs.map((log) => {
            const profileData = log.profiles as unknown as { full_name: string } | null;
            return (
              <Card key={log.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="h-2 w-2 rounded-full bg-accent shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{profileData?.full_name ?? "Sistema"}</span>{" "}
                      <span className="text-muted-foreground">
                        {actionLabels[log.action] ?? log.action} {log.entity_type}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </ScrollRevealGroup>
      )}
    </div>
  );
}
