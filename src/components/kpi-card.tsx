import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label, value, icon: Icon, accent, hint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  accent?: "primary" | "success" | "warning" | "destructive";
  hint?: React.ReactNode;
}) {
  const tone = accent === "success" ? "bg-success/10 text-success"
    : accent === "warning" ? "bg-warning/15 text-warning-foreground"
    : accent === "destructive" ? "bg-destructive/10 text-destructive"
    : "bg-primary/10 text-primary";
  return (
    <Card className="shadow-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
            {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
          </div>
          {Icon && (
            <div className={cn("rounded-lg p-2", tone)}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
