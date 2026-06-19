import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Money({
  value, className, tone,
}: { value: number | string | null | undefined; className?: string; tone?: "default" | "success" | "destructive" | "muted" }) {
  const toneCls =
    tone === "success" ? "text-success"
    : tone === "destructive" ? "text-destructive"
    : tone === "muted" ? "text-muted-foreground"
    : "text-foreground";
  return <span className={cn("font-medium tabular-nums", toneCls, className)}>{formatMoney(value)}</span>;
}
