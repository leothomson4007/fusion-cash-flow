import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, KeyRound, ShieldOff, Shield, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { adminCreateUser, adminResetUserPassword, adminUpdateUser, adminDeleteUser } from "@/lib/admin.functions";

export const Route = createFileRoute("/app/admin/staff")({
  component: StaffPage,
});

type StaffRow = {
  id: string; full_name: string; phone: string | null; active: boolean; roles: string[];
};

function StaffPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_staff");
      if (error) throw error;
      return (data ?? []) as StaffRow[];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Staff</h2>
          <p className="text-sm text-muted-foreground">Admins and recovery collectors.</p>
        </div>
        <NewStaffDialog onDone={() => qc.invalidateQueries({ queryKey: ["staff"] })}>
          <Button><Plus className="h-4 w-4 mr-2" />Add staff</Button>
        </NewStaffDialog>
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Phone</th>
                <th className="text-left px-4 py-2">Roles</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{u.full_name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.phone ?? "—"}</td>
                  <td className="px-4 py-3 flex gap-1">
                    {u.roles.length === 0 ? <span className="text-xs text-muted-foreground">no role</span> :
                      u.roles.map((r) => <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>{r}</Badge>)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StaffActions row={u} onChange={() => qc.invalidateQueries({ queryKey: ["staff"] })} />
                  </td>
                </tr>
              ))}
              {(data ?? []).length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No staff yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StaffActions({ row, onChange }: { row: StaffRow; onChange: () => void }) {
  const reset = useServerFn(adminResetUserPassword);
  const update = useServerFn(adminUpdateUser);
  const del = useServerFn(adminDeleteUser);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({ fullName: row.full_name ?? "", phone: row.phone ?? "" });
  const [delOpen, setDelOpen] = useState(false);
  const [delReason, setDelReason] = useState("");

  const toggleRole = async (role: "admin" | "collector", has: boolean) => {
    const rpc = has ? "admin_revoke_role" : "admin_set_role";
    const { error } = await supabase.rpc(rpc, { _user_id: row.id, _role: role });
    if (error) return toast.error(error.message);
    toast.success("Updated");
    onChange();
  };
  const isAdmin = row.roles.includes("admin");
  const isCollector = row.roles.includes("collector");

  const submitPw = async () => {
    if (pw.length < 8) return toast.error("Min 8 characters");
    try {
      await reset({ data: { userId: row.id, newPassword: pw } });
      toast.success("Password reset");
      setPwOpen(false); setPw("");
    } catch (e) { toast.error(String((e as Error).message)); }
  };

  const submitEdit = async () => {
    try {
      await update({ data: { userId: row.id, fullName: edit.fullName, phone: edit.phone || null } });
      toast.success("Saved");
      setEditOpen(false); onChange();
    } catch (e) { toast.error(String((e as Error).message)); }
  };

  const submitDelete = async () => {
    try {
      await del({ data: { userId: row.id, reason: delReason || undefined } });
      toast.success("Staff deleted");
      setDelOpen(false); onChange();
    } catch (e) { toast.error(String((e as Error).message)); }
  };

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button size="sm" variant="ghost" onClick={() => toggleRole("collector", isCollector)} title="Toggle collector">
        {isCollector ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
        <span className="ml-1 text-xs hidden sm:inline">collector</span>
      </Button>
      <Button size="sm" variant="ghost" onClick={() => toggleRole("admin", isAdmin)} title="Toggle admin">
        {isAdmin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
        <span className="ml-1 text-xs hidden sm:inline">admin</span>
      </Button>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild><Button size="sm" variant="ghost" title="Edit"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit {row.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Full name</Label>
              <Input value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label>
              <Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={submitEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogTrigger asChild><Button size="sm" variant="ghost" title="Reset password"><KeyRound className="h-4 w-4" /></Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset password for {row.full_name}</DialogTitle></DialogHeader>
          <Input type="password" placeholder="New password (min 8)" value={pw} onChange={(e) => setPw(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button onClick={submitPw}>Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogTrigger asChild><Button size="sm" variant="ghost" className="text-destructive" title="Delete"><Trash2 className="h-4 w-4" /></Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {row.full_name}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently removes the account and revokes their access. Historical receipts and audit log remain.
          </p>
          <Input value={delReason} onChange={(e) => setDelReason(e.target.value)} placeholder="Reason (optional)" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDelOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={submitDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewStaffDialog({ children, onDone }: { children: React.ReactNode; onDone: () => void }) {
  const create = useServerFn(adminCreateUser);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", role: "collector" as "admin" | "collector" });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!form.email || !form.fullName || form.password.length < 8) return toast.error("Fill all fields (password ≥ 8)");
    setLoading(true);
    try {
      await create({ data: form });
      toast.success("Staff added");
      setOpen(false);
      setForm({ fullName: "", email: "", phone: "", password: "", role: "collector" });
      onDone();
    } catch (e) { toast.error(String((e as Error).message)); }
    finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add staff member</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Full name</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Temporary password</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "admin" | "collector" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="collector">Collector</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
