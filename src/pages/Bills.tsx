import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, ChevronLeft, ChevronRight, Loader2, CreditCard } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORIES: Record<string, string> = {
  rent: "Aluguel",
  utilities: "Contas",
  internet: "Internet/TV",
  cleaning: "Limpeza",
  maintenance: "Manutenção",
  groceries: "Mercado",
  other: "Outros",
};

export default function Bills() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCardId, setSelectedCardId] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date_desc");
  const [initialized, setInitialized] = useState(false);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const { data: cards = [] } = useQuery({
    queryKey: ["credit-cards", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("credit_cards").select("*").eq("user_id", user!.id);
      return (data as any[]) ?? [];
    },
    enabled: !!user,
  });

  // Effect to set initial month based on card closing date
  useEffect(() => {
    if (!initialized && cards.length > 0) {
      // Use the first card as reference for the default view
      const card = cards[0];
      const now = new Date();
      
      // If today is past the closing day, the "current" bill is next month
      if (now.getDate() >= card.closing_day) {
        setCurrentDate(addMonths(now, 1));
      }
      setInitialized(true);
    }
  }, [cards, initialized]);

  const { data: billInstallments = [], isLoading } = useQuery({
    queryKey: ["bill-installments", user?.id, month, year, selectedCardId],
    queryFn: async () => {
      let query = supabase
        .from("expense_installments" as any)
        .select("*, expenses(title, credit_card_id, category, purchase_date)")
        .eq("user_id", user!.id)
        .eq("bill_month", month)
        .eq("bill_year", year)
        .limit(1000); // Ensure we fetch all items, not just the default page size

      const { data, error } = await query;
      if (error) throw error;

      let items = (data as any[]) ?? [];
      if (selectedCardId !== "all") {
        items = items.filter((i: any) => i.expenses?.credit_card_id === selectedCardId);
      }
      return items;
    },
    enabled: !!user,
  });

  const sortedInstallments = [...billInstallments].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return (a.expenses?.title || "").localeCompare(b.expenses?.title || "");
      case "category":
        return (a.expenses?.category || "").localeCompare(b.expenses?.category || "");
      case "amount_desc":
        return b.amount - a.amount;
      case "amount_asc":
        return a.amount - b.amount;
      case "date_asc":
        return new Date(a.expenses?.purchase_date || 0).getTime() - new Date(b.expenses?.purchase_date || 0).getTime();
      case "date_desc":
      default:
        return new Date(b.expenses?.purchase_date || 0).getTime() - new Date(a.expenses?.purchase_date || 0).getTime();
    }
  });

  const totalBill = billInstallments.reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-serif">Faturas</h1>
          <p className="text-muted-foreground mt-1">Parcelas de cartões de crédito.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-card border rounded-lg p-1">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="px-4 text-sm font-medium min-w-[120px] text-center capitalize">
            {format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Filtros</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Cartão</label>
                <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os cartões</SelectItem>
                    {cards.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Ordenar por</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_desc">Data (Recentes)</SelectItem>
                    <SelectItem value="date_asc">Data (Antigos)</SelectItem>
                    <SelectItem value="amount_desc">Valor (Maior)</SelectItem>
                    <SelectItem value="amount_asc">Valor (Menor)</SelectItem>
                    <SelectItem value="name">Nome (A-Z)</SelectItem>
                    <SelectItem value="category">Categoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/50 border-dashed">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground uppercase font-bold">Total da Fatura</p>
              <p className="text-3xl font-serif mt-2">R$ {totalBill.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Detalhamento</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                Total: <span className="font-bold">R$ {totalBill.toFixed(2)}</span>
              </span>
              <Badge variant="outline" className="text-xs font-normal">
                {sortedInstallments.length} lançamento(s)
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : sortedInstallments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Calendar className="h-10 w-10 mb-2 opacity-20" /><p>Nenhum lançamento este mês.</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {sortedInstallments.map((item: any) => {
                    const card = cards.find((c) => c.id === item.expenses?.credit_card_id);
                    const categoryLabel = CATEGORIES[item.expenses?.category] || item.expenses?.category || "Outros";
                    
                    return (
                      <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg bg-card/50 hover:bg-muted/30 transition-colors">
                        <div className="min-w-0 flex-1 mr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium truncate">{item.expenses?.title}</p>
                            <Badge variant="secondary" className="text-[10px] h-5">{categoryLabel}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{format(new Date(item.expenses?.purchase_date || item.created_at), "dd/MM/yyyy")}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <CreditCard className="h-3 w-3" />
                              {card?.label || "Cartão"}
                            </span>
                            <span>•</span>
                            <span>Parcela {item.installment_number}</span>
                          </div>
                        </div>
                        <p className="font-bold text-lg whitespace-nowrap">R$ {Number(item.amount).toFixed(2)}</p>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}