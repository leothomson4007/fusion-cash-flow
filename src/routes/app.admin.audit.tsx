import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/app/admin/audit")({
  component: AuditPage,
});

type Log = {
  id: string; actor_id: string | null; action: string; entity: string;
  entity_id: string | null; old_data: unknown; new_data: unknown; reason: string | null; created_at: string;
};

function AuditPage() {
  const { data } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(300);
      const ids = [...new Set((data ?? []).map((l) => l.actor_id).filter(Boolean))] as string[];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id,full_name").in("id", ids) : { data: [] };
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return ((data ?? []) as Log[]).map((l) => ({ ...l, actor: l.actor_id ? nameMap.get(l.actor_id) ?? "—" : "—" }));
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Audit log</h2>
        <p className="text-sm text-muted-foreground">Immutable record of every change.</p>
      </div>
      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">{data?.length ?? 0} entries</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {(data ?? []).map((l) => (
              <div key={l.id} className="px-5 py-3 text-sm space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{l.action}</Badge>
                  <Badge variant="secondary">{l.entity}</Badge>
                  <span className="text-muted-foreground">by <span className="text-foreground font-medium">{(l as { actor: string }).actor}</span></span>
                  <span className="text-muted-foreground ml-auto">{formatDateTime(l.created_at)}</span>
                </div>
                {l.reason && <div className="text-xs italic text-muted-foreground">Reason: {l.reason}</div>}
                {(l.old_data || l.new_data) && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-primary">View diff</summary>
                    <div className="grid gap-2 md:grid-cols-2 mt-2">
                      <pre className="overflow-auto rounded bg-muted p-2 text-[10px]">{JSON.stringify(l.old_data, null, 2)}</pre>
                      <pre className="overflow-auto rounded bg-muted p-2 text-[10px]">{JSON.stringify(l.new_data, null, 2)}</pre>
                    </div>
                  </details>
                )}
              </div>
            ))}
            {(data ?? []).length === 0 && <div className="p-5 text-sm text-muted-foreground">No audit events yet.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
