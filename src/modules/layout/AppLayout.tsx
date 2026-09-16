import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Home,
  LayoutDashboard,
  MapPin,
  Package,
  Users,
  Bell,
  FileText,
  ScanLine,
  Menu,
  LogOut,
  KeyRound,
  ChevronDown,
  ArrowLeftRight,
} from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { CurrentUser } from "@/modules/auth/queries";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NAV_ITEMS = [
  { to: "/inicio", label: "Inicio", icon: Home, adminOnly: false },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { to: "/sitios", label: "Sitios", icon: MapPin, adminOnly: false },
  { to: "/activos", label: "Activos", icon: Package, adminOnly: false },
  { to: "/movimientos", label: "Movimientos", icon: ArrowLeftRight, adminOnly: false },
  { to: "/ingenieros", label: "Ingenieros", icon: Users, adminOnly: false },
  { to: "/admin/alertas", label: "Alertas", icon: Bell, adminOnly: true },
  { to: "/reportes", label: "Reportes", icon: FileText, adminOnly: false },
  { to: "/escanear", label: "Escanear", icon: ScanLine, adminOnly: false },
] as const;

export function GtacBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-sm font-bold tracking-tight text-background">
        GT
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="text-base font-semibold text-foreground">GTAC</p>
          <p className="text-xs text-muted-foreground">Trazabilidad de Activos</p>
        </div>
      )}
    </div>
  );
}

function NavLinks({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly).map((item) => {
        const active = pathname === item.to;
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu({ user }: { user: CurrentUser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
          {(user.fullName ?? user.email).slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {user.fullName ?? user.email}
          </p>
          <p className="text-xs text-muted-foreground">
            {user.role === "admin" ? "Administrador" : user.role === "engineer" ? "Ingeniero" : "Sin rol"}
          </p>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/cuenta">
            <KeyRound className="mr-2 h-4 w-4" />
            Cambiar contraseña
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void handleSignOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppLayout({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col justify-between border-r border-border bg-card px-4 py-5 lg:flex">
        <div className="space-y-6">
          <GtacBrand />
          <NavLinks isAdmin={user.role === "admin"} />
        </div>
        <UserMenu user={user} />
      </aside>

      {/* Barra superior móvil */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <GtacBrand />
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            aria-label="Abrir menú"
            className="rounded-lg border border-border p-2 text-foreground"
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-4">
            <SheetTitle className="sr-only">Menú</SheetTitle>
            <div className="flex h-full flex-col justify-between">
              <div className="space-y-6">
                <GtacBrand />
                <NavLinks
                  onNavigate={() => setMobileOpen(false)}
                  isAdmin={user.role === "admin"}
                />
              </div>
              <UserMenu user={user} />
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <main className="px-4 py-6 lg:ml-64 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
