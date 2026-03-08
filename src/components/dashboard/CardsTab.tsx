import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, CreditCard, Plus, PieChart as PieChartIcon, Loader2, Settings, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CHART_COLORS, CATEGORY_COLORS, getCategoryLabel } from "@/constants/categories";
import { DonutChart, type DonutChartSegment } from "@/components/ui/donut-chart";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CardsTabProps {
  totalBill: number;
  currentDate: Date;
  cardsChartData: any[];
  creditCards: any[];
  cardsBreakdown: Record<string, number>;
  billInstallments: any[];
  isLoading?: boolean;
}

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

export function CardsTab({
  totalBill,
  currentDate,
  cardsChartData,
  creditCards,
  cardsBreakdown,
  billInstallments,
  isLoading = false,
}: CardsTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [hoveredSegmentLabel, setHoveredSegmentLabel] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<any | null>(null);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [editCardOpen, setEditCardOpen] = useState(false);
  const [deletingCard, setDeletingCard] = useState<any | null>(null);

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
      queryClient.invalidateQueries({ queryKey: ["my-credit-cards"] });
      queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      form.reset({ label: "", brand: "", closing_day: 5, due_day: 10, limit_amount: "" });
      setAddCardOpen(false);
      toast({ title: "Cartão salvo", description: "Cartão adicionado com sucesso." });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const onSubmitNewCard = (values: CardFormValues) => {
    createCard.mutate(values);
  };

  const handleOpenEdit = (card: any) => {
    form.reset({
      label: card.label,
      brand: card.brand,
      closing_day: card.closing_day,
      due_day: card.due_day,
      limit_amount: card.limit_amount ? String(card.limit_amount) : "",
    });
    setSelectedCard(card);
    setEditCardOpen(true);
  };

  const updateCard = useMutation({
    mutationFn: async (values: CardFormValues) => {
      const limitAmount = values.limit_amount ? Number(values.limit_amount) : null;
      const { error } = await supabase.from("credit_cards").update({
        label: values.label.trim(),
        brand: values.brand,
        closing_day: values.closing_day,
        due_day: values.due_day,
        limit_amount: limitAmount,
      }).eq("id", selectedCard!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-credit-cards"] });
      queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      setEditCardOpen(false);
      setSelectedCard(null);
      form.reset({ label: "", brand: "", closing_day: 5, due_day: 10, limit_amount: "" });
      toast({ title: "Cartão atualizado", description: "Alterações salvas." });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteCard = useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await supabase.from("credit_cards").delete().eq("id", cardId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-credit-cards"] });
      queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      setDeletingCard(null);
      toast({ title: "Cartão excluído" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const donutData: DonutChartSegment[] = cardsChartData.map((entry, index) => ({
    label: entry.name,
    value: entry.value,
    color: CATEGORY_COLORS[entry.name] || CHART_COLORS[index % CHART_COLORS.length],
  }));

  const activeSegment = donutData.find(d => d.label === hoveredSegmentLabel);
  const displayValue = activeSegment ? activeSegment.value : totalBill;
  const displayLabel = activeSegment ? activeSegment.label : "Total Fatura";
  const displayPercentage = activeSegment && totalBill > 0 ? (activeSegment.value / totalBill) * 100 : 100;

  const selectedCardInstallments = selectedCard
    ? billInstallments.filter((i: any) => i.expenses?.credit_card_id === selectedCard.id)
    : [];

  const selectedCardTotal = selectedCardInstallments.reduce((sum: number, i: any) => sum + Number(i.amount), 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-primary text-primary-foreground md:col-span-1 shadow-lg shadow-primary/20 border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary-foreground/80">Total em Faturas</CardTitle>
            <Wallet className="h-4 w-4 text-primary-foreground/60" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold tracking-tight">R$ {totalBill.toFixed(2)}</div>
            <p className="text-xs text-primary-foreground/60 mt-2 font-medium bg-primary-foreground/10 inline-block px-2 py-1 rounded">
              {format(currentDate, "MMMM/yyyy")}
            </p>
            <Button variant="secondary" size="sm" className="mt-6 w-full font-medium" asChild>
              <Link to="/personal/bills">Ver Extrato Completo</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Composição da Fatura</CardTitle>
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="h-auto flex flex-col md:flex-row items-center justify-center gap-6 p-4 md:p-6">
            {donutData.length > 0 ? (
              <>
                <div className="relative">
                  <DonutChart
                    data={donutData}
                    size={220}
                    strokeWidth={24}
                    animationDuration={1}
                    onSegmentHover={(segment) => setHoveredSegmentLabel(segment?.label || null)}
                    centerContent={
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={displayLabel}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.2 }}
                          className="flex flex-col items-center justify-center text-center px-1"
                        >
                          <p className="text-muted-foreground text-[10px] font-medium truncate max-w-[150px] uppercase tracking-wider leading-tight">
                            {displayLabel}
                          </p>
                          <p className="text-lg font-bold text-foreground tabular-nums whitespace-nowrap">
                            R$ {displayValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          {activeSegment && (
                            <p className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full mt-1">
                              {displayPercentage.toFixed(1)}%
                            </p>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    }
                  />
                </div>
                
                <div className="flex flex-col space-y-2 w-full max-w-full md:max-w-[240px] overflow-y-auto max-h-[220px] pr-2 scrollbar-thin">
                  {donutData.map((segment) => (
                    <div
                      key={segment.label}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-md transition-colors cursor-default text-sm",
                        hoveredSegmentLabel === segment.label ? "bg-muted" : "hover:bg-muted/50"
                      )}
                      onMouseEnter={() => setHoveredSegmentLabel(segment.label)}
                      onMouseLeave={() => setHoveredSegmentLabel(null)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: segment.color }}
                        />
                        <span className="font-medium truncate text-muted-foreground">
                          {segment.label}
                        </span>
                      </div>
                      <span className="font-semibold tabular-nums">
                        R$ {segment.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground text-sm opacity-60 h-full w-full">
                <CreditCard className="h-8 w-8 mb-2 opacity-20" />
                <p>Fatura zerada neste mês</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2 text-foreground/90">
          <CreditCard className="h-5 w-5 text-primary" /> Meus Cartões
        </h3>
        
        {isLoading ? (
          <Card className="border-dashed bg-muted/20">
            <CardContent className="py-10 flex flex-col items-center justify-center text-center">
              <Loader2 className="h-6 w-6 text-muted-foreground animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">Carregando cartões...</p>
            </CardContent>
          </Card>
        ) : creditCards.length === 0 ? (
          <Card className="border-dashed bg-muted/20">
            <CardContent className="py-10 flex flex-col items-center justify-center text-center">
              <div className="bg-muted p-3 rounded-full mb-3">
                <CreditCard className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium mb-1">Nenhum cartão cadastrado</p>
              <p className="text-xs text-muted-foreground/70 mb-4 max-w-[200px]">Cadastre seus cartões para controlar as faturas automaticamente.</p>
              <Button variant="outline" onClick={() => setAddCardOpen(true)}>Cadastrar Cartão</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {creditCards.map(card => {
              const billValue = cardsBreakdown[card.id] || 0;
              return (
                <Card
                  key={card.id}
                  className="flex flex-col justify-between hover:shadow-md transition-all border-l-4 border-l-primary/80 cursor-pointer"
                  onClick={() => {
                    if (editCardOpen || !!deletingCard) return;
                    setSelectedCard(card);
                  }}
                >
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-base font-semibold truncate">{card.label}</CardTitle>
                        <p className="text-xs text-muted-foreground capitalize font-medium">{card.brand}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border/60 bg-background hover:bg-muted transition-colors"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenEdit(card);
                          }}
                          aria-label={`Editar cartão ${card.label}`}
                        >
                          <Settings className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          type="button"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border/60 bg-background hover:bg-destructive/10 hover:border-destructive/30 transition-colors"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeletingCard(card);
                          }}
                          aria-label={`Excluir cartão ${card.label}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="mb-4 mt-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Fatura Atual</p>
                      <p className="text-2xl font-bold text-primary">R$ {billValue.toFixed(2)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-muted/40 p-2 rounded border border-border/50">
                      <div>
                        <span className="text-muted-foreground block">Fecha dia</span>
                        <span className="font-bold text-foreground">{card.closing_day}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Vence dia</span>
                        <span className="font-bold text-foreground">{card.due_day}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {/* Add Card Button */}
            <button
              type="button"
              onClick={() => setAddCardOpen(true)}
              className="flex flex-col items-center justify-center border border-dashed rounded-lg h-full min-h-[180px] hover:bg-muted/30 hover:border-primary/50 transition-all group cursor-pointer bg-muted/5"
            >
              <div className="h-10 w-10 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center mb-2 transition-colors">
                <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </div>
              <span className="text-sm font-medium text-muted-foreground group-hover:text-primary">Adicionar Cartão</span>
            </button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 border-b bg-muted/5">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Últimos Lançamentos</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            {billInstallments.slice(0, 5).map((i: any, idx: number) => {
              const totalInstallments = i.expenses?.installments ?? 1;
              const isAVista = totalInstallments <= 1;
              const purchaseDate = i.expenses?.purchase_date;
              return (
                <div key={idx} className="flex justify-between items-center py-3 hover:bg-muted/10 px-2 -mx-2 transition-colors rounded-sm">
                  <div className="min-w-0 pr-4 flex flex-col gap-0.5">
                    <span className="text-sm font-medium truncate text-foreground/90">{i.expenses?.title}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground bg-muted inline-block w-fit px-1.5 rounded-sm">
                        {getCategoryLabel(i.expenses?.category || "other")}
                      </span>
                      {purchaseDate && (
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(purchaseDate + "T00:00:00"), "dd/MM/yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm block">R$ {Number(i.amount).toFixed(2)}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {isAVista ? "À vista" : `Parc. ${i.installment_number}/${totalInstallments}`}
                    </span>
                  </div>
                </div>
              );
            })}
            {billInstallments.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                <div className="h-1 w-12 bg-border rounded-full opacity-50 mb-1"></div>
                Nenhum lançamento nesta fatura.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={addCardOpen}
        onOpenChange={(open) => {
          setAddCardOpen(open);
          if (!open) {
            form.reset({ label: "", brand: "", closing_day: 5, due_day: 10, limit_amount: "" });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar cartão</DialogTitle>
            <DialogDescription>Cadastre um novo cartão para acompanhar as faturas nesta aba.</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmitNewCard)}>
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

              <Button type="submit" className="w-full" disabled={createCard.isPending || !user}>
                {createCard.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar cartão
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedCard} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Fatura - {selectedCard?.label}</DialogTitle>
            <DialogDescription>
              Competência {format(currentDate, "MMMM/yyyy")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total da Fatura</p>
              <p className="text-2xl font-bold text-primary">R$ {selectedCardTotal.toFixed(2)}</p>
            </div>

            <div className="max-h-[360px] overflow-y-auto border rounded-lg divide-y">
              {selectedCardInstallments.map((item: any, index: number) => (
                <div key={`${item.id}-${index}`} className="flex items-center justify-between p-3">
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-medium truncate">{item.expenses?.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.expenses?.category} • Parcela {item.installment_number}
                    </p>
                  </div>
                  <p className="text-sm font-bold">R$ {Number(item.amount).toFixed(2)}</p>
                </div>
              ))}

              {selectedCardInstallments.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum lançamento encontrado para este cartão nesta competência.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Card Dialog */}
      <Dialog
        open={editCardOpen}
        onOpenChange={(open) => {
          setEditCardOpen(open);
          if (!open) {
            form.reset({ label: "", brand: "", closing_day: 5, due_day: 10, limit_amount: "" });
            setSelectedCard(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cartão</DialogTitle>
            <DialogDescription>Atualize os dados do cartão.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit((v) => updateCard.mutate(v))}>
              <FormField control={form.control} name="label" render={({ field }) => (<FormItem><FormLabel>Apelido</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="brand" render={({ field }) => (<FormItem><FormLabel>Bandeira</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{brandOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="closing_day" render={({ field }) => (<FormItem><FormLabel>Dia de fechamento</FormLabel><FormControl><Input type="number" min={1} max={31} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="due_day" render={({ field }) => (<FormItem><FormLabel>Dia de vencimento</FormLabel><FormControl><Input type="number" min={1} max={31} {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="limit_amount" render={({ field }) => (<FormItem><FormLabel>Limite (opcional)</FormLabel><FormControl><Input type="number" min={0} step="0.01" placeholder="R$" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <Button type="submit" className="w-full" disabled={updateCard.isPending}>{updateCard.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar alterações</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Card Alert */}
      <AlertDialog open={!!deletingCard} onOpenChange={(open) => !open && setDeletingCard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cartão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir o cartão "{deletingCard?.label}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingCard && deleteCard.mutate(deletingCard.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
