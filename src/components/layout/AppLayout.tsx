import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "./NotificationBell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  User,
  Users,
  Settings,
  LogOut,
  UserPlus,
  ScrollText,
  Receipt,
  CreditCard,
  RefreshCw,
  Package,
  ShoppingCart,
  MessageSquare,
  BookOpen,
  Vote,
  Wallet,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";

const baseNavItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/expenses", icon: Receipt, label: "Despesas" },
  { to: "/payments", icon: CreditCard, label: "Pagamentos" },
  { to: "/inventory", icon: Package, label: "Estoque" },
  { to: "/shopping", icon: ShoppingCart, label: "Compras" },
  { to: "/members", icon: Users, label: "Moradores" },
  { to: "/bulletin", icon: MessageSquare, label: "Mural" },
  { to: "/rules", icon: BookOpen, label: "Regras" },
  { to: "/polls", icon: Vote, label: "Votações" },
];

const adminItems = [
  { to: "/recurring", icon: RefreshCw, label: "Recorrências" },
  { to: "/invites", icon: UserPlus, label: "Convites" },
  { to: "/settings", icon: Settings, label: "Config." },
  { to: "/audit-log", icon: ScrollText, label: "Histórico" },
];

const personalItems = [
  { to: "/personal/expenses", icon: ListChecks, label: "Minhas despesas" },
  { to: "/personal/cards", icon: Wallet, label: "Cartões pessoais" },
];

export function AppLayout() {
  const { profile, membership, isAdmin, signOut } = useAuth();
  const location = useLocation();

  const groupNavItems = isAdmin ? [...baseNavItems, ...adminItems] : baseNavItems;
  const allNavItems = [...groupNavItems, ...personalItems];

  const initials = (profile?.full_name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-serif text-xl text-foreground">
              Republi-K
            </Link>
            {membership && (
              <span className="hidden sm:inline text-xs text-muted-foreground border rounded-full px-2 py-0.5">
                {membership.group_name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm">{profile?.full_name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{profile?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{profile?.email}</p>
                  {membership && (
                    <span className="mt-1 inline-block text-xs rounded bg-accent/10 text-accent px-1.5 py-0.5 font-medium">
                      {membership.role === "admin" ? "Administrador" : "Morador"}
                    </span>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Meu Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <nav className="border-b bg-card hidden md:block">
        <div className="container flex gap-1 overflow-x-auto">
          {groupNavItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 text-sm transition-colors border-b-2 -mb-px whitespace-nowrap",
                location.pathname === item.to
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>

        {personalItems.length > 0 && (
          <div className="border-t">
            <div className="container flex items-center gap-2 overflow-x-auto py-1.5">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground/80">
                Pessoal
              </span>
              {personalItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-sm transition-colors border-b-2 border-transparent whitespace-nowrap",
                    location.pathname === item.to
                      ? "text-foreground border-primary font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      <main className="container py-6 pb-20 md:pb-6">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card md:hidden">
        <div className="flex overflow-x-auto">
          {allNavItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-3 text-[10px] transition-colors flex-1 min-w-[72px]",
                location.pathname === item.to
                  ? "text-primary font-medium"
                  : "text-muted-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}