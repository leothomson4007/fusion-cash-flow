import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/money";
import { KpiCard } from "@/components/kpi-card";
import { formatDateTime, todayRangeISO } from "@/lib/format";
import { Plus, Receipt as ReceiptIcon, Wallet, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/app/collector/dashboard")({
  component: CollectorDashboard,
});

function CollectorDashboard() {
  const { user } = useAuth();
  const uid = user?.id;

  const { data: today } = useQuery({
    queryKey: ["collector-today", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { from, to } = todayRangeISO();
      const { data } = await supabase.from("receipts")
        .select("id,receipt_no,amount,status,created_at,customer:customers(full_name,customer_no)")
        .eq("collector_id", uid!).gte("created_at", from).lt("created_at", to)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: expected } = useQuery({
    queryKey: ["collector-expected", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.rpc("collector_expected_cash", { _uid: uid! });
      return Number(data ?? 0);
    },
  });

  const active = (today ?? []).filter((r) => r.status === "active");
  const total = active.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h2 className="text-xl font-semibold">Today</h2>
          <p className="text-sm text-muted-foreground">Your collections at a glance.</p>
        </div>
        <Button asChild size="lg" className="shadow-md">
          <Link to="/app/collector/new-receipt"><Plus className="h-5 w-5 mr-2" />New Receipt</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Today's receipts" value={active.length} icon={ReceiptIcon} accent="primary" />
        <KpiCard label="Today's cash" value={<Money value={total} />} icon={Wallet} accent="success" />
        <KpiCard label="Cash to submit" value={<Money value={expected ?? 0} />} icon={ClipboardCheck} accent="warning" hint="Since last verified submission" />
      </div>

      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">Today's receipts</CardTitle></CardHeader>
        <CardContent className="p-0">
          {(today ?? []).length === 0 && <div className="p-5 text-sm text-muted-foreground">No receipts yet today.</div>}
          <div className="divide-y">
            {(today ?? []).map((r) => {
              const c = r.customer as unknown as { full_name: string; customer_no: string } | null;
              return (
                <div key={r.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.receipt_no} · {formatDateTime(r.created_at)}</div>
                  </div>
                  <Money value={r.amount} tone={r.status === "cancelled" ? "muted" : "success"} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button asChild variant="outline" className="flex-1"><Link to="/app/collector/history">View history</Link></Button>
        <Button asChild variant="outline" className="flex-1"><Link to="/app/collector/submit-cash">Submit cash</Link></Button>
      </div>
    </div>
  );
}
