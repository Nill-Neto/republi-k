import { useState, useEffect, useRef } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import type { Location } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import { GroupSwitcher } from "./GroupSwitcher";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { Button } from "@/components/ui/button";
import { MenuToggleIcon } from "@/components/ui/menu-toggle-icon";
import { TextRoll } from "@/components/ui/animated-menu";
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
  Shield
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Sidebar, SidebarBody } from "@/components/ui/animated-sidebar";

const DESKTOP_SIDEBAR_STORAGE_KEY = "app-layout:desktop-sidebar-open";

const sidebarCoreItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Painel Geral" },
  { to: "/expenses", icon: Receipt, label: "Despesas" },
  { to: "/payments", icon: CreditCard, label: "Pagamentos" },
  { to: "/inventory", icon: Package, label: "Estoque" },
  { to: "/shopping", icon: ShoppingCart, label: "Compras" },
];

const adminItems = [
  { to: "/recurring", icon: RefreshCw, label: "Recorrências" },
  { to: "/invites", icon: UserPlus, label: "Convites" },
  { to: "/audit-log", icon: ScrollText, label: "Histórico" },
];

const convenienceItems = [
  { to: "/bulletin", icon: MessageSquare, label: "Mural" },
  { to: "/rules", icon: BookOpen, label: "Regras" },
  { to: "/polls", icon: Vote, label: "Votações" },
  { to: "/members", icon: Users, label: "Moradores" },
];

