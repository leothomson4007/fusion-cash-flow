import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/kpi-card";
import { Money } from "@/components/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Wallet, TrendingUp, Receipt as ReceiptIcon, AlertTriangle } from "lucide-react";
import { formatDateTime, todayRangeISO } from "@/lib/format";

export const Route = createFileRoute("/app/admin/dashboard")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { from, to } = todayRangeISO();
      const [customers, balances, todayReceipts] = await Promise.all([
        supabase.from("customers").select("id,status,monthly_bill"),
        supabase.from("customer_balances").select("balance"),
        supabase.from("receipts").select("amount,status").gte("created_at", from).lt("created_at", to),
      ]);
      const cs = customers.data ?? [];
      const active = cs.filter((c) => c.status === "active");
      const mrr = active.reduce((s, c) => s + Number(c.monthly_bill ?? 0), 0);
      const outstanding = (balances.data ?? []).reduce((s, b) => s + Math.max(0, Number(b.balance ?? 0)), 0);
      const todayActive = (todayReceipts.data ?? []).filter((r) => r.status === "active");
      const todayCash = todayActive.reduce((s, r) => s + Number(r.amount ?? 0), 0);
      return {
        total: cs.length,
        active: active.length,
        mrr,
        outstanding,
        todayCount: todayActive.length,
        todayCash,
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
      const { from } = todayRangeISO();
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
      const { data: rs } = await supabase.from("receipts")
        .select("amount,collector_id,status")
        .gte("created_at", monthStart.toISOString())
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
      void from;
      return [...map.entries()]
        .map(([id, amt]) => ({ id, name: nameById.get(id) ?? "Unknown", amount: amt }))
        .sort((a, b) => b.amount - a.amount);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Overview</h2>
        <p className="text-sm text-muted-foreground">Live operating metrics for Fusion Net.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Active customers" value={isLoading ? "…" : `${stats?.active ?? 0} / ${stats?.total ?? 0}`} icon={UserCheck} accent="primary" />
        <KpiCard label="Monthly recurring" value={<Money value={stats?.mrr ?? 0} />} icon={TrendingUp} accent="success" />
        <KpiCard label="Today's collection" value={<Money value={stats?.todayCash ?? 0} />} hint={`${stats?.todayCount ?? 0} receipts`} icon={ReceiptIcon} accent="primary" />
        <KpiCard label="Outstanding balance" value={<Money value={stats?.outstanding ?? 0} />} icon={AlertTriangle} accent="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Latest receipts</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {(recent ?? []).length === 0 && <div className="p-5 text-sm text-muted-foreground">No receipts yet.</div>}
              {(recent ?? []).map((r) => {
                const c = r.customer as unknown as { full_name: string; customer_no: string } | null;
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.receipt_no} · {formatDateTime(r.created_at)}
                      </div>
                    </div>
                    <div className="text-right">
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
          <CardHeader><CardTitle className="text-base">This month — top collectors</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {(leaderboard ?? []).length === 0 && <div className="p-5 text-sm text-muted-foreground">No collections this month.</div>}
              {(leaderboard ?? []).map((c, i) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary text-sm font-semibold">{i + 1}</div>
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
        <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <Wallet className="h-4 w-4 text-primary" />
          <span>Outstanding balance = opening balance + accrued monthly bills − total payments. Updated in real time.</span>
        </CardContent>
      </Card>

      <Users className="hidden" />
    </div>
  );
}
