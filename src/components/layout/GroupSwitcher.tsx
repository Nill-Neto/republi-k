import { useAuth, type GroupMembership } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Plus, Shield, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export function GroupSwitcher() {
  const { membership, memberships, setActiveGroupId, isAdmin } = useAuth();
  const navigate = useNavigate();

  if (!membership) return null;

  const handleSwitch = (m: GroupMembership) => {
    if (m.group_id !== membership.group_id) {
      setActiveGroupId(m.group_id);
      navigate("/dashboard", { replace: true });
    }
  };

  // Single group — no dropdown needed, just show label
  if (memberships.length <= 1) {
    return (
      <div className="hidden sm:flex items-center gap-2 border-l pl-4 min-w-0">
        <span className="text-xs font-medium text-muted-foreground/80 whitespace-nowrap">Moradia:</span>
        <span className="text-sm font-semibold truncate">{membership.group_name}</span>
        {isAdmin && (
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => navigate("/groups/new")}>
            <Plus className="h-3.5 w-3.5" />
            <span className="sr-only">Criar novo grupo</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="hidden sm:flex items-center border-l pl-4 min-w-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 h-8 max-w-[200px]">
            <span className="truncate text-sm font-semibold">{membership.group_name}</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Seus grupos</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {memberships.map((m) => {
            const isActive = m.group_id === membership.group_id;
            return (
              <DropdownMenuItem
                key={m.group_id}
                onClick={() => handleSwitch(m)}
                className={cn("gap-3 cursor-pointer", isActive && "bg-accent")}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                  {m.role === "admin" ? <Shield className="h-3.5 w-3.5" /> : <Home className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.group_name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{m.role}</p>
                </div>
                {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => navigate("/groups/new")}
            className="gap-3 cursor-pointer text-primary"
          >
            <Plus className="h-4 w-4" />
            Criar novo grupo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