export function AppLayout() {
  const { isAdmin } = useAuth();
  const location = useLocation();

  // Desktop mantém estado persistente; mobile é controlado por toggle/backdrop.
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DESKTOP_SIDEBAR_STORAGE_KEY) === "true";
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const previousMobileViewport = useRef<boolean | null>(null);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handleScroll = () => setIsScrolled(el.scrollTop > 20);
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  const sidebarItems = isAdmin
    ? [{ to: "/admin", icon: Shield, label: "Administração" }, ...sidebarCoreItems, ...adminItems]
    : sidebarCoreItems;

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      DESKTOP_SIDEBAR_STORAGE_KEY,
      desktopMenuOpen ? "true" : "false"
    );
  }, [desktopMenuOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const syncViewport = () => {
      const isMobile = mediaQuery.matches;
      const wasMobile = previousMobileViewport.current;

      setIsMobileViewport(isMobile);

      // Evita reset indiscriminado: só fecha o menu móvel ao sair do mobile.
      if (wasMobile === true && !isMobile) {
        setMobileMenuOpen(false);
      }

      previousMobileViewport.current = isMobile;
    };

    syncViewport();

    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  const isDesktopExpanded = desktopMenuOpen;
  const isSidebarExpanded = isMobileViewport ? true : isDesktopExpanded;
  const isSidebarVisibleOnMobile = isMobileViewport && mobileMenuOpen;

  const handleMenuToggle = () => {
    if (isMobileViewport) {
      setMobileMenuOpen((prev) => !prev);
      return;
    }

    setDesktopMenuOpen((prev) => !prev);
  };

  const handleNavItemClick = () => {
    if (isMobileViewport) {
      setMobileMenuOpen(false);
    }
  };

  const Logo = () => (
    <Link to="/dashboard" onClick={handleNavItemClick} className="flex items-center gap-2 font-serif text-xl font-bold tracking-tight">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        R
      </div>
      <span className="text-foreground">Republi-K</span>
    </Link>
  );

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className={cn("flex-1 overflow-y-auto py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", isSidebarExpanded ? "px-3" : "px-2")}>
        <nav className="space-y-1">
          {sidebarItems.map((item) => (
            <SidebarNavLink
              key={item.to}
              item={item}
              location={location}
              onClick={handleNavItemClick}
              menuOpen={isSidebarExpanded}
            />
          ))}

          <div className="md:hidden pt-4 mt-4 border-t border-sidebar-border space-y-1">
            {convenienceItems.map((item) => (
              <SidebarNavLink
                key={item.to}
                item={item}
                location={location}
                onClick={handleNavItemClick}
                menuOpen={isSidebarExpanded}
              />
            ))}
          </div>
        </nav>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-transparent">
      {/* Header Superior Fixo — scroll-aware */}
      <motion.header
        className={cn(
          "z-50 flex h-16 shrink-0 items-center justify-between px-4 md:px-6 transition-all duration-300 border-b",
          isScrolled
            ? "bg-card/80 backdrop-blur-xl shadow-sm"
            : "bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60"
        )}
        initial={{ opacity: 0, y: -12, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ type: "spring", bounce: 0.3, duration: 0.7 }}
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 shrink-0"
            onClick={handleMenuToggle}
          >
            <MenuToggleIcon
              open={isMobileViewport ? mobileMenuOpen : desktopMenuOpen}
              className="h-8 w-8 scale-125"
            />
            <span className="sr-only">Menu</span>
          </Button>

          <Logo />
          <GroupSwitcher />
        </div>

        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <div className="hidden md:flex items-center gap-1 border-r pr-4 mr-2">
            {convenienceItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link key={item.to} to={item.to}>
                  <motion.div
                    className={cn(
                      "flex items-center rounded-full transition-colors duration-200 h-9 px-3 relative",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-transparent text-muted-foreground hover:bg-muted"
                    )}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <item.icon size={18} strokeWidth={2} />
                    
                    <motion.div
                      initial={false}
                      animate={{
                        width: isActive ? "auto" : 0,
                        opacity: isActive ? 1 : 0,
                        marginLeft: isActive ? 8 : 0,
                      }}
                      className="overflow-hidden flex items-center"
                    >
                      <span className="text-sm font-medium whitespace-nowrap">
                        {item.label}
                      </span>
                    </motion.div>
                  </motion.div>
                </Link>
              );
            })}
          </div>

          <AnimatedThemeToggler />
          <NotificationBell />
          <UserMenu />
        </div>
      </motion.header>

      {/* Conteúdo Principal (Sidebar + Main) */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Backdrop mobile */}
        {isSidebarVisibleOnMobile && (
          <div 
            className="absolute inset-0 z-30 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <div 
          className={cn(
            "h-full flex shrink-0",
            isMobileViewport 
              ? cn("absolute left-0 top-0 bottom-0 z-40 transition-transform duration-300", !mobileMenuOpen && "-translate-x-full")
              : "relative z-20"
          )}
          onMouseEnter={!isMobileViewport ? () => setDesktopMenuOpen(true) : undefined}
          onMouseLeave={!isMobileViewport ? () => setDesktopMenuOpen(false) : undefined}
        >
          <Sidebar 
            open={isSidebarExpanded}
            setOpen={isMobileViewport ? setMobileMenuOpen : setDesktopMenuOpen}
          >
            <SidebarBody className="justify-between gap-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl !max-w-[230px]">
              <SidebarContent />
            </SidebarBody>
          </Sidebar>
        </div>

        <main ref={mainRef} className="relative flex-1 overflow-x-hidden overflow-y-auto bg-transparent p-4 pt-1 md:px-8 md:pt-2">
          {/* Decorative background — clipped to prevent scroll overflow */}
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 [background:radial-gradient(125%_125%_at_50%_0%,transparent_40%,hsl(var(--primary)/0.08)_100%)]" />
            <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
          </div>
          {/* O pb-32 é ~128px, garantindo que o cabeçalho sempre tenha espaço para encolher, 
              mas SEM forçar a altura com min-h. Logo, telas curtas não terão barra de rolagem. */}
          <div className="max-w-7xl mx-auto w-full pb-32">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarNavLink({
  item,
  location,
  onClick,
  menuOpen,
}: {
  item: { to: string; icon: LucideIcon; label: string };
  location: Location;
  onClick: () => void;
  menuOpen: boolean;
}) {
  const isActive = location.pathname === item.to;
  
  const LinkContent = (
    <Link
      to={item.to}
      onClick={onClick}
      className="block w-full outline-none"
    >
      <motion.div
        initial="initial"
        whileHover="hovered"
        className={cn(
          "group flex items-center gap-3 rounded-md py-2.5 text-sm font-medium transition-all relative overflow-hidden",
          menuOpen ? "px-3" : "px-0 justify-center h-10 w-10 mx-auto",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm font-semibold"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        {isActive && (
          <div className={cn("absolute left-0 bg-sidebar-primary", menuOpen ? "inset-y-2 w-1 rounded-r-full" : "inset-y-0 w-1 rounded-r-md")} />
        )}
        <item.icon
          className={cn(
            "shrink-0 transition-colors relative z-10",
            menuOpen ? "h-[18px] w-[18px]" : "h-5 w-5",
            isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
          )}
        />
        {menuOpen && (
          <div className="flex-1 min-w-0">
            <TextRoll className="w-full text-left tracking-wide">{item.label}</TextRoll>
          </div>
        )}
      </motion.div>
    </Link>
  );

  if (!menuOpen) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {LinkContent}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10} className="font-medium bg-sidebar text-sidebar-foreground border-sidebar-border">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return LinkContent;
}
