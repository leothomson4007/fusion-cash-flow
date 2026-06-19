import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/collector/submit-cash")({
  component: SubmitCashPage,
});

function SubmitCashPage() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const [declared, setDeclared] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: expected } = useQuery({
    queryKey: ["expected-cash", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.rpc("collector_expected_cash", { _uid: uid! });
      return Number(data ?? 0);
    },
  });

  const { data: subs } = useQuery({
    queryKey: ["my-submissions", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("cash_submissions").select("*")
        .eq("collector_id", uid!).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!declared || Number(declared) <= 0) return toast.error("Enter declared amount");
    setSaving(true);
    const { error } = await supabase.rpc("submit_cash", {
      _declared: Number(declared), _notes: notes || null,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cash submission sent to admin");
    setDeclared(""); setNotes("");
    qc.invalidateQueries({ queryKey: ["expected-cash"] });
    qc.invalidateQueries({ queryKey: ["my-submissions"] });
  };

  return (
    <div className="space-y-5 max-w-md mx-auto">
      <div>
        <h2 className="text-xl font-semibold">Submit cash</h2>
        <p className="text-sm text-muted-foreground">Hand over cash collected since last verification.</p>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-5 space-y-4">
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
            <div className="text-xs uppercase tracking-wider text-primary">System expected</div>
            <Money value={expected ?? 0} className="text-3xl text-primary-deep" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Declared amount (Rs.)</Label>
            <Input type="number" inputMode="decimal" value={declared} onChange={(e) => setDeclared(e.target.value)} className="h-14 text-2xl text-center font-semibold" />
          </div>
          <div className="space-y-1.5"><Label>Notes (optional)</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <Button onClick={submit} disabled={saving} className="w-full h-12">
            {saving ? "Submitting…" : "Submit to admin"}
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">My recent submissions</CardTitle></CardHeader>
        <CardContent className="p-0">
          {(subs ?? []).length === 0 && <div className="p-5 text-sm text-muted-foreground">None yet.</div>}
          <div className="divide-y">
            {(subs ?? []).map((s) => {
              const diff = Number(s.difference ?? 0);
              return (
                <div key={s.id} className="px-5 py-3 text-sm space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs text-muted-foreground">{formatDateTime(s.created_at)}</div>
                      <div className="mt-1">Declared <Money value={s.declared_amount} /> · Expected <Money value={s.expected_amount} className="text-foreground" /></div>
                    </div>
                    {s.status === "verified" ? (
                      <Badge variant={diff === 0 ? "default" : "destructive"}>
                        {diff === 0 ? "Verified ✓" : diff < 0 ? `Short ${Math.abs(diff)}` : `Excess ${diff}`}
                      </Badge>
                    ) : <Badge variant="secondary">Pending</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
