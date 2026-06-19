import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/money";
import { ReceiptCard } from "@/components/receipt-card";
import { CustomerSearch } from "@/components/customer-search";
import { formatDateTime } from "@/lib/format";
import { Plus, Edit, Ban, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/receipts")({
  component: ReceiptsPage,
});

type ReceiptRow = {
  id: string; receipt_no: string; amount: number; payment_type: string;
  status: string; created_at: string; cancelled_reason: string | null; note: string | null;
  collector_id: string | null;
  customer: { customer_no: string; full_name: string; phone: string | null } | null;
};

function ReceiptsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<"all" | "active" | "cancelled">("all");
  const [viewing, setViewing] = useState<ReceiptRow | null>(null);
  const [editing, setEditing] = useState<ReceiptRow | null>(null);
  const [cancelling, setCancelling] = useState<ReceiptRow | null>(null);

  const { data } = useQuery({
    queryKey: ["admin-receipts", statusF, search],
    queryFn: async () => {
      const q = supabase.from("receipts")
        .select("id,receipt_no,amount,payment_type,status,created_at,cancelled_reason,note,collector_id,customer:customers(customer_no,full_name,phone)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusF !== "all") q.eq("status", statusF);
      if (search.trim()) q.ilike("receipt_no", `%${search.trim()}%`);
      const { data } = await q;
      return (data ?? []) as unknown as ReceiptRow[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-receipts"] });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Receipts</h2>
          <p className="text-sm text-muted-foreground">Strict sequential numbering — no gaps allowed.</p>
        </div>
        <NewReceiptDialog onCreated={invalidate}>
          <Button><Plus className="h-4 w-4 mr-2" />Create receipt</Button>
        </NewReceiptDialog>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-3 flex flex-wrap gap-2">
          <Input placeholder="Search by receipt # (e.g. FN-2026-000001)" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[200px]" />
          <Select value={statusF} onValueChange={(v) => setStatusF(v as typeof statusF)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Receipt</th>
                <th className="text-left px-4 py-2">Customer</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">Type</th>
                <th className="text-right px-4 py-2">Amount</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    <div>{r.receipt_no}</div>
                    <div className="text-muted-foreground">{formatDateTime(r.created_at)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.customer?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.customer?.customer_no}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell uppercase text-xs">{r.payment_type}</td>
                  <td className="px-4 py-3 text-right"><Money value={r.amount} tone={r.status === "cancelled" ? "muted" : "default"} /></td>
                  <td className="px-4 py-3">
                    <Badge variant={r.status === "cancelled" ? "destructive" : "default"}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(r)}><Eye className="h-4 w-4" /></Button>
                      {r.status === "active" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(r)}><Edit className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setCancelling(r)}><Ban className="h-4 w-4 text-destructive" /></Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No receipts.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-md p-0 bg-transparent border-0 shadow-none">
          {viewing && <ReceiptCard receipt={{
            ...viewing,
            customer: viewing.customer,
          }} />}
        </DialogContent>
      </Dialog>

      {editing && <EditReceiptDialog receipt={editing} onDone={() => { setEditing(null); invalidate(); }} />}
      {cancelling && <CancelReceiptDialog receipt={cancelling} onDone={() => { setCancelling(null); invalidate(); }} />}
    </div>
  );
}

function EditReceiptDialog({ receipt, onDone }: { receipt: ReceiptRow; onDone: () => void }) {
  const [amount, setAmount] = useState(String(receipt.amount));
  const [ptype, setPtype] = useState(receipt.payment_type);
  const [note, setNote] = useState(receipt.note ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!reason.trim()) return toast.error("Reason is required for audit");
    setSaving(true);
    const { error } = await supabase.rpc("admin_update_receipt", {
      _id: receipt.id, _amount: Number(amount), _payment_type: ptype as never,
      _note: note || null, _reason: reason,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Receipt updated");
    onDone();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onDone()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit {receipt.receipt_no}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Payment type</Label>
            <Select value={ptype} onValueChange={setPtype}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank Transfer</SelectItem>
                <SelectItem value="easypaisa">Easypaisa</SelectItem>
                <SelectItem value="jazzcash">JazzCash</SelectItem>
              </SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Reason for edit *</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this edit?" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onDone}>Close</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save edit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelReceiptDialog({ receipt, onDone }: { receipt: ReceiptRow; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!reason.trim()) return toast.error("Reason is required");
    setSaving(true);
    const { error } = await supabase.rpc("admin_cancel_receipt", { _id: receipt.id, _reason: reason });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Receipt cancelled");
    onDone();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onDone()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cancel {receipt.receipt_no}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Cancellation is permanent and audit-logged. Receipt number stays in the sequence.</p>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for cancellation" />
        <DialogFooter>
          <Button variant="ghost" onClick={onDone}>Back</Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>{saving ? "…" : "Confirm cancel"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewReceiptDialog({ children, onCreated }: { children: React.ReactNode; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [ptype, setPtype] = useState("cash");
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<ReceiptRow | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCustomerId(null); setCustomerName(""); setAmount(""); setPtype("cash"); setNote(""); setCreated(null);
  };

  const submit = async () => {
    if (!customerId) return toast.error("Pick a customer");
    if (!Number(amount) || Number(amount) <= 0) return toast.error("Enter amount");
    setSaving(true);
    const { data, error } = await supabase.rpc("create_receipt", {
      _customer_id: customerId, _amount: Number(amount), _payment_type: ptype as never, _note: note || null,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    const row = data as unknown as ReceiptRow;
    // attach customer info for card
    const { data: c } = await supabase.from("customers").select("customer_no,full_name,phone").eq("id", customerId).single();
    setCreated({ ...row, customer: c as ReceiptRow["customer"] });
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        {!created ? (
          <>
            <DialogHeader><DialogTitle>Create receipt</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {!customerId ? (
                <CustomerSearch autoFocus onSelect={(c) => { setCustomerId(c.id); setCustomerName(`${c.full_name} (${c.customer_no})`); }} />
              ) : (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm">{customerName}</span>
                  <Button size="sm" variant="ghost" onClick={() => setCustomerId(null)}>Change</Button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Amount (Rs.)</Label>
                  <Input type="number" inputMode="decimal" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 text-lg" /></div>
                <div className="space-y-1.5"><Label>Payment type</Label>
                  <Select value={ptype} onValueChange={setPtype}>
                    <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="easypaisa">Easypaisa</SelectItem>
                      <SelectItem value="jazzcash">JazzCash</SelectItem>
                    </SelectContent>
                  </Select></div>
              </div>
              <div className="space-y-1.5"><Label>Note (optional)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={saving || !customerId}>{saving ? "Creating…" : "Create receipt"}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader><DialogTitle>Receipt created</DialogTitle></DialogHeader>
            <ReceiptCard receipt={created} />
            <DialogFooter>
              <Button variant="ghost" onClick={reset}>Create another</Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
