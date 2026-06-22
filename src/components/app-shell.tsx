import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Receipt, Banknote, ShieldCheck, FileBarChart,
  UserCog, LogOut, Plus, History, ClipboardCheck, Menu,
} from "lucide-react";
import { useState } from "react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NavItem = { title: string; to: string; icon: typeof Users };

const ADMIN_NAV: NavItem[] = [
  { title: "Dashboard", to: "/app/admin/dashboard", icon: LayoutDashboard },
  { title: "Customers", to: "/app/admin/customers", icon: Users },
  { title: "Receipts", to: "/app/admin/receipts", icon: Receipt },
  { title: "Cash", to: "/app/admin/cash", icon: Banknote },
  { title: "Staff", to: "/app/admin/staff", icon: UserCog },
  { title: "Reports", to: "/app/admin/reports", icon: FileBarChart },
  { title: "Audit Log", to: "/app/admin/audit", icon: ShieldCheck },
];

const COLLECTOR_NAV: NavItem[] = [
  { title: "Dashboard", to: "/app/collector/dashboard", icon: LayoutDashboard },
  { title: "New Receipt", to: "/app/collector/new-receipt", icon: Plus },
  { title: "History", to: "/app/collector/history", icon: History },
  { title: "Submit Cash", to: "/app/collector/submit-cash", icon: ClipboardCheck },
];

function FNLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground font-bold shadow-sm">FN</div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold tracking-tight">Fusion Net</span>
        <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/70">Billing & Cash</span>
      </div>
    </div>
  );
}

function AppSidebar({ role, fullName }: { role: AppRole; fullName?: string | null }) {
  const items = role === "admin" ? ADMIN_NAV : COLLECTOR_NAV;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/40 p-3">
        {collapsed ? (
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground font-bold mx-auto">FN</div>
        ) : (
          <FNLogo />
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{role === "admin" ? "Admin" : "Collector"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.to} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/40 p-3">
        {!collapsed && fullName && (
          <div className="mb-2 truncate text-xs text-sidebar-foreground/80">
            Signed in as <span className="font-medium text-sidebar-foreground">{fullName}</span>
          </div>
        )}
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent" onClick={logout}>
          <LogOut className="h-4 w-4" /> {!collapsed && "Sign out"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

function MobileBottomNav({ role }: { role: AppRole }) {
  const items = role === "admin" ? ADMIN_NAV.slice(0, 4) : COLLECTOR_NAV;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t bg-card shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((item) => {
        const active = pathname === item.to || pathname.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium active:bg-muted",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="leading-none">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MobileMoreMenu({ role }: { role: AppRole }) {
  const items = role === "admin" ? ADMIN_NAV.slice(4) : [];
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  if (role !== "admin") {
    return (
      <Button variant="ghost" size="icon" onClick={logout} className="md:hidden" aria-label="Sign out">
        <LogOut className="h-5 w-5" />
      </Button>
    );
  }
  return (
    <div className="md:hidden relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label="More">
        <Menu className="h-5 w-5" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-md border bg-popover shadow-md py-1">
            {items.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              >
                <it.icon className="h-4 w-4" />
                {it.title}
              </Link>
            ))}
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-destructive border-t mt-1"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function AppShell({
  role, fullName, title, action, children,
}: {
  role: AppRole;
  fullName?: string | null;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <SidebarProvider open={open} onOpenChange={setOpen} defaultOpen>
      <div className="flex min-h-screen w-full bg-background">
        <div className="hidden md:block">
          <AppSidebar role={role} fullName={fullName} />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-card/95 px-4 backdrop-blur">
            <div className="flex items-center gap-2 min-w-0">
              <div className="hidden md:block"><SidebarTrigger /></div>
              <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              {action}
              <MobileMoreMenu role={role} />
            </div>
          </header>
          <main className="flex-1 px-4 py-5 pb-28 md:px-6 md:pb-8">{children}</main>
          <MobileBottomNav role={role} />
        </div>
      </div>
    </SidebarProvider>
  );
}
