import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/money";
import { formatMoney, formatDateTime } from "@/lib/format";
import { Wifi, CheckCircle2, Ban, ImageDown, Share2, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type ReceiptForCard = {
  id?: string;
  receipt_no: string;
  amount: number | string;
  payment_type: string;
  payment_reference?: string | null;
  previous_due?: number | string | null;
  remaining_due?: number | string | null;
  status: string;
  created_at: string;
  cancelled_reason?: string | null;
  note?: string | null;
  customer?: { customer_no: string; full_name: string; phone?: string | null } | null;
  collector_name?: string | null;
};

export function ReceiptCard({
  receipt,
  showActions = true,
}: {
  receipt: ReceiptForCard;
  showActions?: boolean;
}) {
  const cancelled = receipt.status === "cancelled";
  const printRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const prev = receipt.previous_due == null ? null : Number(receipt.previous_due);
  const rem = receipt.remaining_due == null ? null : Number(receipt.remaining_due);
  const amt = Number(receipt.amount);
  const paymentStatus = !cancelled
    ? rem == null ? "Paid" : rem <= 0 ? "Cleared" : "Partially Paid"
    : "Cancelled";

  const shareText = () => {
    const lines = [
      `Fusion Net — Payment Receipt`,
      `Receipt: ${receipt.receipt_no}`,
      receipt.payment_reference ? `Reference: ${receipt.payment_reference}` : null,
      receipt.customer ? `Customer: ${receipt.customer.full_name} (${receipt.customer.customer_no})` : null,
      `Amount: ${formatMoney(receipt.amount)}`,
      `Payment: ${receipt.payment_type.toUpperCase()}`,
      `Date: ${formatDateTime(receipt.created_at)}`,
      prev != null ? `Previous due: ${formatMoney(prev)}` : null,
      rem != null ? `Remaining: ${formatMoney(rem)}` : null,
      `Status: ${paymentStatus}`,
    ].filter(Boolean);
    return lines.join("\n");
  };

  const handleShare = async () => {
    const text = shareText();
    try {
      if (typeof navigator !== "undefined" && (navigator as Navigator).share) {
        await (navigator as Navigator).share({ title: `Receipt ${receipt.receipt_no}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Receipt copied to clipboard");
      }
    } catch {
      // user cancelled or share failed — fall back to clipboard silently
      try { await navigator.clipboard.writeText(text); toast.success("Receipt copied"); } catch { /* ignore */ }
    }
  };

  const handlePrint = () => {
    // Open a print window so we don't print the entire app shell.
    const node = printRef.current;
    if (!node) { window.print(); return; }
    const w = window.open("", "_blank", "width=420,height=720");
    if (!w) { window.print(); return; }
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML).join("\n");
    w.document.write(`<!doctype html><html><head><title>${receipt.receipt_no}</title>${styles}
      <style>body{padding:16px;background:#fff} .print-only{box-shadow:none!important}</style>
      </head><body>${node.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 350);
  };

  const handleDownloadImage = async () => {
    setBusy(true);
    try {
      const node = printRef.current;
      if (!node) return;
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${receipt.receipt_no}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Receipt image saved");
    } catch (e) {
      console.error("Save image failed:", e);
      toast.error("Couldn't save image — try Print instead");
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="space-y-3">
      <Card ref={printRef} className={cn("overflow-hidden shadow-elevated print-only", cancelled && "opacity-80")}>
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
            {receipt.payment_reference && (
              <Field label="Reference" value={<span className="font-mono">{receipt.payment_reference}</span>} />
            )}
            {receipt.collector_name && <Field label="Collected by" value={receipt.collector_name} />}
          </div>

          <div className="rounded-lg bg-muted p-4 flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Amount Paid</div>
            <Money value={amt} className="text-2xl" tone={cancelled ? "muted" : "success"} />
          </div>

          {(prev != null || rem != null) && (
            <div className="rounded-lg border divide-y text-sm">
              {prev != null && (
                <Row label="Previous due" value={<Money value={prev} tone={prev > 0 ? "destructive" : "default"} />} />
              )}
              <Row label="This payment" value={<Money value={amt} tone="success" />} />
              {rem != null && (
                <Row label="Remaining balance"
                  value={<Money value={rem} tone={rem > 0 ? "destructive" : "success"} className="font-semibold" />} />
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-2 text-xs">
            <span className="text-muted-foreground">Status</span>
            <span className={cn(
              "font-semibold",
              cancelled ? "text-destructive"
                : paymentStatus === "Cleared" ? "text-success"
                : paymentStatus === "Partially Paid" ? "text-warning"
                : "text-primary",
            )}>{paymentStatus}</span>
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

      {showActions && (
        <div className="grid grid-cols-3 gap-2 no-print">
          <Button variant="outline" onClick={handleDownloadImage} disabled={busy}>
            <ImageDown className="h-4 w-4 mr-1" />{busy ? "…" : "Save image"}
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />Print
          </Button>
          <Button onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-1" />Share
          </Button>
        </div>
      )}
    </div>
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}
