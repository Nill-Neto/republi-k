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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedScopeLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">
                {rateioScope === "previous"
                  ? "Pagamento das competências anteriores"
                  : `Competência atual (${format(currentDate, "MMMM/yy", { locale: ptBR })})`}
              </p>
              <p className="text-3xl font-bold text-primary mt-1">R$ {selectedScopeData.total.toFixed(2)}</p>
            </div>
            {selectedScopeData.items.length > 0 && (
              <div className="border rounded-md p-3 bg-card">
                 <p className="text-xs font-semibold text-muted-foreground mb-2">Detalhamento:</p>
                 <ScrollArea className="h-[120px] pr-2">
                    <div className="space-y-2">
                      {rateioScope === "previous"
                        ? groupedPreviousEntries.map(([competence, items]) => (
                            <div key={competence} className="space-y-1.5">
                              <p className="text-xs font-semibold text-muted-foreground">{competence}</p>
                              {items.map((s) => (
                                <div key={s.id} className="flex justify-between text-sm border-b pb-1 border-muted last:border-0">
                                  <span className="truncate pr-2 flex-1">{s.expenses?.title}</span>
                                  <span className="font-medium">R$ {Number(s.amount).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          ))
                        : selectedScopeData.items.map((s) => (
                            <div key={s.id} className="flex justify-between text-sm border-b pb-1 border-muted last:border-0">
                              <span className="truncate pr-2 flex-1">{s.expenses?.title}</span>
                              <span className="font-medium">R$ {Number(s.amount).toFixed(2)}</span>
                            </div>
                          ))}
                    </div>
                 </ScrollArea>
              </div>
            )}
            <div className="space-y-2">
              <Label>Comprovante *</Label>
              <Input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayRateioOpen(false)}>Cancelar</Button>
              <Button onClick={() => onPayRateio(rateioScope)} disabled={saving || !receiptFile}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Enviar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Individual Payment Dialog */}
      <Dialog open={payIndividualOpen} onOpenChange={(v) => { if (!v) { setPayIndividualOpen(false); setSelectedIndividualSplit(null); } else setPayIndividualOpen(true); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pagar Individual</DialogTitle></DialogHeader>
          {!selectedIndividualSplit ? (
            <ScrollArea className="max-h-[300px] pr-4">
              <div className="space-y-3">
                {individualPending.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-medium truncate">{s.expenses?.title}</p>
                      <p className="text-xs text-muted-foreground">R$ {Number(s.amount).toFixed(2)}</p>
                    </div>
                    <Button size="sm" onClick={() => setSelectedIndividualSplit(s)}>Pagar</Button>
                  </div>
                ))}
                {individualPending.length === 0 && <p className="text-center text-muted-foreground py-4">Sem pendências.</p>}
              </div>
            </ScrollArea>
          ) : (
            <div className="space-y-4">
               <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">{selectedIndividualSplit.expenses?.title}</p>
                  <p className="text-2xl font-bold text-primary mt-1">R$ {Number(selectedIndividualSplit.amount).toFixed(2)}</p>
               </div>
               <div className="space-y-2">
                  <Label>Comprovante *</Label>
                  <Input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
               </div>
               <DialogFooter>
                 <Button variant="outline" onClick={() => setSelectedIndividualSplit(null)}>Voltar</Button>
                 <Button onClick={onPayIndividual} disabled={saving || !receiptFile}>Enviar</Button>
               </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
