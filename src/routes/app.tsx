import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { useEffect } from "react";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";

export const Route = createFileRoute("/app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.loading && !auth.session) navigate({ to: "/auth", replace: true });
  }, [auth.loading, auth.session, navigate]);

  useEffect(() => {
    if (!auth.loading && auth.session && auth.role === null) {
      // signed in but no role — sign-out + back to auth
      // (collector accounts without role should never exist in normal flow)
    }
  }, [auth.loading, auth.session, auth.role]);

  if (auth.loading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }
  if (!auth.session) return null;
  if (auth.role === null) {
    return (
      <div className="min-h-screen grid place-items-center p-4 text-center">
        <div className="max-w-sm space-y-3">
          <h2 className="text-lg font-semibold">No role assigned</h2>
          <p className="text-sm text-muted-foreground">Ask an admin to assign you a role to access the app.</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell role={auth.role} fullName={auth.user?.user_metadata?.full_name ?? auth.user?.email} title="Fusion Net">
      <Outlet />
    </AppShell>
  );
}
