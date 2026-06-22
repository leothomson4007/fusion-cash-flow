import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/money";
import { Plus, Search, Pencil, Trash2, MapPin, Wifi, Tv, Filter, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/customers")({
  component: CustomersPage,
});

type Row = {
  customer_id: string; customer_no: string; full_name: string; phone: string | null;
  area: string | null; status: string; monthly_bill: number; balance: number;
  service_type: string | null; package_name: string | null;
};

function CustomersPage() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [paidFilter, setPaidFilter] = useState<"all" | "unpaid" | "paid">("all");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["customer-balances", statusFilter],
    queryFn: async () => {
      const query = supabase.from("customer_balances").select("*").order("full_name");
      if (statusFilter !== "all") query.eq("status", statusFilter);
      const { data } = await query;
      return (data ?? []) as unknown as Row[];
    },
  });

  const areas = useMemo(() => {
    const s = new Set<string>();
    (data ?? []).forEach((c) => c.area && s.add(c.area));
    return [...s].sort();
  }, [data]);

  const filtered = useMemo(() => {
    return (data ?? []).filter((c) => {
      if (q.trim()) {
        const needle = q.toLowerCase();
        const hay = `${c.full_name} ${c.customer_no} ${c.phone ?? ""} ${c.area ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (areaFilter !== "all" && c.area !== areaFilter) return false;
      if (serviceFilter !== "all" && c.service_type !== serviceFilter) return false;
      if (paidFilter === "unpaid" && Number(c.balance) <= 0) return false;
      if (paidFilter === "paid" && Number(c.balance) > 0) return false;
      return true;
    });
  }, [data, q, areaFilter, serviceFilter, paidFilter]);

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (areaFilter !== "all" ? 1 : 0) +
    (serviceFilter !== "all" ? 1 : 0) +
    (paidFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter("all"); setAreaFilter("all"); setServiceFilter("all"); setPaidFilter("all");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Customers</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} of {data?.length ?? 0}</p>
        </div>
        <CustomerDialog onSaved={() => qc.invalidateQueries({ queryKey: ["customer-balances"] })}>
          <Button size="sm"><Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">New</span></Button>
        </CustomerDialog>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search name, #, phone, area" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <IconSelect title="Area" icon={<MapPin className="h-4 w-4" />} value={areaFilter} onChange={setAreaFilter}
              options={[{ value: "all", label: "All areas" }, ...areas.map((a) => ({ value: a, label: a }))]} />
            <IconSelect title="Service" icon={<Wifi className="h-4 w-4" />} value={serviceFilter} onChange={setServiceFilter}
              options={[
                { value: "all", label: "All services" },
                { value: "internet", label: "Internet" },
                { value: "tv", label: "TV" },
                { value: "internet_tv", label: "Internet + TV" },
              ]} />
            <IconSelect title="Payment" icon={<Filter className="h-4 w-4" />} value={paidFilter} onChange={(v) => setPaidFilter(v as typeof paidFilter)}
              options={[
                { value: "all", label: "All payment" },
                { value: "unpaid", label: "Unpaid only" },
                { value: "paid", label: "Paid up" },
              ]} />
            <IconSelect title="Status" icon={<Tv className="h-4 w-4" />} value={statusFilter} onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              options={[
                { value: "all", label: "All statuses" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]} />
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs">
                <X className="h-3 w-3 mr-1" />Clear ({activeFilterCount})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Desktop table */}
      <Card className="shadow-card overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Customer</th>
                <th className="text-left px-4 py-2">Area</th>
                <th className="text-left px-4 py-2">Service</th>
                <th className="text-right px-4 py-2">Monthly</th>
                <th className="text-right px-4 py-2">Balance</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No customers match.</td></tr>
              )}
              {filtered.map((c) => (
                <CustomerRow key={c.customer_id} c={c} onChanged={() => qc.invalidateQueries({ queryKey: ["customer-balances"] })} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && filtered.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No customers match.</div>}
        {filtered.map((c) => (
          <CustomerCard key={c.customer_id} c={c} onChanged={() => qc.invalidateQueries({ queryKey: ["customer-balances"] })} />
        ))}
      </div>
    </div>
  );
}

function IconSelect({
  title, icon, value, onChange, options,
}: {
  title: string; icon: React.ReactNode; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const active = value !== "all";
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-8 px-2 gap-1.5 text-xs w-auto min-w-0 ${active ? "border-primary text-primary" : ""}`} aria-label={title}>
        {icon}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function serviceIcon(s: string | null) {
  if (s === "tv") return <Tv className="h-3.5 w-3.5" />;
  if (s === "internet_tv") return <div className="flex gap-0.5"><Wifi className="h-3.5 w-3.5" /><Tv className="h-3.5 w-3.5" /></div>;
  return <Wifi className="h-3.5 w-3.5" />;
}

function CustomerRow({ c, onChanged }: { c: Row; onChanged: () => void }) {
  return (
    <tr className="border-t hover:bg-muted/30">
      <td className="px-4 py-3">
        <Link to="/app/admin/customers/$id" params={{ id: c.customer_id }} className="block">
          <div className="font-medium">{c.full_name}</div>
          <div className="text-xs text-muted-foreground">{c.customer_no} {c.phone && `· ${c.phone}`}</div>
        </Link>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{c.area ?? "—"}</td>
      <td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-xs">{serviceIcon(c.service_type)}{c.package_name ?? "—"}</span></td>
      <td className="px-4 py-3 text-right"><Money value={c.monthly_bill} /></td>
      <td className="px-4 py-3 text-right">
        <Money value={c.balance} tone={Number(c.balance) > 0 ? "destructive" : "success"} />
      </td>
      <td className="px-4 py-3">
        <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
      </td>
      <td className="px-2 py-3"><RowActions c={c} onChanged={onChanged} /></td>
    </tr>
  );
}

function CustomerCard({ c, onChanged }: { c: Row; onChanged: () => void }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-3 flex items-center gap-3">
        <Link to="/app/admin/customers/$id" params={{ id: c.customer_id }} className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{c.full_name}</span>
            <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px]">{c.status}</Badge>
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {c.customer_no} · {c.area ?? "—"}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs">
            <span className="inline-flex items-center gap-1">{serviceIcon(c.service_type)}{c.package_name ?? "—"}</span>
            <Money value={c.balance} tone={Number(c.balance) > 0 ? "destructive" : "success"} className="text-sm" />
          </div>
        </Link>
        <RowActions c={c} onChanged={onChanged} />
      </CardContent>
    </Card>
  );
}

function RowActions({ c, onChanged }: { c: Row; onChanged: () => void }) {
  const [delOpen, setDelOpen] = useState(false);
  const [reason, setReason] = useState("");


  const doDelete = async () => {
    if (!reason.trim()) return toast.error("Reason required");
    const { error } = await supabase.rpc("admin_delete_customer", { _id: c.customer_id, _reason: reason } as never);
    if (error) return toast.error(error.message);
    toast.success("Customer deleted");
    setDelOpen(false); setReason("");
    onChanged();
  };

  // We need to fetch the full customer to edit
  const openEdit = async () => {
    const { data: full } = await supabase.from("customers").select("*").eq("id", c.customer_id).single();
    if (!full) return toast.error("Could not load customer");
    setEditData({
      id: full.id, full_name: full.full_name, phone: full.phone, address: full.address, area: full.area,
      monthly_bill: Number(full.monthly_bill), billing_day: full.billing_day,
      status: (full.status === "deleted" ? "inactive" : full.status) as "active" | "inactive",
      opening_balance: Number(full.opening_balance), notes: full.notes,
      service_type: full.service_type, package_name: full.package_name,
    });
  };
  const [editData, setEditData] = useState<{
    id: string; full_name: string; phone: string | null; address: string | null; area: string | null;
    monthly_bill: number; billing_day: number; status: "active" | "inactive";
    opening_balance: number; notes: string | null;
    service_type?: string | null; package_name?: string | null;
  } | null>(null);

  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openEdit} aria-label="Edit">
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDelOpen(true)} aria-label="Delete">
        <Trash2 className="h-4 w-4" />
      </Button>

      {editData && (
        <CustomerDialog
          existing={editData}
          forceOpen
          onClose={() => setEditData(null)}
          onSaved={() => { setEditData(null); onChanged(); }}
        >
          <span />
        </CustomerDialog>
      )}

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {c.full_name}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            The customer will be hidden from active lists. Their receipts and audit log remain intact and can be restored later.
          </p>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for deletion" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDelOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={doDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden navigate helper to silence unused warning */}
      <span hidden onClick={() => navigate({ to: "/app/admin/customers/$id", params: { id: c.customer_id } })} />
    </div>
  );
}

