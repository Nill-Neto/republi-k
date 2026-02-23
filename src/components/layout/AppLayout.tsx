import { useState } from "react";
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
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ChevronDown,
  Menu,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

// Navigation Groups
const groups = [
  {
    title: "Geral",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Visão Geral" },
      { to: "/expenses", icon: Receipt, label: "Despesas" },
      { to: "/payments", icon: CreditCard, label: "Pagamentos" },
      { to: "/inventory", icon: Package, label: "Estoque" },
      { to: "/shopping", icon: ShoppingCart, label: "Compras" },
      { to: "/members", icon: Users, label: "Moradores" },
    ],
  },
  {
    title: "Convivência",
    items: [
      { to: "/bulletin", icon: MessageSquare, label: "Mural" },
      { to: "/rules", icon: BookOpen, label: "Regras" },
      { to: "/polls", icon: Vote, label: "Votações" },
    ],
  },
  {
    title: "Pessoal",
    items: [
      { to: "/personal/dashboard", icon: BarChart3, label: "Meu Dashboard" },
      { to: "/expenses", icon: ListChecks, label: "Minhas Despesas" },
      { to: "/personal/bills", icon: ScrollText, label: "Faturas" },
      { to: "/personal/cards", icon: Wallet, label: "Cartões" },
    ],
  },
];

const adminGroup = {
  title: "Administração",
  items: [
    { to: "/recurring", icon: RefreshCw, label: "Recorrências" },
    { to: "/invites", icon: UserPlus, label: "Convites" },
    { to: "/settings", icon: Settings, label: "Configurações" },
    { to: "/audit-log", icon: ScrollText, label: "Histórico" },
  ],
};

export function AppLayout() {
  const { profile, membership, isAdmin, signOut } = useAuth();
  const location = useLocation();

  const navGroups = isAdmin ? [...groups, adminGroup] : groups;

  const initials = (profile?.full_name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const SidebarContent = () => (
    <div className="flex h-full flex-col gap-4">
      <div className="flex h-14 items-center border-b px-6">
        <Link to="/" className="flex items-center gap-2 font-serif text-xl font-bold tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            R
          </div>
          Republi-K
        </Link>
      </div>

      <div className="flex-1 overflow-auto py-4 px-3">
        <nav className="space-y-6">
          {navGroups.map((group) => (
            <CollapsibleNavGroup key={group.title} title={group.title} items={group.items} location={location} />
          ))}
        </nav>
      </div>

      <div className="border-t p-4">
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          <Avatar className="h-9 w-9 border">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{profile?.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-card/50 md:flex">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {/* Mobile Menu Trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>

          <div className="flex-1">
            {membership && (
              <div className="flex items-center gap-2">
                <span className="hidden text-sm font-medium text-muted-foreground sm:inline-block">
                  Moradia:
                </span>
                <span className="text-sm font-semibold">{membership.group_name}</span>
                <span className="ml-2 inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
                  {membership.role === "admin" ? "Admin" : "Morador"}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <UserMenu profile={profile} membership={membership} signOut={signOut} />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function CollapsibleNavGroup({
  title,
  items,
  location,
}: {
  title: string;
  items: { to: string; icon: any; label: string }[];
  location: any;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-1">
      <div className="flex items-center justify-between px-3 py-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted">
            <ChevronDown
              className={cn("h-3 w-3 transition-transform duration-200", !isOpen && "-rotate-90")}
            />
            <span className="sr-only">Toggle</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-1">
        {items.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all hover:text-primary",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <item.icon
                className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")}
              />
              {item.label}
            </Link>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

function UserMenu({ profile, membership, signOut }: any) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <User className="h-5 w-5" />
          <span className="sr-only">Menu do usuário</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}