import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, CreditCard, Calendar, Layers } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type PaymentMethod = "cash" | "pix" | "debit" | "credit_card";

const paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "debit", label: "Débito" },
  { value: "cash", label: "Dinheiro" },
  { value: "credit_card", label: "Cartão de crédito" },
];

const schema = z.object({
  title: z.string().trim().min(2, "Informe um título").max(200),
  amount: z.coerce.number().positive("Informe um valor válido"),
  purchase_date: z.string().min(10, "Informe a data da compra"),
  payment_method: z.enum(["cash", "pix", "debit", "credit_card"]),
  credit_card_id: z.string().optional(),
  installments: z.coerce.number().int().min(1).max(36),
});

type FormValues = z.infer<typeof schema>;

type CreditCardRow = {
  id: string;
  label: string;
  brand: string;
  closing_day: number;
  due_day: number;
};

type PersonalExpenseRow = {
  id: string;
  title: string;
  amount: number;
  payment_method: PaymentMethod;
  purchase_date: string;
  credit_card_id: string | null;
  installments: number;
  created_at: string;
};

function computeFirstBillMonthYear(purchaseDate: Date, closingDay: number) {
  const day = purchaseDate.getDate();
  const billBase = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1);

  if (day > closingDay) {
    billBase.setMonth(billBase.getMonth() + 1);
  }

  return { month: billBase.getMonth() + 1, year: billBase.getFullYear() };
}

function addMonths(month: number, year: number, plus: number) {
  const d = new Date(year, month - 1 + plus, 1);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

export default function PersonalExpenses() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      amount: 0,
      purchase_date: format(new Date(), "yyyy-MM-dd"),
      payment_method: "credit_card",
      credit_card_id: undefined,
      installments: 1,
    },
  });

  const paymentMethod = form.watch("payment_method");
  const creditCardId = form.watch("credit_card_id");
  const installments = form.watch("installments");
  const purchaseDateStr = form.watch("purchase_date");

  const { data: cards = [] } = useQuery({
    queryKey: ["credit-cards", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_cards")
        .select("id, label, brand, closing_day, due_day")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CreditCardRow[];
    },
    enabled: !!user,
  });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["personal-expenses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_expenses")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as PersonalExpenseRow[];
    },
    enabled: !!user,
  });

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === creditCardId) ?? null,
    [cards, creditCardId],
  );

  const billPreview = useMemo(() => {
    if (paymentMethod !== "credit_card") return null;
    if (!selectedCard) return null;

    const pd = new Date(purchaseDateStr + "T12:00:00");
    const first = computeFirstBillMonthYear(pd, selectedCard.closing_day);
    const last = addMonths(first.month, first.year, Math.max(0, installments - 1));

    return {
      first,
      last,
    };
  }, [paymentMethod, selectedCard, installments, purchaseDateStr]);

  const createExpense = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!user) return;

      if (values.payment_method === "credit_card") {
        if (!values.credit_card_id) throw new Error("Selecione um cartão");
        const card = cards.find((c) => c.id === values.credit_card_id);
        if (!card) throw new Error("Cartão inválido");

        const pd = new Date(values.purchase_date + "T12:00:00");
        const first = computeFirstBillMonthYear(pd, card.closing_day);
        const perInstallment = Math.round((Number(values.amount) / values.installments) * 100) / 100;

        const { data: parent, error: parentErr } = await supabase
          .from("personal_expenses")
          .insert({
            user_id: user.id,
            title: values.title.trim(),
            amount: Number(values.amount),
            payment_method: "credit_card",
            purchase_date: values.purchase_date,
            credit_card_id: values.credit_card_id,
            installments: values.installments,
          })
          .select("id")
          .single();

        if (parentErr) throw parentErr;

        const installmentRows = Array.from({ length: values.installments }).map((_, idx) => {
          const bill = addMonths(first.month, first.year, idx);
          return {
            user_id: user.id,
            personal_expense_id: parent.id,
            installment_number: idx + 1,
            amount: perInstallment,
            bill_month: bill.month,
            bill_year: bill.year,
          };
        });

        const { error: instErr } = await supabase
          .from("personal_expense_installments")
          .insert(installmentRows);

        if (instErr) throw instErr;

        return;
      }

      const { error } = await supabase.from("personal_expenses").insert({
        user_id: user.id,
        title: values.title.trim(),
        amount: Number(values.amount),
        payment_method: values.payment_method,
        purchase_date: values.purchase_date,
        credit_card_id: null,
        installments: 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personal-expenses"] });
      setOpen(false);
      form.reset({
        title: "",
        amount: 0,
        purchase_date: format(new Date(), "yyyy-MM-dd"),
        payment_method: "credit_card",
        credit_card_id: undefined,
        installments: 1,
      });
      toast({ title: "Despesa salva", description: "Registrada na sua área pessoal." });
    },
    onError: (err: any) =>
      toast({ title: "Erro", description: err.message ?? "Não foi possível salvar.", variant: "destructive" }),
  });

  const cardLabelById = useMemo(() => new Map(cards.map((c) => [c.id, c.label])), [cards]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-serif">Minhas despesas</h1>
          <p className="text-muted-foreground mt-1">
            Despesas pessoais fora do rateio do grupo.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Nova despesa
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif">Nova despesa pessoal</DialogTitle>
              <DialogDescription>
                Se escolher cartão, vamos criar automaticamente as parcelas por fatura.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form className="space-y-4 pt-2" onSubmit={form.handleSubmit((v) => createExpense.mutate(v))}>
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Mercado" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0.01} step={0.01} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="purchase_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data da compra</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de pagamento</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {paymentMethodOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {paymentMethod === "credit_card" && (
                  <Card className="border-dashed">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CreditCard className="h-4 w-4" /> Cartão e parcelas
                      </CardTitle>
                      <CardDescription>As parcelas serão distribuídas por fatura.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="credit_card_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cartão</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={cards.length ? "Selecione..." : "Cadastre um cartão primeiro"} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {cards.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.label} ({c.brand})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                            {cards.length === 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Você ainda não tem cartões cadastrados.
                              </p>
                            )}
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="installments"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nº de parcelas</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} max={36} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {billPreview && (
                        <>
                          <Separator />
                          <div className="grid gap-2 sm:grid-cols-2 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              <span>
                                1ª fatura:{" "}
                                <strong className="text-foreground">
                                  {String(billPreview.first.month).padStart(2, "0")}/{billPreview.first.year}
                                </strong>
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Layers className="h-4 w-4" />
                              <span>
                                Última:{" "}
                                <strong className="text-foreground">
                                  {String(billPreview.last.month).padStart(2, "0")}/{billPreview.last.year}
                                </strong>
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createExpense.isPending || (paymentMethod === "credit_card" && cards.length === 0)}
                >
                  {createExpense.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar despesa
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimas despesas</CardTitle>
          <CardDescription>Mostrando as últimas 50.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma despesa pessoal cadastrada ainda.</p>
          ) : (
            expenses.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 rounded-lg border p-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{e.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {paymentMethodOptions.find((p) => p.value === e.payment_method)?.label ?? e.payment_method}
                    </Badge>
                    {e.credit_card_id && (
                      <Badge variant="outline" className="text-xs">
                        {cardLabelById.get(e.credit_card_id) ?? "Cartão"}
                      </Badge>
                    )}
                    {e.installments > 1 && (
                      <Badge variant="outline" className="text-xs">
                        {e.installments}x
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Compra em {format(new Date(e.purchase_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold font-serif">R$ {Number(e.amount).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(e.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}