export function formatMoney(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return "Rs. 0";
  return "Rs. " + n.toLocaleString("en-PK", { maximumFractionDigits: 2 });
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "2-digit" });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-PK", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// Compute "today" boundaries in Asia/Karachi (PKT, fixed UTC+5, no DST)
// so dashboard KPIs match the operator's local day regardless of browser timezone.
export function todayRangeISO(): { from: string; to: string } {
  const PKT_OFFSET_MIN = 5 * 60;
  const now = new Date();
  // shift into PKT, take Y/M/D, then shift back to UTC
  const pkt = new Date(now.getTime() + PKT_OFFSET_MIN * 60_000);
  const y = pkt.getUTCFullYear(), m = pkt.getUTCMonth(), d = pkt.getUTCDate();
  const fromMs = Date.UTC(y, m, d) - PKT_OFFSET_MIN * 60_000;
  const toMs = Date.UTC(y, m, d + 1) - PKT_OFFSET_MIN * 60_000;
  return { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString() };
}
