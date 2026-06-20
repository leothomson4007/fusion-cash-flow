import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerSearch, type CustomerLite } from "@/components/customer-search";
import { ReceiptCard, type ReceiptForCard } from "@/components/receipt-card";
import { Money } from "@/components/money";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/app/collector/new-receipt")({
  component: NewReceiptPage,
});

function NewReceiptPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<ReceiptForCard | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!customer) return;
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("Enter amount");
    setSaving(true);
    const { data, error } = await supabase.rpc("create_receipt", {
      _customer_id: customer.id, _amount: n, _payment_type: "cash", _note: note || null,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    const row = data as unknown as ReceiptForCard;
    setCreated({ ...row, customer: { customer_no: customer.customer_no, full_name: customer.full_name, phone: customer.phone } });
    qc.invalidateQueries();
    toast.success("Receipt created");
  };

  if (created) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center text-success flex items-center justify-center gap-2 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4" /> Receipt locked & saved
        </div>
        <ReceiptCard receipt={created} />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => { setCreated(null); setCustomer(null); setAmount(""); setNote(""); }}>
            Another
          </Button>
          <Button onClick={() => navigate({ to: "/app/collector/dashboard" })}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      {!customer ? (
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Pick a customer</CardTitle></CardHeader>
          <CardContent><CustomerSearch autoFocus onSelect={setCustomer} /></CardContent>
        </Card>
      ) : (
        <>
          <Button variant="ghost" size="sm" onClick={() => setCustomer(null)}><ArrowLeft className="h-4 w-4 mr-1" />Change customer</Button>
          <Card className="shadow-card">
            <CardContent className="p-5 space-y-3">
              <div>
                <div className="text-lg font-semibold">{customer.full_name}</div>
                <div className="text-xs text-muted-foreground">{customer.customer_no} · {customer.area ?? "—"}</div>
              </div>
              <div className="flex justify-between rounded-md bg-muted p-3 text-sm">
                <span className="text-muted-foreground">Current balance</span>
                <Money value={customer.balance} tone={Number(customer.balance) > 0 ? "destructive" : "success"} />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-5 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Amount received (Rs.)</Label>
                <Input type="number" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} className="h-16 text-3xl text-center font-semibold" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[500, 1000, 1500, 2000, 2500, 3000].map((v) => (
                  <Button key={v} type="button" variant="outline" onClick={() => setAmount(String(v))}>{v}</Button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label>Note (optional)</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <Button onClick={submit} disabled={saving} className="w-full h-12 text-base">
                {saving ? "Creating…" : "Create cash receipt"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                The receipt is sequential and locked the moment it's created.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
