import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, CreditCard as CreditCardIcon, Trash2, Pencil } from "lucide-react";
import { useState, useEffect } from "react";

const cardSchema = z.object({
  label: z.string().min(3, "Informe o apelido do cartão"),
  brand: z.string().min(1, "Selecione a bandeira"),
  closing_day: z.coerce.number().int().min(1).max(31),
  due_day: z.coerce.number().int().min(1).max(31),
  limit_amount: z
    .string()
    .optional()
    .refine(
      (value) => !value || (!Number.isNaN(Number(value)) && Number(value) >= 0),
      "Informe um limite válido",
    ),
});

type CardFormValues = z.infer<typeof cardSchema>;

const brandOptions = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "elo", label: "Elo" },
  { value: "hipercard", label: "Hipercard" },
  { value: "american_express", label: "American Express" },
  { value: "outros", label: "Outros" },
];

function EditCardDialog({ card, open, onOpenChange }: { card: any, open: boolean, onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const form = useForm<CardFormValues>({
    resolver: zodResolver(cardSchema),
    defaultValues: {
      label: "",
      brand: "",
      closing_day: 5,
      due_day: 10,
      limit_amount: "",
    },
  });

  useEffect(() => {
    if (card) {
      form.reset({
        label: card.label,
        brand: card.brand,
        closing_day: card.closing_day,
        due_day: card.due_day,
        limit_amount: card.limit_amount !== null ? String(card.limit_amount) : "",
      });
    }
  }, [card, form]);

  const updateCard = useMutation({
    mutationFn: async (values: CardFormValues) => {
      const limitAmount = values.limit_amount ? Number(values.limit_amount) : null;
      const { error } = await supabase.from("credit_cards").update({
        label: values.label.trim(),
        brand: values.brand,
        closing_day: values.closing_day,
        due_day: values.due_day,
        limit_amount: limitAmount,
      }).eq("id", card.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      toast({ title: "Cartão atualizado" });
      onOpenChange(false);
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const onSubmit = (values: CardFormValues) => {
    updateCard.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar cartão</DialogTitle>
          <DialogDescription>Altere as informações do seu cartão.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apelido</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Nubank" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bandeira</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a bandeira" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {brandOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="closing_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia de fechamento</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={31} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="due_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia de vencimento</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={31} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="limit_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Limite (opcional)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step="0.01" placeholder="R$" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={updateCard.isPending}>
              {updateCard.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar alterações
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function CreditCards() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingCard, setEditingCard] = useState<any>(null);

  const form = useForm<CardFormValues>({
    resolver: zodResolver(cardSchema),
    defaultValues: {
      label: "",
      brand: "",
      closing_day: 5,
      due_day: 10,
      limit_amount: "",
    },
  });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["credit-cards", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_cards")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const createCard = useMutation({
    mutationFn: async (values: CardFormValues) => {
      const limitAmount = values.limit_amount ? Number(values.limit_amount) : null;
      const { error } = await supabase.from("credit_cards").insert({
        user_id: user!.id,
        label: values.label.trim(),
        brand: values.brand,
        closing_day: values.closing_day,
        due_day: values.due_day,
        limit_amount: limitAmount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      form.reset({ label: "", brand: "", closing_day: 5, due_day: 10, limit_amount: "" });
      toast({ title: "Cartão salvo", description: "Agora você pode usá-lo nas despesas pessoais." });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("credit_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      toast({ title: "Cartão removido" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const onSubmit = (values: CardFormValues) => {
    createCard.mutate(values);
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif">Cartões pessoais</h1>
        <p className="text-muted-foreground mt-1">
          Cadastre os cartões que serão usados no controle individual. Apenas você tem acesso.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Adicionar cartão</CardTitle>
            <CardDescription>Fechamento e vencimento são usados para prever faturas futuras.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apelido</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Nubank" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bandeira</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a bandeira" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {brandOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="closing_day"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dia de fechamento</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} max={31} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="due_day"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dia de vencimento</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} max={31} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="limit_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limite (opcional)</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step="0.01" placeholder="R$" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={createCard.isPending}>
                  {createCard.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar cartão
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-lg">Meus cartões</CardTitle>
            <CardDescription>Edite ou remova cartões que não usa mais.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum cartão cadastrado ainda. Cadastre o primeiro ao lado.
              </p>
            ) : (
              cards.map((card) => {
                const brandLabel =
                  brandOptions.find((option) => option.value === card.brand)?.label ?? card.brand;

                const isDeleting = deleteCard.isPending && deleteCard.variables === card.id;

                return (
                  <div
                    key={card.id}
                    className="flex items-start justify-between gap-4 rounded-lg border p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-muted p-2">
                        <CreditCardIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{card.label}</p>
                        <p className="text-xs text-muted-foreground">{brandLabel}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Fecha no dia <strong>{card.closing_day}</strong> · vence no dia{" "}
                          <strong>{card.due_day}</strong>
                        </p>
                        {card.limit_amount !== null && (
                          <p className="text-xs text-muted-foreground">
                            Limite: R$ {Number(card.limit_amount).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary"
                        onClick={() => setEditingCard(card)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir cartão?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Isso removerá o cartão e pode afetar o histórico de despesas associadas.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteCard.mutate(card.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <EditCardDialog
        card={editingCard}
        open={!!editingCard}
        onOpenChange={(open) => !open && setEditingCard(null)}
      />
    </div>
  );
}