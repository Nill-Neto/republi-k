import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Receipt, TrendingUp, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const { profile, membership, isAdmin } = useAuth();

  const stats = [
    { label: "Moradores", value: "—", icon: Users, color: "text-primary" },
    { label: "Despesas do mês", value: "R$ —", icon: Receipt, color: "text-accent" },
    { label: "Seu saldo", value: "R$ —", icon: TrendingUp, color: "text-success" },
    { label: "Pendências", value: "—", icon: AlertTriangle, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif">
          Olá, {profile?.full_name?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin ? "Painel do administrador" : "Painel do morador"} — {membership?.group_name}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-sm">{s.label}</CardDescription>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-serif">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-xl">Próximos passos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          {isAdmin ? (
            <>
              <p>• Convide moradores pela aba <strong>Convites</strong></p>
              <p>• Configure os percentuais de rateio em <strong>Configurações</strong></p>
              <p>• Na Fase 2: registre despesas e pagamentos</p>
            </>
          ) : (
            <>
              <p>• Aguarde o administrador registrar as despesas do mês</p>
              <p>• Na Fase 2: envie comprovantes de pagamento</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
