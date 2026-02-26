import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Users,
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
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainNavGroups = [
  {
    title: "Moradia",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Painel Geral" },
      { to: "/expenses", icon: Receipt, label: "Despesas" },
      { to: "/payments", icon: CreditCard, label: "Pagamentos" },
      { to: "/inventory", icon: Package, label: "Estoque" },
      { to: "/shopping", icon: ShoppingCart, label: "Compras" },
    ],
  },
  {
    title: "Minhas Finanças",
    items: [
      { to: "/personal/bills", icon: ScrollText, label: "Faturas" },
      { to: "/personal/cards", icon: Wallet, label: "Meus Cartões" },
    ],
  },
];

const convenienceItems = [
  { to: "/bulletin", icon: MessageSquare, label: "Mural" },
  { to: "/rules", icon: BookOpen, label: "Regras" },
  { to: "/polls", icon: Vote, label: "Votações" },
  { to: "/members", icon: Users, label: "Moradores" },
];

const adminGroup = {
  title: "Administração",
  items: [
    { to: "/recurring", icon: RefreshCw, label: "Recorrências" },
    { to: "/invites", icon: UserPlus, label: "Convites" },
    { to: "/audit-log", icon: ScrollText, label: "Histórico" },
  ],
};

export function AppLayout() {
  const { membership, isAdmin } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sidebarGroups = isAdmin ? [...mainNavGroups, adminGroup] : mainNavGroups;

  const Logo = () => (
    <Link to="/" className="flex items-center gap-2 font-serif text-xl font-bold tracking-tight">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        R
      </div>
      <span>Republi-K</span>
    </Link>
  );

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto py-4 px-3">
        <nav className="space-y-6">
          {sidebarGroups.map((group) => (
            <CollapsibleNavGroup 
              key={group.title} 
              title={group.title} 
              items={group.items} 
              location={location} 
              onItemClick={() => setMobileMenuOpen(false)}
            />
          ))}

          <div className="md:hidden">
            <CollapsibleNavGroup 
              title="Convivência" 
              items={convenienceItems} 
              location={location} 
              onItemClick={() => setMobileMenuOpen(false)}
            />
          </div>
        </nav>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header Superior Fixo */}
      <header className="z-50 flex h-14 shrink-0 items-center justify-between border-b bg-background/95 px-4 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden shrink-0"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="sr-only">Menu</span>
          </Button>

          <Logo />

          {membership && (
            <div className="hidden sm:flex items-center gap-2 border-l pl-4 min-w-0">
              <span className="text-xs font-medium text-muted-foreground/80 whitespace-nowrap">
                Moradia:
              </span>
              <span className="text-sm font-semibold truncate">{membership.group_name}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <div className="hidden md:flex items-center gap-1 border-r pr-2">
            {convenienceItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      size="icon"
                      className={cn("h-9 w-9", isActive && "text-primary")}
                      asChild
                    >
                      <Link to={item.to}>
                        <item.icon className="h-4 w-4" />
                        <span className="sr-only">{item.label}</span>
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          <NotificationBell />
          <UserMenu />
        </div>
      </header>

      {/* Conteúdo Principal (Sidebar + Main) */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar Desktop */}
        <aside className="hidden w-64 shrink-0 border-r bg-primary text-primary-foreground md:flex md:flex-col overflow-y-auto shadow-xl">
          <SidebarContent />
        </aside>

        {/* Sidebar Mobile (Aparece abaixo do header sem escurecer a tela toda) */}
        {mobileMenuOpen && (
          <>
            {/* Overlay invisível para fechar ao clicar fora, mas sem escurecer */}
            <div 
              className="absolute inset-0 z-30 md:hidden" 
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="absolute top-0 left-0 bottom-0 z-40 w-64 md:hidden bg-primary text-primary-foreground shadow-2xl overflow-y-auto animate-in slide-in-from-left duration-300">
              <SidebarContent />
            </div>
          </>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function CollapsibleNavGroup({
  title,
  items,
  location,
  onItemClick,
}: {
  title: string;
  items: { to: string; icon: any; label: string }[];
  location: any;
  onItemClick?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-1">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-1 hover:bg-white/10 rounded-md transition-colors group cursor-pointer">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/50 group-hover:text-primary-foreground">
          {title}
        </h4>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-primary-foreground/30 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pt-1 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
        {items.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onItemClick}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-white/20 text-white"
                  : "text-primary-foreground/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon
                className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-primary-foreground/50 group-hover:text-white")}
              />
              {item.label}
            </Link>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}