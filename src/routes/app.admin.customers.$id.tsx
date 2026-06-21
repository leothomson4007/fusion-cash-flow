import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CustomerDialog } from "./app.admin.customers";
import { formatDateTime } from "@/lib/format";
import { ArrowLeft, Edit, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/customers/$id")({
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [delOpen, setDelOpen] = useState(false);
  const [delReason, setDelReason] = useState("");

  const { data: customer, refetch } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const [{ data: c }, { data: b }] = await Promise.all([
        supabase.from("customers").select("*").eq("id", id).single(),
        supabase.from("customer_balances").select("*").eq("customer_id", id).maybeSingle(),
      ]);
      return { customer: c, balance: b };
    },
  });

  const { data: receipts } = useQuery({
    queryKey: ["customer-receipts", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("receipts").select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (!customer?.customer) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const c = customer.customer;
  const b = customer.balance;
  const isDeleted = c.status === "deleted";

  const doDelete = async () => {
    if (!delReason.trim()) return toast.error("Reason required");
    const { error } = await supabase.rpc("admin_delete_customer", { _id: id, _reason: delReason } as never);
    if (error) return toast.error(error.message);
    toast.success("Customer deleted");
    setDelOpen(false);
    qc.invalidateQueries();
    navigate({ to: "/app/admin/customers" });
  };
  const doRestore = async () => {
    const { error } = await supabase.rpc("admin_restore_customer", { _id: id } as never);
    if (error) return toast.error(error.message);
    toast.success("Customer restored");
    qc.invalidateQueries();
    refetch();
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/app/admin/customers"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link></Button>
        {isDeleted ? (
          <Button variant="outline" size="sm" onClick={doRestore}><RotateCcw className="h-4 w-4 mr-1" />Restore</Button>
        ) : (
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDelOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" />Delete
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2 shadow-card">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground">{c.customer_no}</div>
              <CardTitle className="text-2xl">{c.full_name}</CardTitle>
              <div className="text-sm text-muted-foreground mt-1">{c.area ?? "—"} {c.phone && `· ${c.phone}`}</div>
            </div>
            <CustomerDialog existing={{
              id: c.id, full_name: c.full_name, phone: c.phone, address: c.address, area: c.area,
              monthly_bill: Number(c.monthly_bill), billing_day: c.billing_day,
              status: (c.status === "deleted" ? "inactive" : c.status) as "active" | "inactive",
              opening_balance: Number(c.opening_balance), notes: c.notes,
              service_type: c.service_type, package_name: c.package_name,
            }} onSaved={() => refetch()}>
              <Button variant="outline" size="sm"><Edit className="h-4 w-4 mr-1" />Edit</Button>
            </CustomerDialog>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Address" value={c.address ?? "—"} />
            <Field label="Status"><Badge variant={isDeleted ? "destructive" : "default"}>{c.status}</Badge></Field>
            <Field label="Service" value={serviceLabel(c.service_type)} />
            <Field label="Package" value={c.package_name ?? "—"} />
            <Field label="Speed" value={c.internet_speed ?? "—"} />
            <Field label="Monthly bill"><Money value={c.monthly_bill} /></Field>
            <Field label="Billing day" value={`${c.billing_day} of month`} />
            <Field label="Opening balance"><Money value={c.opening_balance} /></Field>
            <Field label="Customer since" value={formatDateTime(c.created_at)} />
            {c.notes && <div className="col-span-2"><Field label="Notes" value={c.notes} /></div>}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Balance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted p-4">
              <div className="text-xs uppercase text-muted-foreground">Outstanding</div>
              <Money value={b?.balance ?? 0} tone={Number(b?.balance ?? 0) > 0 ? "destructive" : "success"} className="text-2xl" />
            </div>
            <div className="text-sm space-y-1.5">
              <Row label="Bills accrued"><Money value={b?.bills_accrued ?? 0} /></Row>
              <Row label="Opening balance"><Money value={b?.opening_balance ?? 0} /></Row>
              <Row label="Total paid"><Money value={b?.total_paid ?? 0} tone="success" /></Row>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">Payment history</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {(receipts ?? []).length === 0 && <div className="p-6 text-sm text-muted-foreground">No payments yet.</div>}
            {(receipts ?? []).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <div className="font-mono text-sm">{r.receipt_no}</div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(r.created_at)} · {r.payment_type}</div>
                  {r.status === "cancelled" && <Badge variant="destructive" className="mt-1">Cancelled</Badge>}
                </div>
                <Money value={r.amount} tone={r.status === "cancelled" ? "muted" : "success"} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete customer?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            The customer will be hidden from active lists. Their receipts, reports, and audit log remain intact and can be restored later.
          </p>
          <Input value={delReason} onChange={(e) => setDelReason(e.target.value)} placeholder="Reason for deletion" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDelOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={doDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function serviceLabel(s: string | null | undefined): string {
  if (!s) return "—";
  if (s === "internet_tv") return "Internet + TV";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Field({ label, value, children }: { label: string; value?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{children ?? value}</div>
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span>{children}</div>;
}
