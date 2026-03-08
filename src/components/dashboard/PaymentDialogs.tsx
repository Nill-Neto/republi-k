import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type RateioScope = "previous" | "current";

type PendingSplit = {
  id: string;
  amount: number;
  competenceKey?: string | null;
  expenses?: {
    title?: string | null;
  };
};

interface PaymentDialogsProps {
  payRateioOpen: boolean;
  setPayRateioOpen: (open: boolean) => void;
  payIndividualOpen: boolean;
  setPayIndividualOpen: (open: boolean) => void;
  selectedIndividualSplit: any;
  setSelectedIndividualSplit: (split: any) => void;
  collectivePendingByScope: {
    previous: { total: number; items: PendingSplit[] };
    current: { total: number; items: PendingSplit[] };
  };
  rateioScope: RateioScope;
  individualPending: any[];
  currentDate: Date;
  onPayRateio: (scope: RateioScope) => void;
  onPayIndividual: () => void;
  saving: boolean;
  receiptFile: File | null;
  setReceiptFile: (file: File | null) => void;
}

export function PaymentDialogs({
  payRateioOpen,
  setPayRateioOpen,
  payIndividualOpen,
  setPayIndividualOpen,
  selectedIndividualSplit,
  setSelectedIndividualSplit,
  collectivePendingByScope,
  rateioScope,
  individualPending,
  currentDate,
  onPayRateio,
  onPayIndividual,
  saving,
  receiptFile,
  setReceiptFile,
}: PaymentDialogsProps) {
  const selectedScopeData = collectivePendingByScope[rateioScope];
  const selectedScopeLabel = rateioScope === "previous"
    ? "Rateio pendente de competências anteriores"
    : "Rateio da competência atual";

  const groupedPreviousPending = collectivePendingByScope.previous.items.reduce((acc: Record<string, PendingSplit[]>, item) => {
    const key = item.competenceKey;
    if (!key) {
      if (!acc["Sem competência"]) acc["Sem competência"] = [];
      acc["Sem competência"].push(item);
      return acc;
    }

    const [year, month] = key.split("-");
    const formattedKey = `${month}/${year}`;
    if (!acc[formattedKey]) acc[formattedKey] = [];
    acc[formattedKey].push(item);
    return acc;
  }, {});

  const groupedPreviousEntries = Object.entries(groupedPreviousPending).sort(([a], [b]) => {
    if (a === "Sem competência") return 1;
    if (b === "Sem competência") return -1;
    const [monthA, yearA] = a.split("/").map(Number);
    const [monthB, yearB] = b.split("/").map(Number);
    return new Date(yearB, monthB - 1, 1).getTime() - new Date(yearA, monthA - 1, 1).getTime();
  });

  return (
    <>
      {/* Rateio Payment Dialog */}
      <Dialog open={payRateioOpen} onOpenChange={setPayRateioOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh] bg-background">
          <DialogHeader className="px-5 pt-5 pb-4 shrink-0">
            <DialogTitle className="text-lg font-semibold text-foreground">
              {selectedScopeLabel}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {rateioScope === "previous"
                ? "Pagamento das competências anteriores"
                : `Competência atual (${format(currentDate, "MMMM/yy", { locale: ptBR })})`}
            </p>
          </DialogHeader>

          <div className="mx-5 mb-4 rounded-lg bg-primary/10 border border-primary/20 px-4 py-3 text-center">
            <p className="text-sm text-muted-foreground">Valor total</p>
            <p className="text-2xl font-bold text-primary mt-0.5 tabular-nums">
              R$ {selectedScopeData.total.toFixed(2)}
            </p>
          </div>

          {selectedScopeData.items.length > 0 && (
            <div className="mx-5 mb-4 border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/40 border-b">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detalhamento</p>
              </div>
              <ScrollArea className="max-h-[160px]">
                <div className="divide-y">
                  {rateioScope === "previous"
                    ? groupedPreviousEntries.map(([competence, items]) => (
                        <div key={competence} className="px-4 py-2.5 space-y-1.5">
                          <p className="text-xs font-semibold text-muted-foreground">{competence}</p>
                          {items.map((s) => (
                            <div key={s.id} className="flex justify-between text-sm py-0.5">
                              <span className="truncate pr-3 flex-1 text-foreground">{s.expenses?.title}</span>
                              <span className="font-medium tabular-nums text-foreground">R$ {Number(s.amount).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      ))
                    : selectedScopeData.items.map((s) => (
                        <div key={s.id} className="flex justify-between text-sm px-4 py-2.5">
                          <span className="truncate pr-3 flex-1 text-foreground">{s.expenses?.title}</span>
                          <span className="font-medium tabular-nums text-foreground">R$ {Number(s.amount).toFixed(2)}</span>
                        </div>
                      ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="px-5 pb-5 space-y-4 shrink-0">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Comprovante *</Label>
              <Input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} className="cursor-pointer" />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setPayRateioOpen(false)}>Cancelar</Button>
              <Button onClick={() => onPayRateio(rateioScope)} disabled={saving || !receiptFile}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Enviar Comprovante
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Individual Payment Dialog */}
      <Dialog open={payIndividualOpen} onOpenChange={(v) => { if (!v) { setPayIndividualOpen(false); setSelectedIndividualSplit(null); } else setPayIndividualOpen(true); }}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh] bg-background">
          <DialogHeader className="px-5 pt-5 pb-4 shrink-0">
            <DialogTitle className="text-lg font-semibold text-foreground">
              {selectedIndividualSplit ? "Confirmar Pagamento" : "Pagar Individual"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {selectedIndividualSplit ? selectedIndividualSplit.expenses?.title : "Selecione a despesa para pagar"}
            </p>
          </DialogHeader>

          {!selectedIndividualSplit ? (
            <div className="flex-1 min-h-0 border-t">
              <ScrollArea className="max-h-[45vh]">
                <div className="divide-y">
                  {individualPending.map((s: any) => (
                    <div key={s.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="min-w-0 pr-3">
                        <p className="text-sm font-medium truncate text-foreground">{s.expenses?.title}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">R$ {Number(s.amount).toFixed(2)}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setSelectedIndividualSplit(s)}>Pagar</Button>
                    </div>
                  ))}
                  {individualPending.length === 0 && (
                    <p className="text-center text-muted-foreground py-8 text-sm">Sem pendências.</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="px-5 pb-5 space-y-4">
              <div className="rounded-lg bg-primary/10 border border-primary/20 px-4 py-3 text-center">
                <p className="text-sm text-muted-foreground">{selectedIndividualSplit.expenses?.title}</p>
                <p className="text-2xl font-bold text-primary mt-0.5 tabular-nums">
                  R$ {Number(selectedIndividualSplit.amount).toFixed(2)}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Comprovante *</Label>
                <Input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} className="cursor-pointer" />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setSelectedIndividualSplit(null)}>Voltar</Button>
                <Button onClick={onPayIndividual} disabled={saving || !receiptFile}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Enviar Comprovante
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
