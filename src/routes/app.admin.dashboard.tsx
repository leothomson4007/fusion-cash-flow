import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/kpi-card";
import { Money } from "@/components/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, UserCheck, Wallet, TrendingUp, Receipt as ReceiptIcon,
  AlertTriangle, ClipboardCheck, CalendarRange, Plus, UserCog, FileBarChart,
} from "lucide-react";
import { formatDateTime, todayRangeISO } from "@/lib/format";

export const Route = createFileRoute("/app/admin/dashboard")({
  component: AdminDashboard,
});

function monthStartISO() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { from, to } = todayRangeISO();
      const monthFrom = monthStartISO();
      const [customers, balances, todayReceipts, monthReceipts, pendingCash] = await Promise.all([
        supabase.from("customers").select("id,status,monthly_bill"),
        supabase.from("customer_balances").select("balance"),
        supabase.from("receipts").select("amount,status,payment_type").gte("created_at", from).lt("created_at", to),
        supabase.from("receipts").select("amount,status,payment_type").gte("created_at", monthFrom),
        supabase.from("cash_submissions").select("id,expected_amount,declared_amount,status").eq("status", "pending"),
      ]);
      const cs = (customers.data ?? []).filter((c) => c.status !== "deleted");
      const active = cs.filter((c) => c.status === "active");
      const mrr = active.reduce((s, c) => s + Number(c.monthly_bill ?? 0), 0);
      const outstanding = (balances.data ?? []).reduce((s, b) => s + Math.max(0, Number(b.balance ?? 0)), 0);
      const todayActive = (todayReceipts.data ?? []).filter((r) => r.status === "active");
      const todayCash = todayActive.reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const monthActive = (monthReceipts.data ?? []).filter((r) => r.status === "active");
      const monthTotal = monthActive.reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const monthCash = monthActive.filter((r) => r.payment_type === "cash").reduce((s, r) => s + Number(r.amount), 0);
      const monthDigital = monthTotal - monthCash;
      const pending = pendingCash.data ?? [];
      const pendingAmount = pending.reduce((s, p) => s + Number(p.declared_amount ?? p.expected_amount ?? 0), 0);
      return {
        total: cs.length,
        active: active.length,
        mrr,
        outstanding,
        todayCount: todayActive.length,
        todayCash,
        monthTotal,
        monthCount: monthActive.length,
        monthCash, monthDigital,
        pendingCount: pending.length,
        pendingAmount,
      };
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["admin-recent-receipts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("receipts")
        .select("id,receipt_no,amount,payment_type,status,created_at,customer:customers(full_name,customer_no)")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: leaderboard } = useQuery({
    queryKey: ["admin-leaderboard"],
    queryFn: async () => {
      const { data: rs } = await supabase.from("receipts")
        .select("amount,collector_id,status")
        .gte("created_at", monthStartISO())
        .eq("status", "active");
      const map = new Map<string, number>();
      (rs ?? []).forEach((r) => {
        if (!r.collector_id) return;
        map.set(r.collector_id, (map.get(r.collector_id) ?? 0) + Number(r.amount));
      });
      const ids = [...map.keys()];
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return [...map.entries()]
        .map(([id, amt]) => ({ id, name: nameById.get(id) ?? "Unknown", amount: amt }))
        .sort((a, b) => b.amount - a.amount);
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold">Overview</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Live operating metrics for Fusion Net.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline"><Link to="/app/admin/customers"><Users className="h-4 w-4 mr-1.5" />Customers</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/app/admin/cash"><ClipboardCheck className="h-4 w-4 mr-1.5" />Verify cash</Link></Button>
          <Button asChild size="sm"><Link to="/app/admin/receipts"><Plus className="h-4 w-4 mr-1.5" />New receipt</Link></Button>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Active customers" value={isLoading ? "…" : `${stats?.active ?? 0} / ${stats?.total ?? 0}`} icon={UserCheck} accent="primary" />
        <KpiCard label="Today's collection" value={<Money value={stats?.todayCash ?? 0} />} hint={`${stats?.todayCount ?? 0} receipts`} icon={ReceiptIcon} accent="success" />
        <KpiCard label="Outstanding" value={<Money value={stats?.outstanding ?? 0} />} icon={AlertTriangle} accent="warning" />
        <KpiCard label="Monthly recurring" value={<Money value={stats?.mrr ?? 0} />} icon={TrendingUp} accent="primary" />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="This month" value={<Money value={stats?.monthTotal ?? 0} />} hint={`${stats?.monthCount ?? 0} receipts`} icon={CalendarRange} accent="primary" />
        <KpiCard label="Month cash" value={<Money value={stats?.monthCash ?? 0} />} icon={Wallet} accent="success" />
        <KpiCard label="Month digital" value={<Money value={stats?.monthDigital ?? 0} />} icon={TrendingUp} accent="primary" />
        <KpiCard label="Cash to verify" value={<Money value={stats?.pendingAmount ?? 0} />} hint={`${stats?.pendingCount ?? 0} submissions`} icon={ClipboardCheck} accent={stats?.pendingCount ? "warning" : "primary"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Latest receipts</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/app/admin/receipts">All</Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {(recent ?? []).length === 0 && <div className="p-5 text-sm text-muted-foreground">No receipts yet.</div>}
              {(recent ?? []).map((r) => {
                const c = r.customer as unknown as { full_name: string; customer_no: string } | null;
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.receipt_no} · {formatDateTime(r.created_at)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Money value={r.amount} tone={r.status === "cancelled" ? "muted" : "success"} />
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.payment_type}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Top collectors (this month)</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/app/admin/staff"><UserCog className="h-4 w-4" /></Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {(leaderboard ?? []).length === 0 && <div className="p-5 text-sm text-muted-foreground">No collections this month.</div>}
              {(leaderboard ?? []).map((c, i) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-sm font-semibold">{i + 1}</div>
                    <div className="truncate font-medium">{c.name}</div>
                  </div>
                  <Money value={c.amount} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-4 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-primary shrink-0" />
            <span>Outstanding = opening balance + accrued bills − payments. Updated in real time.</span>
          </div>
          <Button asChild variant="link" size="sm" className="sm:ml-auto p-0 h-auto"><Link to="/app/admin/reports">Open reports →</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
