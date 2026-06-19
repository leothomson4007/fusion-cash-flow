import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

export type CustomerLite = {
  id: string;
  customer_no: string;
  full_name: string;
  phone: string | null;
  area: string | null;
  monthly_bill: number;
  balance: number;
};

export function CustomerSearch({
  onSelect, autoFocus,
}: { onSelect: (c: CustomerLite) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CustomerLite[]>([]);
  const [loading, setLoading] = useState(false);
  const term = q.trim();

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const query = supabase.from("customer_balances").select("*").eq("status", "active").limit(20);
      if (term.length > 0) {
        query.or(`full_name.ilike.%${term}%,customer_no.ilike.%${term}%,phone.ilike.%${term}%`);
      } else {
        query.order("full_name", { ascending: true });
      }
      const { data } = await query;
      if (cancelled) return;
      const mapped: CustomerLite[] = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.customer_id),
        customer_no: String(r.customer_no ?? ""),
        full_name: String(r.full_name ?? ""),
        phone: (r.phone as string | null) ?? null,
        area: (r.area as string | null) ?? null,
        monthly_bill: Number(r.monthly_bill ?? 0),
        balance: Number(r.balance ?? 0),
      }));
      setRows(mapped);
      setLoading(false);
    }, 180);
    return () => { cancelled = true; clearTimeout(t); };
  }, [term]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus={autoFocus}
          placeholder="Search by name, customer #, or phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 h-12 text-base"
        />
      </div>
      <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-card">
        {loading && rows.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">Searching…</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">No customers found.</div>
        )}
        {rows.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c)}
            className={cn(
              "w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-accent/40 active:bg-accent transition-colors",
              "flex items-center justify-between gap-3"
            )}
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{c.full_name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 truncate">
                <span>{c.customer_no}</span>
                {c.area && <span>· {c.area}</span>}
                {c.phone && <span>· {c.phone}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className={cn("text-sm font-semibold tabular-nums",
                Number(c.balance) > 0 ? "text-destructive" : "text-success")}>
                Rs. {Number(c.balance).toLocaleString("en-PK")}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
