import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Money } from "@/components/money";
import { formatDate, formatDateTime } from "@/lib/format";
import { Download, AlertCircle, CheckCircle2, MapPin, Wifi, Filter, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthStartStr() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

function ReportsPage() {
  const [fromDate, setFromDate] = useState(monthStartStr());
  const [toDate, setToDate] = useState(todayStr());
  const [areaFilter, setAreaFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [paidFilter, setPaidFilter] = useState<"all" | "unpaid" | "paid">("all");

  // All customers (active) with balance + service info
  const { data: allCustomers } = useQuery({
    queryKey: ["report-customers"],
    queryFn: async () => {
      const { data } = await supabase.from("customer_balances").select("*").eq("status", "active").order("full_name");
      return data ?? [];
    },
  });

  const areas = useMemo(() => {
    const s = new Set<string>();
    (allCustomers ?? []).forEach((c) => c.area && s.add(c.area));
    return [...s].sort();
  }, [allCustomers]);

  const filteredCustomers = useMemo(() => {
    return (allCustomers ?? []).filter((c) => {
      if (areaFilter !== "all" && c.area !== areaFilter) return false;
      if (serviceFilter !== "all" && c.service_type !== serviceFilter) return false;
      if (paidFilter === "unpaid" && Number(c.balance ?? 0) <= 0) return false;
      if (paidFilter === "paid" && Number(c.balance ?? 0) > 0) return false;
      return true;
    });
  }, [allCustomers, areaFilter, serviceFilter, paidFilter]);

  // Receipts in date range
  const { data: receipts } = useQuery({
    queryKey: ["report-receipts", fromDate, toDate],
    queryFn: async () => {
      const fromISO = new Date(fromDate + "T00:00:00").toISOString();
      const toISO = new Date(toDate + "T23:59:59.999").toISOString();
      const { data } = await supabase.from("receipts")
        .select("receipt_no,amount,payment_type,status,collector_id,created_at,customer:customers(customer_no,full_name,area,service_type)")
        .gte("created_at", fromISO).lte("created_at", toISO).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filteredReceipts = useMemo(() => {
    return (receipts ?? []).filter((r) => {
      const cust = r.customer as { area?: string | null; service_type?: string | null } | null;
      if (areaFilter !== "all" && cust?.area !== areaFilter) return false;
      if (serviceFilter !== "all" && cust?.service_type !== serviceFilter) return false;
      return true;
    });
  }, [receipts, areaFilter, serviceFilter]);

  const totalCollected = filteredReceipts.filter((r) => r.status === "active").reduce((s, r) => s + Number(r.amount), 0);
  const totalOutstanding = filteredCustomers.reduce((s, c) => s + Number(c.balance ?? 0), 0);
  const unpaidCount = filteredCustomers.filter((c) => Number(c.balance ?? 0) > 0).length;

  const { data: missing } = useQuery({
    queryKey: ["report-missing"],
    queryFn: async () => {
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

  const { data: collectors } = useQuery({
    queryKey: ["report-collectors", fromDate, toDate],
    queryFn: async () => {
      const fromISO = new Date(fromDate + "T00:00:00").toISOString();
      const toISO = new Date(toDate + "T23:59:59.999").toISOString();
      const { data: rs } = await supabase.from("receipts").select("amount,status,collector_id")
        .gte("created_at", fromISO).lte("created_at", toISO).eq("status", "active");
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

  const downloadCustomers = () => {
    downloadCSV(`customers-${todayStr()}.csv`, filteredCustomers.map((c) => ({
      customer_no: c.customer_no, name: c.full_name, phone: c.phone, area: c.area,
      service: c.service_type, package: c.package_name,
      monthly_bill: c.monthly_bill, balance: c.balance, status: c.status,
    })));
  };

  const downloadReceipts = () => {
    downloadCSV(`receipts-${fromDate}-to-${toDate}.csv`, filteredReceipts.map((r) => {
      const cust = r.customer as { customer_no?: string; full_name?: string; area?: string } | null;
      return {
        receipt_no: r.receipt_no, date: r.created_at, customer_no: cust?.customer_no,
        customer: cust?.full_name, area: cust?.area, amount: r.amount,
        payment_type: r.payment_type, status: r.status,
      };
    }));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Reports</h2>
          <p className="text-sm text-muted-foreground">{formatDate(new Date())}</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-card">
        <CardContent className="p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="pl-8 h-9 text-xs" />
            </div>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="pl-8 h-9 text-xs" />
            </div>
            <FilterSelect icon={<MapPin className="h-4 w-4" />} value={areaFilter} onChange={setAreaFilter}
              options={[{ value: "all", label: "All areas" }, ...areas.map((a) => ({ value: a, label: a }))]} />
            <FilterSelect icon={<Wifi className="h-4 w-4" />} value={serviceFilter} onChange={setServiceFilter}
              options={[
                { value: "all", label: "All services" },
                { value: "internet", label: "Internet" },
                { value: "tv", label: "TV" },
                { value: "internet_tv", label: "Internet + TV" },
              ]} />
          </div>
          <div className="flex items-center gap-2">
            <FilterSelect icon={<Filter className="h-4 w-4" />} value={paidFilter} onChange={(v) => setPaidFilter(v as typeof paidFilter)}
              options={[
                { value: "all", label: "All customers" },
                { value: "unpaid", label: "Unpaid only" },
                { value: "paid", label: "Paid up" },
              ]} />
            <div className="text-xs text-muted-foreground ml-auto">{filteredCustomers.length} customers · {filteredReceipts.length} receipts</div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi label="Collected (range)" value={<Money value={totalCollected} className="text-xl" tone="success" />} />
        <Kpi label="Outstanding" value={<Money value={totalOutstanding} className="text-xl" tone="destructive" />} />
        <Kpi label="Unpaid customers" value={<span className="text-xl font-semibold">{unpaidCount}</span>} />
      </div>

      {/* Customers report */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-row justify-between items-start space-y-0">
          <div>
            <CardTitle className="text-base">Customers</CardTitle>
            <CardDescription>{filteredCustomers.length} matching filters</CardDescription>
          </div>
          <Button size="icon" variant="outline" onClick={downloadCustomers} aria-label="Download customers CSV" title="Download CSV">
            <Download className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0 max-h-72 overflow-auto">
          {filteredCustomers.length === 0 && <div className="p-4 text-sm text-muted-foreground">No customers match.</div>}
          {filteredCustomers.map((c) => (
            <div key={c.customer_id ?? ""} className="flex justify-between items-center px-5 py-2 border-t text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{c.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">{c.customer_no} · {c.area ?? "—"}</div>
              </div>
              <Money value={c.balance ?? 0} tone={Number(c.balance ?? 0) > 0 ? "destructive" : "success"} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Receipts report */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-row justify-between items-start space-y-0">
          <div>
            <CardTitle className="text-base">Receipts</CardTitle>
            <CardDescription><Money value={totalCollected} /> across {filteredReceipts.length} receipts</CardDescription>
          </div>
          <Button size="icon" variant="outline" onClick={downloadReceipts} aria-label="Download receipts CSV" title="Download CSV">
            <Download className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0 max-h-72 overflow-auto">
          {filteredReceipts.length === 0 && <div className="p-4 text-sm text-muted-foreground">No receipts in range.</div>}
          {filteredReceipts.map((r) => {
            const cust = r.customer as { full_name?: string; area?: string } | null;
            return (
              <div key={r.receipt_no} className="flex justify-between px-5 py-2 border-t text-sm">
                <div className="min-w-0">
                  <div className="font-mono text-xs">{r.receipt_no}</div>
                  <div className="text-xs text-muted-foreground truncate">{cust?.full_name} · {cust?.area ?? "—"}</div>
                </div>
                <Money value={r.amount} tone={r.status === "cancelled" ? "muted" : "default"} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Collector performance */}
      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">Collector performance — selected range</CardTitle></CardHeader>
        <CardContent className="p-0">
          {(collectors ?? []).map((c, i) => (
            <div key={c.name + i} className="flex justify-between px-5 py-2 border-t text-sm">
              <div>{c.name}</div>
              <div className="flex gap-4">
                <span className="text-muted-foreground text-xs">{c.count} receipts</span>
                <Money value={c.amount} />
              </div>
            </div>
          ))}
          {(collectors ?? []).length === 0 && <div className="p-4 text-sm text-muted-foreground">No collections in range.</div>}
        </CardContent>
      </Card>

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

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  icon, value, onChange, options,
}: {
  icon: React.ReactNode; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const active = value !== "all";
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-9 gap-1.5 text-xs ${active ? "border-primary text-primary" : ""}`}>
        {icon}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
