import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, Wifi } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in · Fusion Net" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "first-admin">("login");
  const [adminExists, setAdminExists] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.rpc("admin_exists").then(({ data }) => {
      setAdminExists(Boolean(data));
      if (!data) setTab("first-admin");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Wifi className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Fusion Net</h1>
          <p className="text-sm text-muted-foreground">ISP Billing & Cash Collection</p>
        </div>

        <Card className="shadow-elevated">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sign in to continue</CardTitle>
            <CardDescription>Use the credentials provided by your administrator.</CardDescription>
          </CardHeader>
          <CardContent>
            {adminExists === false ? (
              <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Sign in</TabsTrigger>
                  <TabsTrigger value="first-admin">First-time setup</TabsTrigger>
                </TabsList>
                <TabsContent value="login" className="pt-4"><LoginForm /></TabsContent>
                <TabsContent value="first-admin" className="pt-4"><FirstAdminForm onDone={() => setAdminExists(true)} /></TabsContent>
              </Tabs>
            ) : (
              <LoginForm />
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Authorized personnel only. All activity is logged.
        </p>
      </div>
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/app" });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}

function FirstAdminForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Sign up
    const { data: signUp, error: e1 } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } },
    });
    if (e1) { setLoading(false); toast.error(e1.message); return; }
    // Sign in (in case session not auto-set)
    if (!signUp.session) {
      const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
      if (e2) { setLoading(false); toast.error(e2.message); return; }
    }
    // Claim admin
    const { error: e3 } = await supabase.rpc("claim_first_admin");
    setLoading(false);
    if (e3) { toast.error(e3.message); return; }
    toast.success("Admin account created");
    onDone();
    navigate({ to: "/app" });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-primary-deep flex gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
        <span>No admin exists yet. Create the first admin account — this can only be done once.</span>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="aemail">Email</Label>
        <Input id="aemail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="apw">Password</Label>
        <Input id="apw" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "Creating..." : "Create admin & sign in"}
      </Button>
    </form>
  );
}
