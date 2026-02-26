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
import { Loader2, Pencil, Trash2, Shield, User, Mail, Phone, FileText, Calendar, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("group_members")
        .update({ active: false, left_at: new Date().toISOString() })
        .eq("group_id", membership!.group_id)
        .eq("user_id", userId);

      if (error) throw error;
      
      await supabase
        .from("user_roles")
        .delete()
        .eq("group_id", membership!.group_id)
        .eq("user_id", userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast({ title: "Membro removido." });
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
  };

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
        <p className="text-muted-foreground mt-1">
          {members?.length ?? 0} membro(s) ativo(s)
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remover
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover morador?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {isMe 
                              ? "Atenção: Você está removendo a si mesmo do grupo. Você perderá o acesso imediatamente."
                              : <>Tem certeza que deseja remover <strong>{m.profile?.full_name}</strong>?</>
                            }
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeMember.mutate(m.user_id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

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

      {/* View Details Modal */}
      <Dialog open={!!viewingMember} onOpenChange={(open) => !open && setViewingMember(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Morador</DialogTitle>
          </DialogHeader>
          {viewingMember && (
            <div className="space-y-6 pt-2">
              <div className="flex flex-col items-center justify-center text-center gap-3">
                <Avatar className="h-20 w-20 border-2 border-primary/10">
                  <AvatarImage src={viewingMember.profile?.avatar_url} />
                  <AvatarFallback className="text-xl">
                    {(viewingMember.profile?.full_name?.trim() || "Morador sem nome").substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-bold">{viewingMember.profile?.full_name?.trim() || "Morador sem nome"}</h3>
                  <Badge variant={viewingMember.role === "admin" ? "default" : "secondary"} className="mt-1">
                    {viewingMember.role === "admin" ? "Administrador" : "Morador"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                {(isAdmin || viewingMember.user_id === user?.id) && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="bg-muted p-2 rounded-full"><Mail className="h-4 w-4 text-muted-foreground" /></div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="text-sm font-medium">{loadingContact ? <Loader2 className="h-3 w-3 animate-spin" /> : (contactInfo?.email || "Não informado")}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="bg-muted p-2 rounded-full"><Phone className="h-4 w-4 text-muted-foreground" /></div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Telefone</p>
                        <p className="text-sm font-medium">{loadingContact ? <Loader2 className="h-3 w-3 animate-spin" /> : (contactInfo?.phone || "Não informado")}</p>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex items-center gap-3">
                  <div className="bg-muted p-2 rounded-full"><Calendar className="h-4 w-4 text-muted-foreground" /></div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Membro desde</p>
                    <p className="text-sm font-medium">
                      {format(new Date(viewingMember.joined_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                {(isAdmin || viewingMember.user_id === user?.id) && (
                  <div className="flex items-center gap-3">
                    <div className="bg-muted p-2 rounded-full"><FileText className="h-4 w-4 text-muted-foreground" /></div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">CPF</p>
                      <div className="flex items-center gap-2">
                        {loadingCpf ? (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : (
                          <p className="text-sm font-medium">
                            {showCpf ? cpfValue : "•••.•••.•••-••"}
                          </p>
                        )}
                        <button
                          onClick={() => setShowCpf(!showCpf)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title={showCpf ? "Ocultar" : "Mostrar"}
                        >
                          {showCpf ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}