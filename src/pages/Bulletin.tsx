import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { Loader2, Plus, Pin, Trash2, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHero } from "@/components/layout/PageHero";
import { ScrollRevealGroup } from "@/components/ui/scroll-reveal";

interface BulletinPost {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  created_by: string;
  created_at: string;
  author_name?: string;
}

export default function Bulletin() {
  const { user, membership, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["bulletin", membership?.group_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bulletin_posts")
        .select("*")
        .eq("group_id", membership!.group_id)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((data || []).map((p) => p.created_by))];
      const { data: profiles } = await supabase
        .from("group_member_profiles")
        .select("id, full_name")
        .eq("group_id", membership!.group_id)
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) ?? []);
      return (data || []).map((p) => ({
        ...p,
        author_name: profileMap.get(p.created_by) || "Desconhecido",
      })) as BulletinPost[];
    },
    enabled: !!membership?.group_id,
  });

  const createPost = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("bulletin_posts").insert({
        group_id: membership!.group_id,
        created_by: user!.id,
        title: title.trim(),
        content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bulletin"] });
      setTitle("");
      setContent("");
      setOpen(false);
      toast({ title: "Aviso publicado!" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase.from("bulletin_posts").update({ pinned: !pinned }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bulletin"] }),
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bulletin_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bulletin"] });
      toast({ title: "Aviso removido." });
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <PageHero
        title="Mural de Avisos"
        subtitle="Comunicados e recados para a república."
        tone="primary"
        icon={<MessageSquare className="h-4 w-4" />}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Aviso</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Publicar Aviso</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea placeholder="Conteúdo do aviso..." value={content} onChange={(e) => setContent(e.target.value)} rows={4} />
              <Button onClick={() => createPost.mutate()} disabled={!title.trim() || !content.trim() || createPost.isPending} className="w-full">
                {createPost.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Publicar
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        }
      />

      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum aviso publicado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollRevealGroup preset="blur-slide" className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id} className={post.pinned ? "border-primary/50 bg-primary/5" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-lg">{post.title}</CardTitle>
                    {post.pinned && <Badge variant="secondary"><Pin className="h-3 w-3 mr-1" />Fixado</Badge>}
                  </div>
                  {(post.created_by === user?.id || isAdmin) && (
                    <div className="flex gap-1 shrink-0">
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => togglePin.mutate({ id: post.id, pinned: post.pinned })}>
                          <Pin className={`h-4 w-4 ${post.pinned ? "text-primary" : ""}`} />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir aviso?</AlertDialogTitle>
                            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deletePost.mutate(post.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{post.content}</p>
                <p className="text-xs text-muted-foreground mt-3">
                  {post.author_name} · {format(new Date(post.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </CardContent>
            </Card>
          ))}
        </ScrollRevealGroup>
      )}
    </div>
  );
}