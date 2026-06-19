import { Card, CardContent } from "@/components/ui/card";
import { Money } from "@/components/money";
import { formatDateTime } from "@/lib/format";
import { Wifi, CheckCircle2, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReceiptForCard = {
  receipt_no: string;
  amount: number | string;
  payment_type: string;
  status: string;
  created_at: string;
  cancelled_reason?: string | null;
  note?: string | null;
  customer?: { customer_no: string; full_name: string; phone?: string | null } | null;
  collector_name?: string | null;
};

export function ReceiptCard({ receipt }: { receipt: ReceiptForCard }) {
  const cancelled = receipt.status === "cancelled";
  return (
    <Card className={cn("overflow-hidden shadow-elevated", cancelled && "opacity-80")}>
      <div className="bg-primary-deep text-primary-foreground px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-white/15">
            <Wifi className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider opacity-80">Fusion Net</div>
            <div className="text-sm font-semibold">Payment Receipt</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase opacity-70">Receipt #</div>
          <div className="font-mono text-sm font-semibold">{receipt.receipt_no}</div>
        </div>
      </div>
      <CardContent className="p-5 space-y-4">
        {cancelled && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
            <Ban className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Cancelled</div>
              {receipt.cancelled_reason && <div className="opacity-80">{receipt.cancelled_reason}</div>}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Customer" value={receipt.customer?.full_name ?? "—"} />
          <Field label="Customer #" value={receipt.customer?.customer_no ?? "—"} />
          {receipt.customer?.phone && <Field label="Phone" value={receipt.customer.phone} />}
          <Field label="Date / Time" value={formatDateTime(receipt.created_at)} />
          <Field label="Payment" value={receipt.payment_type.toUpperCase()} />
          {receipt.collector_name && <Field label="Collector" value={receipt.collector_name} />}
        </div>
        <div className="rounded-lg bg-muted p-4 flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Amount Paid</div>
          <Money value={receipt.amount} className="text-2xl" tone={cancelled ? "muted" : "success"} />
        </div>
        {receipt.note && (
          <div className="text-xs text-muted-foreground border-t pt-2">Note: {receipt.note}</div>
        )}
        {!cancelled && (
          <div className="flex items-center gap-2 text-xs text-success">
            <CheckCircle2 className="h-4 w-4" /> Receipt locked & recorded
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
