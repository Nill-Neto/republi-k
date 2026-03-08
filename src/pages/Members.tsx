import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Pencil, Trash2, Shield, User, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { InfoCard, DetailItem } from "@/components/ui/insurance-card";
import { PageHero } from "@/components/layout/PageHero";
import { ScrollRevealGroup } from "@/components/ui/scroll-reveal";

export default function Members() {
  const { membership, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();

  // State for Edit Dialog
  const [editingMember, setEditingMember] = useState<any>(null);
  const [editRole, setEditRole] = useState("morador");
  const [editPercentage, setEditPercentage] = useState("0");
  const [isEditOpen, setIsEditOpen] = useState(false);

  // State for Details Dialog
  const [viewingMember, setViewingMember] = useState<any>(null);
  const [cpfValue, setCpfValue] = useState<string | null>(null);
  const [loadingCpf, setLoadingCpf] = useState(false);
  const [showCpf, setShowCpf] = useState(false);
  const [contactInfo, setContactInfo] = useState<{ email: string | null; phone: string | null } | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);

  // State for Remove flow
  const [removeReason, setRemoveReason] = useState("");
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  // Fetch Group Details (to check splitting rule)
  const { data: group } = useQuery({
    queryKey: ["group-details-members", membership?.group_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("groups")
        .select("splitting_rule")
        .eq("id", membership!.group_id)
        .single();
      return data;
    },
    enabled: !!membership?.group_id,
  });

  const { data: members, isLoading } = useQuery({
    queryKey: ["members", membership?.group_id],
    queryFn: async () => {
      const { data: groupMembers, error: gmErr } = await supabase
        .from("group_members")
        .select("user_id, split_percentage, joined_at, active")
        .eq("group_id", membership!.group_id)
        .eq("active", true);
      if (gmErr) throw gmErr;

      const [{ data: viewProfiles, error: viewErr }, { data: roles, error: roleErr }] = await Promise.all([
        supabase.rpc("get_group_member_public_profiles" as any, {
          _group_id: membership!.group_id,
        } as any),
        supabase
          .from("user_roles")
          .select("user_id, role")
          .eq("group_id", membership!.group_id),
      ]);

      if (viewErr) throw viewErr;
      if (roleErr) throw roleErr;

      const publicProfiles = (viewProfiles ?? []) as Array<{
        id: string;
        full_name: string | null;
        avatar_url: string | null;
      }>;

      return groupMembers.map((gm) => {
        const profile = publicProfiles.find((p) => p.id === gm.user_id);
        const role = roles?.find((r) => r.user_id === gm.user_id);
        return {
          ...gm,
          profile: profile ? { ...profile, email: null, phone: null } : null,
          role: role?.role as "admin" | "morador" | undefined,
        };
      });
    },
    enabled: !!membership?.group_id,
  });

  // Fetch CPF when viewing member details
  useEffect(() => {
    const fetchCpf = async () => {
      if (!viewingMember) return;
      
      const isMe = viewingMember.user_id === user?.id;
      // Only fetch if I am the user OR I am an admin
      if (!isMe && !isAdmin) {
        setCpfValue(null);
        return;
      }

      setLoadingCpf(true);
      try {
        let result;
        if (isMe) {
          const { data, error } = await supabase.rpc("read_my_cpf");
          if (error) throw error;
          result = data;
        } else {
          const { data, error } = await supabase.rpc("admin_read_cpf", {
            _target_user_id: viewingMember.user_id
          });
          if (error) throw error;
          result = data;
        }
        setCpfValue(result || "Não cadastrado");
      } catch (err) {
        console.error("Erro ao buscar CPF", err);
        setCpfValue("Indisponível");
      } finally {
        setLoadingCpf(false);
      }
    };

    if (viewingMember) {
      setCpfValue(null);
      setShowCpf(false);
      setContactInfo(null);
      fetchCpf();

      // Fetch email/phone for self or as admin
      const isMe = viewingMember.user_id === user?.id;
      if (isMe || isAdmin) {
        setLoadingContact(true);
        const fetchContact = async () => {
          const { data } = await supabase
            .from("profiles")
            .select("email, phone")
            .eq("id", viewingMember.user_id)
            .single();
          if (data) setContactInfo({ email: data.email, phone: data.phone });
          setLoadingContact(false);
        };
        fetchContact();
      }
    }
  }, [viewingMember, isAdmin, user]);

  const updateMember = useMutation({
    mutationFn: async () => {
      if (!editingMember) return;

      const { error: roleErr } = await supabase
        .from("user_roles")
        .update({ role: editRole as "admin" | "morador" })
        .eq("group_id", membership!.group_id)
        .eq("user_id", editingMember.user_id);

      if (roleErr) throw roleErr;

      if (group?.splitting_rule === "percentage") {
        const { error: pctErr } = await supabase
          .from("group_members")
          .update({ split_percentage: Number(editPercentage) })
          .eq("group_id", membership!.group_id)
          .eq("user_id", editingMember.user_id);
        if (pctErr) throw pctErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setIsEditOpen(false);
      toast({ title: "Membro atualizado com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    },
  });

  const removeMember = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("remove_group_member" as any, {
        _group_id: membership!.group_id,
        _target_user_id: userId,
        _reason: reason,
      } as any);
      if (error) throw error;
      return data as unknown as {
        success: boolean;
        preserved_pending_splits?: number;
        redistributed_pending_splits?: number;
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["my-pending-splits"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setRemoveReason("");
      setRemovingMemberId(null);
      toast({
        title: "Morador removido.",
        description: `Pendências preservadas: ${result?.preserved_pending_splits ?? 0} | redistribuídas: ${result?.redistributed_pending_splits ?? 0}`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  const openEditDialog = (member: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMember(member);
    setEditRole(member.role || "morador");
    setEditPercentage(String(member.split_percentage || 0));
    setIsEditOpen(true);
  };

  const confirmRemove = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setRemovingMemberId(userId);
    setRemoveReason("");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // --- Construct InfoCard Props ---
  const memberDetails: DetailItem[] = viewingMember ? [
    { label: "Membro desde", value: format(new Date(viewingMember.joined_at), "dd/MM/yyyy", { locale: ptBR }) },
    { label: "Status", value: "Ativo" },
    ...(isAdmin || viewingMember.user_id === user?.id ? [
      { label: "Email", value: loadingContact ? "..." : (contactInfo?.email || "—"), copyable: true, fullWidth: true },
      { label: "Telefone", value: loadingContact ? "..." : (contactInfo?.phone || "—"), copyable: !!contactInfo?.phone },
      { label: "CPF", value: loadingCpf ? "..." : (showCpf ? cpfValue! : "•••.•••.•••-••"), copyable: showCpf },
    ] : [])
  ] : [];

  const footerContent = (isAdmin || viewingMember?.user_id === user?.id) && (
    <div className="flex items-center justify-between text-sm text-muted-foreground w-full">
       <span className="text-[10px] md:text-xs">Dados sensíveis (Admin/Você).</span>
       {(isAdmin || viewingMember?.user_id === user?.id) && showCpf === false && (
         <Button variant="ghost" size="sm" onClick={() => setShowCpf(true)} className="h-auto p-0 text-primary hover:text-primary/80">
           <Eye className="h-3 w-3 mr-1" /> Mostrar CPF
         </Button>
       )}
       {(isAdmin || viewingMember?.user_id === user?.id) && showCpf === true && (
         <Button variant="ghost" size="sm" onClick={() => setShowCpf(false)} className="h-auto p-0 text-primary hover:text-primary/80">
           <EyeOff className="h-3 w-3 mr-1" /> Ocultar CPF
         </Button>
       )}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHero
        title="Moradores"
        subtitle={`${members?.length ?? 0} membro(s) ativo(s)`}
        tone="primary"
        icon={<User className="h-4 w-4" />}
        badge={<Badge variant="secondary">Grupo ativo</Badge>}
      />

      <ScrollRevealGroup preset="blur-slide" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members?.map((m) => {
          const displayName = m.profile?.full_name?.trim() || "Morador sem nome";
          const initials = displayName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          const isMe = m.user_id === user?.id;

          return (
            <Card 
              key={m.user_id} 
              className="cursor-pointer hover:border-primary/50 transition-colors group"
              onClick={() => setViewingMember(m)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={m.profile?.avatar_url} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {displayName} {isMe && "(Você)"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {m.role === "admin" ? (
                        <span className="flex items-center gap-1 text-primary font-medium">
                          <Shield className="h-3 w-3" /> Admin
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" /> Morador
                        </span>
                      )}
                      {group?.splitting_rule === "percentage" && (
                        <span>• {m.split_percentage}%</span>
                      )}
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex justify-end gap-2 mt-4 border-t pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-muted-foreground hover:text-primary"
                      onClick={(e) => openEditDialog(m, e)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-muted-foreground hover:text-destructive"
                          onClick={(e) => confirmRemove(m.user_id, e)}
                          disabled={isMe}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remover
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover morador?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {isMe
                              ? "Você não pode remover a si mesmo por este fluxo. Use o fluxo de saída dedicado."
                              : <>Tem certeza que deseja remover <strong>{m.profile?.full_name}</strong>? Essa ação impacta os cálculos financeiros do grupo.</>
                            }
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <div className="w-full space-y-3">
                            <div className="space-y-1">
                              <Label htmlFor={`remove-reason-${m.user_id}`}>Motivo da saída</Label>
                              <Input
                                id={`remove-reason-${m.user_id}`}
                                placeholder="Ex.: mudança de cidade"
                                value={removingMemberId === m.user_id ? removeReason : ""}
                                onChange={(e) => setRemoveReason(e.target.value)}
                              />
                            </div>
                            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                              <p>• Débitos do período utilizado permanecem com o morador.</p>
                              <p>• Pendências futuras poderão ser redistribuídas conforme regras do grupo.</p>
                              <p>• Pagamentos já enviados permanecem pendentes até confirmação.</p>
                            </div>
                            <AlertDialogAction
                              onClick={() => removeMember.mutate({ userId: m.user_id, reason: removeReason.trim() })}
                              disabled={removeMember.isPending || removingMemberId !== m.user_id || !removeReason.trim()}
                              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {removeMember.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                              Confirmar saída
                            </AlertDialogAction>
                          </div>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </ScrollRevealGroup>

      {/* Edit Role/Percentage Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Morador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="morador">Morador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {group?.splitting_rule === "percentage" && (
              <div className="space-y-2">
                <Label>Porcentagem do Rateio (%)</Label>
                <Input type="number" min="0" max="100" value={editPercentage} onChange={(e) => setEditPercentage(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => updateMember.mutate()} disabled={updateMember.isPending}>
              {updateMember.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Modal with InfoCard */}
      <Dialog open={!!viewingMember} onOpenChange={(open) => !open && setViewingMember(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-transparent border-0 shadow-none">
          {viewingMember && (
            <InfoCard 
              title={viewingMember.profile?.full_name?.trim() || "Morador"}
              subtitle={membership?.group_name}
              avatarSrc={viewingMember.profile?.avatar_url}
              badge={
                <Badge variant={viewingMember.role === "admin" ? "default" : "secondary"} className="w-fit">
                  {viewingMember.role === "admin" ? "Administrador" : "Morador"}
                </Badge>
              }
              details={memberDetails}
              footerContent={footerContent}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}