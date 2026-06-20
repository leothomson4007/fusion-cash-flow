import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to changes on financial tables and invalidates ALL react-query
 * caches so dashboards, customer balances, and receipt lists stay live.
 *
 * Single source of truth: balances are always derived from the
 * `customer_balances` view (bills − active receipts). This hook makes sure
 * the UI re-reads that view the moment a receipt or customer changes.
 */
export function useRealtimeInvalidate() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("fusion-net-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "receipts" }, () => {
        qc.invalidateQueries();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, () => {
        qc.invalidateQueries();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_submissions" }, () => {
        qc.invalidateQueries();
      })
      .subscribe();

    // Also refetch when the tab regains focus / network reconnects.
    const onFocus = () => qc.invalidateQueries();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [qc]);
}
