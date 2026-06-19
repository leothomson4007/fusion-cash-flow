import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/app/collector/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = useAuth();
  const uid = user?.id;

  const { data } = useQuery({
    queryKey: ["collector-history", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("receipts")
        .select("id,receipt_no,amount,status,created_at,cancelled_reason,customer:customers(full_name,customer_no)")
        .eq("collector_id", uid!).order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  const total = (data ?? []).filter((r) => r.status === "active").reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">My history</h2>
          <p className="text-sm text-muted-foreground">{(data ?? []).length} receipts · <Money value={total} /> total active</p>
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          {(data ?? []).length === 0 && <div className="p-5 text-sm text-muted-foreground">No receipts.</div>}
          <div className="divide-y">
            {(data ?? []).map((r) => {
              const c = r.customer as unknown as { full_name: string; customer_no: string } | null;
              return (
                <div key={r.id} className="px-5 py-3">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="font-medium">{c?.full_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{r.receipt_no}</div>
                      <div className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</div>
                    </div>
                    <div className="text-right">
                      <Money value={r.amount} tone={r.status === "cancelled" ? "muted" : "success"} />
                      {r.status === "cancelled" && <div className="mt-1"><Badge variant="destructive">Cancelled</Badge></div>}
                    </div>
                  </div>
                  {r.cancelled_reason && <div className="text-xs italic text-muted-foreground mt-1">Reason: {r.cancelled_reason}</div>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
