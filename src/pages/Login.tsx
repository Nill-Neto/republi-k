import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Home, Shield, Users, BarChart3 } from "lucide-react";

export default function Login() {
  const { user, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  const features = [
    { icon: Home, label: "Gestão de moradia", desc: "Despesas coletivas e individuais" },
    { icon: Users, label: "Rateio justo", desc: "Divisão igualitária ou por peso" },
    { icon: Shield, label: "Prestação de contas", desc: "Comprovantes e relatórios" },
    { icon: BarChart3, label: "Dashboards", desc: "Métricas em tempo real" },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground">
        <div>
          <h1 className="text-4xl font-serif">Republi-K</h1>
          <p className="mt-2 text-primary-foreground/70 font-sans text-sm tracking-wide uppercase">
            Gestão de moradia compartilhada
          </p>
        </div>

        <div className="space-y-8">
          {features.map((f) => (
            <div key={f.label} className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">{f.label}</p>
                <p className="text-sm text-primary-foreground/60">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-primary-foreground/40">
          © {new Date().getFullYear()} Republi-K. Todos os direitos reservados.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-serif text-foreground">Bem-vindo</h2>
            <p className="mt-2 text-muted-foreground">
              Entre com sua conta Google para começar.
            </p>
          </div>

          <Button
            onClick={signInWithGoogle}
            size="lg"
            className="w-full gap-3 bg-foreground text-background hover:bg-foreground/90"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Entrar com Google
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Ao entrar, você concorda com os termos de uso e política de privacidade.
          </p>
        </div>
      </div>
    </div>
  );
}
