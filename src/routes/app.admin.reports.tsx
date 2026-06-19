import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/money";
import { formatDate, formatDateTime, todayRangeISO } from "@/lib/format";
import { Download, AlertCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/app/admin/reports")({
  component: ReportsPage,
});

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  // Daily cash today
  const { data: daily } = useQuery({
    queryKey: ["report-daily-cash"],
    queryFn: async () => {
      const { from, to } = todayRangeISO();
      const { data } = await supabase.from("receipts")
        .select("receipt_no,amount,payment_type,status,collector_id,created_at,customer:customers(customer_no,full_name)")
        .gte("created_at", from).lt("created_at", to);
      return data ?? [];
    },
  });

  const { data: unpaid } = useQuery({
    queryKey: ["report-unpaid"],
    queryFn: async () => {
      const { data } = await supabase.from("customer_balances")
        .select("*").eq("status", "active").gt("balance", 0).order("balance", { ascending: false });
      return data ?? [];
    },
  });

  const { data: missing } = useQuery({
    queryKey: ["report-missing"],
    queryFn: async () => {
      // Group by year, find gaps in seq
      const { data: rs } = await supabase.from("receipts").select("year,seq,receipt_no").order("year").order("seq");
      const byYear = new Map<number, Set<number>>();
      (rs ?? []).forEach((r) => {
        const set = byYear.get(r.year) ?? new Set();
        set.add(Number(r.seq));
        byYear.set(r.year, set);
      });
      const gaps: { year: number; seq: number; expected_no: string }[] = [];
      for (const [year, set] of byYear) {
        const max = Math.max(...set);
        for (let i = 1; i <= max; i++) {
          if (!set.has(i)) gaps.push({ year, seq: i, expected_no: `FN-${year}-${String(i).padStart(6, "0")}` });
        }
      }
      return gaps;
    },
  });

  const { data: monthly } = useQuery({
    queryKey: ["report-monthly"],
    queryFn: async () => {
      const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
      const { data } = await supabase.from("receipts").select("amount,status,created_at,payment_type")
        .gte("created_at", start.toISOString()).eq("status", "active");
      const total = (data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const byType: Record<string, number> = {};
      (data ?? []).forEach((r) => { byType[r.payment_type] = (byType[r.payment_type] ?? 0) + Number(r.amount); });
      return { total, count: (data ?? []).length, byType };
    },
  });

  const { data: collectors } = useQuery({
    queryKey: ["report-collectors"],
    queryFn: async () => {
      const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
      const { data: rs } = await supabase.from("receipts").select("amount,status,collector_id")
        .gte("created_at", start.toISOString()).eq("status", "active");
      const map = new Map<string, { amount: number; count: number }>();
      (rs ?? []).forEach((r) => {
        if (!r.collector_id) return;
        const cur = map.get(r.collector_id) ?? { amount: 0, count: 0 };
        cur.amount += Number(r.amount); cur.count += 1;
        map.set(r.collector_id, cur);
      });
      const ids = [...map.keys()];
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return [...map.entries()].map(([id, v]) => ({ name: nameMap.get(id) ?? "Unknown", ...v })).sort((a, b) => b.amount - a.amount);
    },
  });

  const dailyTotal = (daily ?? []).filter((r) => r.status === "active").reduce((s, r) => s + Number(r.amount), 0);
  const unpaidTotal = (unpaid ?? []).reduce((s, r) => s + Number(r.balance ?? 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Reports</h2>
        <p className="text-sm text-muted-foreground">{formatDate(new Date())}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row justify-between items-start">
            <div><CardTitle className="text-base">Daily cash — today</CardTitle>
              <CardDescription><Money value={dailyTotal} /> across {(daily ?? []).length} receipts</CardDescription></div>
            <Button size="sm" variant="outline" onClick={() => downloadCSV("daily-cash.csv", (daily ?? []).map((r) => ({
              receipt_no: r.receipt_no, customer: (r.customer as { full_name: string } | null)?.full_name,
              amount: r.amount, type: r.payment_type, status: r.status, time: r.created_at
            })))}><Download className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent className="p-0 max-h-72 overflow-auto">
            {(daily ?? []).map((r) => (
              <div key={r.receipt_no} className="flex justify-between px-5 py-2 border-t text-sm">
                <div>
                  <div className="font-mono text-xs">{r.receipt_no}</div>
                  <div className="text-xs text-muted-foreground">{(r.customer as { full_name: string } | null)?.full_name}</div>
                </div>
                <Money value={r.amount} tone={r.status === "cancelled" ? "muted" : "default"} />
              </div>
            ))}
            {(daily ?? []).length === 0 && <div className="p-4 text-sm text-muted-foreground">Nothing today.</div>}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row justify-between items-start">
            <div><CardTitle className="text-base">Unpaid customers</CardTitle>
              <CardDescription><Money value={unpaidTotal} /> outstanding across {(unpaid ?? []).length} customers</CardDescription></div>
            <Button size="sm" variant="outline" onClick={() => downloadCSV("unpaid.csv", (unpaid ?? []) as Record<string, unknown>[])}><Download className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent className="p-0 max-h-72 overflow-auto">
            {(unpaid ?? []).map((u) => (
              <div key={u.customer_id ?? ""} className="flex justify-between px-5 py-2 border-t text-sm">
                <div>
                  <div className="font-medium">{u.full_name}</div>
                  <div className="text-xs text-muted-foreground">{u.customer_no} · {u.area ?? "—"}</div>
                </div>
                <Money value={u.balance ?? 0} tone="destructive" />
              </div>
            ))}
            {(unpaid ?? []).length === 0 && <div className="p-4 text-sm text-muted-foreground">All paid up.</div>}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Monthly revenue — this month</CardTitle>
            <CardDescription>{monthly?.count ?? 0} receipts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight"><Money value={monthly?.total ?? 0} className="text-3xl" /></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {Object.entries(monthly?.byType ?? {}).map(([k, v]) => (
                <div key={k} className="flex justify-between rounded bg-muted px-3 py-2">
                  <span className="uppercase text-xs">{k}</span>
                  <Money value={v} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Collector performance — this month</CardTitle></CardHeader>
          <CardContent className="p-0">
            {(collectors ?? []).map((c, i) => (
              <div key={c.name + i} className="flex justify-between px-5 py-2 border-t text-sm">
                <div>{c.name}</div>
                <div className="flex gap-4">
                  <span className="text-muted-foreground">{c.count} receipts</span>
                  <Money value={c.amount} />
                </div>
              </div>
            ))}
            {(collectors ?? []).length === 0 && <div className="p-4 text-sm text-muted-foreground">No collections this month.</div>}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row justify-between items-start">
          <div className="flex items-start gap-2">
            {(missing ?? []).length === 0
              ? <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
              : <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />}
            <div>
              <CardTitle className="text-base">Missing receipt detector</CardTitle>
              <CardDescription>
                {(missing ?? []).length === 0
                  ? "No gaps. Sequence is intact."
                  : `${(missing ?? []).length} missing receipt number${missing!.length > 1 ? "s" : ""} detected.`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        {(missing ?? []).length > 0 && (
          <CardContent className="p-0 max-h-60 overflow-auto">
            {missing!.map((m, i) => (
              <div key={i} className="px-5 py-2 border-t font-mono text-xs text-destructive">{m.expected_no}</div>
            ))}
          </CardContent>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">Last refreshed {formatDateTime(new Date())}</p>
    </div>
  );
}
