import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageHero } from "@/components/layout/PageHero";
import { ScrollRevealGroup } from "@/components/ui/scroll-reveal";
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
import { Loader2, Plus, Vote, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PollOption {
  id: string;
  label: string;
  vote_count: number;
}

interface Poll {
  id: string;
  question: string;
  description: string | null;
  multiple_choice: boolean;
  anonymous: boolean;
  status: string;
  closes_at: string | null;
  created_by: string;
  created_at: string;
  options: PollOption[];
  user_votes: string[];
  total_votes: number;
  author_name?: string;
}

export default function Polls() {
  const { user, membership, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multipleChoice, setMultipleChoice] = useState(false);

  const { data: polls = [], isLoading } = useQuery({
    queryKey: ["polls", membership?.group_id],
    queryFn: async () => {
      const { data: pollsData, error } = await supabase
        .from("polls")
        .select("*")
        .eq("group_id", membership!.group_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!pollsData?.length) return [];

      const pollIds = pollsData.map((p) => p.id);

      const [{ data: optionsData }, { data: votesData }, { data: userVotesData }] = await Promise.all([
        supabase.from("poll_options").select("*").in("poll_id", pollIds).order("sort_order"),
        supabase.from("poll_votes").select("option_id, poll_id").in("poll_id", pollIds),
        supabase.from("poll_votes").select("option_id, poll_id").in("poll_id", pollIds).eq("user_id", user!.id),
      ]);

      const userIds = [...new Set(pollsData.map((p) => p.created_by))];
      const { data: profiles } = await supabase.from("group_member_profiles").select("id, full_name").eq("group_id", membership!.group_id).in("id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) ?? []);

      return pollsData.map((poll) => {
        const opts = (optionsData || []).filter((o) => o.poll_id === poll.id);
        const votes = (votesData || []).filter((v) => v.poll_id === poll.id);
        const uVotes = (userVotesData || []).filter((v) => v.poll_id === poll.id).map((v) => v.option_id);

        const voteCounts = new Map<string, number>();
        votes.forEach((v) => voteCounts.set(v.option_id, (voteCounts.get(v.option_id) || 0) + 1));

        return {
          ...poll,
          author_name: profileMap.get(poll.created_by) || "Desconhecido",
          user_votes: uVotes,
          total_votes: votes.length,
          options: opts.map((o) => ({
            id: o.id,
            label: o.label,
            vote_count: voteCounts.get(o.id) || 0,
          })),
        } as Poll;
      });
    },
    enabled: !!membership?.group_id,
  });

  const createPoll = useMutation({
    mutationFn: async () => {
      const validOptions = options.filter((o) => o.trim());
      if (validOptions.length < 2) throw new Error("Mínimo 2 opções");

      const { data: poll, error } = await supabase
        .from("polls")
        .insert({
          group_id: membership!.group_id,
          created_by: user!.id,
          question: question.trim(),
          description: description.trim() || null,
          multiple_choice: multipleChoice,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: optError } = await supabase.from("poll_options").insert(
        validOptions.map((label, i) => ({ poll_id: poll.id, label: label.trim(), sort_order: i }))
      );
      if (optError) throw optError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
      setQuestion("");
      setDescription("");
      setOptions(["", ""]);
      setMultipleChoice(false);
      setOpen(false);
      toast({ title: "Votação criada!" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const castVote = useMutation({
    mutationFn: async ({ pollId, optionId, hasVoted }: { pollId: string; optionId: string; hasVoted: boolean }) => {
      if (hasVoted) {
        const { error } = await supabase.from("poll_votes").delete().eq("poll_id", pollId).eq("option_id", optionId).eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const poll = polls.find((p) => p.id === pollId);
        if (poll && !poll.multiple_choice && poll.user_votes.length > 0) {
          await supabase.from("poll_votes").delete().eq("poll_id", pollId).eq("user_id", user!.id);
        }
        const { error } = await supabase.from("poll_votes").insert({ poll_id: pollId, option_id: optionId, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["polls"] }),
  });

  const closePoll = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("polls").update({ status: "closed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
      toast({ title: "Votação encerrada." });
    },
  });

  const deletePoll = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("polls").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
      toast({ title: "Votação removida." });
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <PageHero
        title="Votações"
        subtitle="Decisões coletivas da república."
        tone="primary"
        icon={<Vote className="h-4 w-4" />}
        badge={<Badge variant="secondary">Colaboração</Badge>}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Votação</Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader><DialogTitle>Criar Votação</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Pergunta" value={question} onChange={(e) => setQuestion(e.target.value)} />
              <Textarea placeholder="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              <div className="space-y-2">
                <Label>Opções</Label>
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder={`Opção ${i + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...options];
                        newOpts[i] = e.target.value;
                        setOptions(newOpts);
                      }}
                    />
                    {options.length > 2 && (
                      <Button variant="ghost" size="icon" onClick={() => setOptions(options.filter((_, j) => j !== i))}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {options.length < 6 && (
                  <Button variant="outline" size="sm" onClick={() => setOptions([...options, ""])}>
                    <Plus className="h-3 w-3 mr-1" />Adicionar opção
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={multipleChoice} onCheckedChange={setMultipleChoice} />
                <Label>Permitir múltiplas escolhas</Label>
              </div>
              <Button
                onClick={() => createPoll.mutate()}
                disabled={!question.trim() || options.filter((o) => o.trim()).length < 2 || createPoll.isPending}
                className="w-full"
              >
                {createPoll.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Criar Votação
              </Button>
            </div>
            </DialogContent>
          </Dialog>
        }
      />

      {polls.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Vote className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma votação criada ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollRevealGroup preset="blur-slide" className="space-y-4">
          {polls.map((poll) => {
            const isOpen = poll.status === "open";
            const canManage = poll.created_by === user?.id || isAdmin;

            return (
              <Card key={poll.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">{poll.question}</CardTitle>
                      {poll.description && <p className="text-sm text-muted-foreground mt-1">{poll.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={isOpen ? "default" : "secondary"}>
                        {isOpen ? "Aberta" : "Encerrada"}
                      </Badge>
                      {canManage && (
                        <div className="flex gap-1">
                          {isOpen && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => closePoll.mutate(poll.id)}>
                              <CheckCircle2 className="h-4 w-4" />
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
                                <AlertDialogTitle>Excluir votação?</AlertDialogTitle>
                                <AlertDialogDescription>Essa ação não pode ser desfeita e todos os votos serão perdidos.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deletePoll.mutate(poll.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {poll.options.map((opt) => {
                    const hasVoted = poll.user_votes.includes(opt.id);
                    const pct = poll.total_votes > 0 ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;

                    return (
                      <button
                        key={opt.id}
                        disabled={!isOpen}
                        onClick={() => castVote.mutate({ pollId: poll.id, optionId: opt.id, hasVoted })}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm ${hasVoted ? "font-medium text-primary" : ""}`}>
                            {hasVoted && <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" />}
                            {opt.label}
                          </span>
                          <span className="text-xs text-muted-foreground">{opt.vote_count} voto{opt.vote_count !== 1 ? "s" : ""} ({pct}%)</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </button>
                    );
                  })}
                  <p className="text-xs text-muted-foreground pt-1">
                    {poll.author_name} · {format(new Date(poll.created_at), "dd MMM yyyy", { locale: ptBR })}
                    {poll.multiple_choice && " · Múltipla escolha"}
                    {` · ${poll.total_votes} voto${poll.total_votes !== 1 ? "s" : ""}`}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </ScrollRevealGroup>
      )}
    </div>
  );
}
