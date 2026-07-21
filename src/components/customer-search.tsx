import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Search, MapPin, Phone, Package, SlidersHorizontal, X } from "lucide-react";

export type CustomerLite = {
  id: string;
  customer_no: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  area: string | null;
  service_type: string | null;
  package_name: string | null;
  monthly_bill: number;
  balance: number;
};

type SortKey = "name" | "balance_desc" | "balance_asc" | "recent";
type PayFilter = "all" | "unpaid" | "paid";

export function CustomerSearch({
  onSelect, autoFocus, dense,
}: { onSelect: (c: CustomerLite) => void; autoFocus?: boolean; dense?: boolean }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CustomerLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [area, setArea] = useState<string>("all");
  const [service, setService] = useState<string>("all");
  const [pay, setPay] = useState<PayFilter>("all");
  const [sort, setSort] = useState<SortKey>("name");

  const term = q.trim();

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      let query = supabase
        .from("customer_balances")
        .select("*")
        .eq("status", "active")
        .limit(100);
      if (term.length > 0) {
        const like = `%${term.replace(/[%,]/g, " ")}%`;
        query = query.or(
          [
            `full_name.ilike.${like}`,
            `customer_no.ilike.${like}`,
            `phone.ilike.${like}`,
            `address.ilike.${like}`,
            `area.ilike.${like}`,
            `package_name.ilike.${like}`,
            `service_type.ilike.${like}`,
          ].join(","),
        );
      }
      if (area !== "all") query = query.eq("area", area);
      if (service !== "all") query = query.eq("service_type", service);

      if (sort === "name") query = query.order("full_name", { ascending: true });
      else if (sort === "balance_desc") query = query.order("balance", { ascending: false });
      else if (sort === "balance_asc") query = query.order("balance", { ascending: true });
      else query = query.order("customer_no", { ascending: false });

      const { data } = await query;
      if (cancelled) return;
      let mapped: CustomerLite[] = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.customer_id),
        customer_no: String(r.customer_no ?? ""),
        full_name: String(r.full_name ?? ""),
        phone: (r.phone as string | null) ?? null,
        address: (r.address as string | null) ?? null,
        area: (r.area as string | null) ?? null,
        service_type: (r.service_type as string | null) ?? null,
        package_name: (r.package_name as string | null) ?? null,
        monthly_bill: Number(r.monthly_bill ?? 0),
        balance: Number(r.balance ?? 0),
      }));
      if (pay === "unpaid") mapped = mapped.filter((c) => c.balance > 0);
      else if (pay === "paid") mapped = mapped.filter((c) => c.balance <= 0);
      setRows(mapped);
      setLoading(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, area, service, pay, sort]);

  // Load distinct areas / service types once for filter dropdowns
  const [areas, setAreas] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("customer_balances")
        .select("area, service_type")
        .eq("status", "active")
        .limit(1000);
      const a = new Set<string>();
      const s = new Set<string>();
      (data ?? []).forEach((r: Record<string, unknown>) => {
        if (r.area) a.add(String(r.area));
        if (r.service_type) s.add(String(r.service_type));
      });
      setAreas(Array.from(a).sort());
      setServices(Array.from(s).sort());
    })();
  }, []);

  const activeFilterCount = useMemo(
    () => (area !== "all" ? 1 : 0) + (service !== "all" ? 1 : 0) + (pay !== "all" ? 1 : 0),
    [area, service, pay],
  );

  const clearFilters = () => {
    setArea("all"); setService("all"); setPay("all"); setSort("name");
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus={autoFocus}
          placeholder="Search name, #, phone, address, area, package…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 pr-9 h-12 text-base"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-accent text-muted-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={showFilters ? "default" : "outline"}
          onClick={() => setShowFilters((v) => !v)}
          className="h-9"
        >
          <SlidersHorizontal className="h-4 w-4 mr-1.5" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{activeFilterCount}</Badge>
          )}
        </Button>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="balance_desc">Highest balance</SelectItem>
            <SelectItem value="balance_asc">Lowest balance</SelectItem>
            <SelectItem value="recent">Newest first</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">
          {loading ? "Searching…" : `${rows.length} result${rows.length === 1 ? "" : "s"}`}
        </div>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3">
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Area" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All areas</SelectItem>
              {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={service} onValueChange={setService}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Service type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {services.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={pay} onValueChange={(v) => setPay(v as PayFilter)}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Payment status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              <SelectItem value="unpaid">Unpaid (balance &gt; 0)</SelectItem>
              <SelectItem value="paid">Paid up</SelectItem>
            </SelectContent>
          </Select>
          {activeFilterCount > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="sm:col-span-3 justify-self-start">
              Clear all filters
            </Button>
          )}
        </div>
      )}

      <div className={cn("overflow-y-auto rounded-lg border bg-card", dense ? "max-h-[50vh]" : "max-h-[65vh]")}>
        {loading && rows.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">Searching…</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No customers match your search.
          </div>
        )}
        {rows.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c)}
            className={cn(
              "w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-accent/40 active:bg-accent transition-colors",
              "flex items-start justify-between gap-3",
            )}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold truncate">{c.full_name}</span>
                <span className="text-xs font-mono text-muted-foreground">{c.customer_no}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {c.area && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{c.area}
                  </span>
                )}
                {c.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" />{c.phone}
                  </span>
                )}
                {c.package_name && (
                  <span className="inline-flex items-center gap-1">
                    <Package className="h-3 w-3" />{c.package_name}
                  </span>
                )}
              </div>
              {c.address && (
                <div className="text-xs text-muted-foreground truncate">{c.address}</div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</div>
              <div className={cn("text-sm font-bold tabular-nums",
                Number(c.balance) > 0 ? "text-destructive" : "text-success")}>
                Rs. {Number(c.balance).toLocaleString("en-PK")}
              </div>
              <div className="text-[10px] text-muted-foreground">Bill Rs. {Number(c.monthly_bill).toLocaleString("en-PK")}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
