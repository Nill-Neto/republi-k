import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export default function Members() {
  const { membership, isAdmin } = useAuth();

  const { data: members, isLoading } = useQuery({
    queryKey: ["members", membership?.group_id],
    queryFn: async () => {
      const { data: groupMembers, error: gmErr } = await supabase
        .from("group_members")
        .select("user_id, split_percentage, joined_at, active")
        .eq("group_id", membership!.group_id)
        .eq("active", true);
      if (gmErr) throw gmErr;

      const userIds = groupMembers.map((gm) => gm.user_id);

      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", userIds),
        supabase.from("user_roles").select("user_id, role").eq("group_id", membership!.group_id),
      ]);

      return groupMembers.map((gm) => {
        const profile = profiles?.find((p) => p.id === gm.user_id);
        const role = roles?.find((r) => r.user_id === gm.user_id);
        return { ...gm, profile, role: role?.role as "admin" | "morador" | undefined };
      });
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif">Moradores</h1>
        <p className="text-muted-foreground mt-1">{members?.length ?? 0} membro(s) ativo(s)</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members?.map((m) => {
          const initials = (m.profile?.full_name || "?")
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <Card key={m.user_id}>
              <CardContent className="flex items-center gap-4 p-4">
                <Avatar className="h-11 w-11">
                  <AvatarImage src={m.profile?.avatar_url} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{m.profile?.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.profile?.email}</p>
                </div>
                <Badge variant={m.role === "admin" ? "default" : "secondary"} className="shrink-0">
                  {m.role === "admin" ? "Admin" : "Morador"}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
