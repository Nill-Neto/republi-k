import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Users, ArrowRight, ShieldAlert, Wallet } from "lucide-react";

interface AdminTabProps {
  memberBalances: any[];
  members: any[];
  pendingPaymentsCount: number;
}

export function AdminTab({ memberBalances, members, pendingPaymentsCount }: AdminTabProps) {
  const membersWithBalance = members.map(m => {
    const bal = memberBalances.find(b => b.user_id === m.user_id);
    return {
      ...m,
      balance: bal ? Number(bal.balance) : 0,
      total_owed: bal ? Number(bal.total_owed) : 0,
      total_paid: bal ? Number(bal.total_paid) : 0,
    };
  });

  const totalReceivable = membersWithBalance.reduce((acc, m) => acc + (m.balance < 0 ? Math.abs(m.balance) : 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 border-l-4 border-l-primary">
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">Pagamentos a Confirmar</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-bold">{pendingPaymentsCount}</div>
             <p className="text-xs text-muted-foreground mt-1">Aguardando sua aprovação</p>
             {pendingPaymentsCount > 0 && (
               <Button variant="link" className="p-0 h-auto text-xs mt-2" asChild>
                 <Link to="/payments?filter=pending">Ver pagamentos <ArrowRight className="h-3 w-3 ml-1"/></Link>
               </Button>
             )}
           </CardContent>
        </Card>

        <Card className="md:col-span-1 border-l-4 border-l-destructive">
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">Total a Receber</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-bold text-destructive">R$ {totalReceivable.toFixed(2)}</div>
             <p className="text-xs text-muted-foreground mt-1">Soma de saldos devedores (Coletivo)</p>
           </CardContent>
        </Card>

        <Card className="md:col-span-1 border-l-4 border-l-muted">
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">Caixa Previsto</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-bold text-foreground">--</div>
             <p className="text-xs text-muted-foreground mt-1">Saldo consolidado (Em breve)</p>
           </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> Status dos Moradores <span className="text-xs font-normal text-muted-foreground ml-2">(Apenas Rateio Coletivo)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {membersWithBalance.map(member => (
              <div key={member.user_id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={member.profile?.avatar_url} />
                    <AvatarFallback>{member.profile?.full_name?.substring(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{member.profile?.full_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{member.role === 'admin' ? 'Administrador' : 'Morador'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`font-bold block text-sm ${member.balance < -0.05 ? "text-destructive" : "text-green-600"}`}>
                    {member.balance < -0.05 ? `Deve R$ ${Math.abs(member.balance).toFixed(2)}` : "Em dia"}
                  </span>
                  {member.balance >= -0.05 && (
                     <span className="text-xs text-muted-foreground block">
                        {member.balance > 0.05 ? `Crédito: R$ ${member.balance.toFixed(2)}` : "Saldo zerado"}
                     </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}