export function CustomerDialog({
  children, existing, onSaved, forceOpen, onClose,
}: {
  children: React.ReactNode;
  existing?: {
    id: string; full_name: string; phone: string | null; address: string | null; area: string | null;
    monthly_bill: number; billing_day: number; status: "active" | "inactive";
    opening_balance: number; notes: string | null;
    service_type?: string | null; package_name?: string | null;
  };
  onSaved?: () => void;
  forceOpen?: boolean;
  onClose?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = forceOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (forceOpen !== undefined) { if (!v) onClose?.(); }
    else setInternalOpen(v);
  };
  const [form, setForm] = useState({
    full_name: existing?.full_name ?? "",
    phone: existing?.phone ?? "",
    address: existing?.address ?? "",
    area: existing?.area ?? "",
    service_type: existing?.service_type ?? "internet",
    package_name: existing?.package_name ?? "",
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
      _service_type: form.service_type || null,
      _package_name: form.package_name || null,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Customer updated" : "Customer added");
    setOpen(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {forceOpen === undefined && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
          <div className="space-y-1.5"><Label>Service type</Label>
            <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="internet">Internet</SelectItem>
                <SelectItem value="tv">TV</SelectItem>
                <SelectItem value="internet_tv">Internet + TV</SelectItem>
              </SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>Package name</Label>
            <Input value={form.package_name} onChange={(e) => setForm({ ...form, package_name: e.target.value })} placeholder="e.g. Home Pro" /></div>
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
