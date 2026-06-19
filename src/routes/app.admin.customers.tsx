import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/money";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/customers")({
  component: CustomersPage,
});

type Row = {
  customer_id: string; customer_no: string; full_name: string; phone: string | null;
  area: string | null; status: string; monthly_bill: number; balance: number;
};

function CustomersPage() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["customer-balances", statusFilter, q],
    queryFn: async () => {
      const query = supabase.from("customer_balances").select("*").order("full_name");
      if (statusFilter !== "all") query.eq("status", statusFilter);
      if (q.trim()) query.or(`full_name.ilike.%${q}%,customer_no.ilike.%${q}%,phone.ilike.%${q}%,area.ilike.%${q}%`);
      const { data } = await query;
      return (data ?? []) as unknown as Row[];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Customers</h2>
          <p className="text-sm text-muted-foreground">{data?.length ?? 0} matching</p>
        </div>
        <CustomerDialog onSaved={() => qc.invalidateQueries({ queryKey: ["customer-balances"] })}>
          <Button><Plus className="h-4 w-4 mr-2" />New customer</Button>
        </CustomerDialog>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-3 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search name / # / phone / area" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Customer</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">Area</th>
                <th className="text-right px-4 py-2">Monthly</th>
                <th className="text-right px-4 py-2">Balance</th>
                <th className="text-left px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && (data ?? []).length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No customers.</td></tr>
              )}
              {(data ?? []).map((c) => (
                <tr key={c.customer_id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link to="/app/admin/customers/$id" params={{ id: c.customer_id }} className="block">
                      <div className="font-medium">{c.full_name}</div>
                      <div className="text-xs text-muted-foreground">{c.customer_no} {c.phone && `· ${c.phone}`}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{c.area ?? "—"}</td>
                  <td className="px-4 py-3 text-right"><Money value={c.monthly_bill} /></td>
                  <td className="px-4 py-3 text-right">
                    <Money value={c.balance} tone={Number(c.balance) > 0 ? "destructive" : "success"} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function CustomerDialog({
  children, existing, onSaved,
}: {
  children: React.ReactNode;
  existing?: { id: string; full_name: string; phone: string | null; address: string | null; area: string | null; monthly_bill: number; billing_day: number; status: "active" | "inactive"; opening_balance: number; notes: string | null };
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: existing?.full_name ?? "",
    phone: existing?.phone ?? "",
    address: existing?.address ?? "",
    area: existing?.area ?? "",
    monthly_bill: existing?.monthly_bill ?? 1500,
    billing_day: existing?.billing_day ?? 1,
    status: (existing?.status ?? "active") as "active" | "inactive",
    opening_balance: existing?.opening_balance ?? 0,
    notes: existing?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.full_name.trim()) return toast.error("Name is required");
    setSaving(true);
    const { error } = await supabase.rpc("admin_upsert_customer", {
      _id: existing?.id ?? null,
      _full_name: form.full_name.trim(),
      _phone: form.phone || null,
      _address: form.address || null,
      _area: form.area || null,
      _monthly_bill: Number(form.monthly_bill) || 0,
      _billing_day: Number(form.billing_day) || 1,
      _status: form.status,
      _opening_balance: Number(form.opening_balance) || 0,
      _notes: form.notes || null,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Customer updated" : "Customer added");
    setOpen(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{existing ? "Edit customer" : "New customer"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label>Full name *</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Area</Label>
            <Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></div>
          <div className="col-span-2 space-y-1.5"><Label>Address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Monthly bill (Rs.)</Label>
            <Input type="number" min={0} value={form.monthly_bill} onChange={(e) => setForm({ ...form, monthly_bill: Number(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Billing day (1-28)</Label>
            <Input type="number" min={1} max={28} value={form.billing_day} onChange={(e) => setForm({ ...form, billing_day: Number(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Opening balance (Rs.)</Label>
            <Input type="number" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: Number(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "active" | "inactive" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select></div>
          <div className="col-span-2 space-y-1.5"><Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
