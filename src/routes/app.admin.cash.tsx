import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/money";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/cash")({
  component: CashPage,
});

type Sub = {
  id: string; collector_id: string; expected_amount: number; declared_amount: number;
  received_amount: number | null; difference: number | null; status: string;
  notes: string | null; created_at: string; verified_at: string | null;
  collector_name?: string;
};

function CashPage() {
  const qc = useQueryClient();
  const [verifying, setVerifying] = useState<Sub | null>(null);

  const { data } = useQuery({
    queryKey: ["cash-subs"],
    queryFn: async () => {
      const { data } = await supabase.from("cash_submissions").select("*")
        .order("created_at", { ascending: false }).limit(100);
      const ids = [...new Set((data ?? []).map((s) => s.collector_id))];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id,full_name").in("id", ids)
        : { data: [] };
      const map = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return ((data ?? []) as Sub[]).map((s) => ({ ...s, collector_name: map.get(s.collector_id) ?? "Unknown" }));
    },
  });

  const pending = (data ?? []).filter((s) => s.status === "pending");
  const verified = (data ?? []).filter((s) => s.status === "verified");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Cash verification</h2>
        <p className="text-sm text-muted-foreground">Verify cash handed over by recovery staff.</p>
      </div>

      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">Pending submissions ({pending.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {pending.length === 0 && <div className="p-5 text-sm text-muted-foreground">No pending submissions.</div>}
          <div className="divide-y">
            {pending.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <div className="font-medium">{s.collector_name}</div>
                  <div className="text-xs text-muted-foreground">Submitted {formatDateTime(s.created_at)}</div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div><div className="text-[10px] uppercase text-muted-foreground">Expected</div><Money value={s.expected_amount} /></div>
                  <div><div className="text-[10px] uppercase text-muted-foreground">Declared</div><Money value={s.declared_amount} /></div>
                </div>
                <Button onClick={() => setVerifying(s)}><CheckCircle2 className="h-4 w-4 mr-2" />Verify</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">Recent verifications</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {verified.length === 0 && <div className="p-5 text-sm text-muted-foreground">Nothing yet.</div>}
            {verified.map((s) => {
              const diff = Number(s.difference ?? 0);
              const tone = diff === 0 ? "success" : diff < 0 ? "destructive" : "warning";
              return (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <div className="font-medium">{s.collector_name}</div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(s.verified_at)}</div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div><span className="text-[10px] uppercase text-muted-foreground mr-1">Expected</span><Money value={s.expected_amount} /></div>
                    <div><span className="text-[10px] uppercase text-muted-foreground mr-1">Received</span><Money value={s.received_amount ?? 0} /></div>
                    <Badge variant={tone === "success" ? "default" : "destructive"}>
                      {diff === 0 ? "Match" : diff < 0 ? `Shortage ${Math.abs(diff)}` : `Excess ${diff}`}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {verifying && <VerifyDialog sub={verifying} onDone={() => { setVerifying(null); qc.invalidateQueries({ queryKey: ["cash-subs"] }); }} />}
    </div>
  );
}

function VerifyDialog({ sub, onDone }: { sub: Sub; onDone: () => void }) {
  const [received, setReceived] = useState(String(sub.declared_amount));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const diff = Number(received || 0) - Number(sub.expected_amount);

  const submit = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("verify_cash", {
      _id: sub.id, _received: Number(received), _notes: notes || null,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Verified");
    onDone();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onDone()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Verify cash from {sub.collector_name}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expected"><Money value={sub.expected_amount} /></Field>
            <Field label="Declared"><Money value={sub.declared_amount} /></Field>
          </div>
          <div className="space-y-1.5"><Label>Received amount (Rs.)</Label>
            <Input type="number" value={received} onChange={(e) => setReceived(e.target.value)} /></div>
          <div className={`rounded-md p-3 ${diff === 0 ? "bg-success/10 text-success" : diff < 0 ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-warning-foreground"}`}>
            {diff === 0 ? "Match ✓" : diff < 0 ? `Shortage of Rs. ${Math.abs(diff).toLocaleString()}` : `Excess of Rs. ${diff.toLocaleString()}`}
          </div>
          <div className="space-y-1.5"><Label>Notes (optional)</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onDone}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "…" : "Confirm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="font-medium">{children}</div></div>;
}
