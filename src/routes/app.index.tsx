import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role === "admin") return <Navigate to="/app/admin/dashboard" replace />;
  if (role === "collector") return <Navigate to="/app/collector/dashboard" replace />;
  return null;
}
