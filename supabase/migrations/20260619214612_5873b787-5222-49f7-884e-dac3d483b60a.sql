
-- Recreate view with security_invoker so RLS applies as the caller
DROP VIEW IF EXISTS public.customer_balances;
CREATE VIEW public.customer_balances WITH (security_invoker = true) AS
SELECT
  c.id AS customer_id,
  c.customer_no, c.full_name, c.phone, c.area, c.status,
  c.monthly_bill, c.billing_day, c.opening_balance,
  public.customer_bills_accrued(c) AS bills_accrued,
  COALESCE((SELECT SUM(amount) FROM public.receipts r
            WHERE r.customer_id = c.id AND r.status='active'),0) AS total_paid,
  c.opening_balance + public.customer_bills_accrued(c)
    - COALESCE((SELECT SUM(amount) FROM public.receipts r
                WHERE r.customer_id = c.id AND r.status='active'),0) AS balance
FROM public.customers c;
GRANT SELECT ON public.customer_balances TO authenticated;

-- Revoke anon EXECUTE on all our SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_exists() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.next_customer_no() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.write_audit(text,text,uuid,jsonb,jsonb,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_receipt(uuid,numeric,public.payment_type,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_receipt(uuid,numeric,public.payment_type,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_receipt(uuid,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_upsert_customer(uuid,text,text,text,text,numeric,integer,public.customer_status,numeric,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.collector_expected_cash(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.submit_cash(numeric,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.verify_cash(uuid,numeric,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid,public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_role(uuid,public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.list_staff() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.customer_bills_accrued(public.customers) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_receipt(uuid,numeric,public.payment_type,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_receipt(uuid,numeric,public.payment_type,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_receipt(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_customer(uuid,text,text,text,text,numeric,integer,public.customer_status,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.collector_expected_cash(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_cash(numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cash(uuid,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid,public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_role(uuid,public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_bills_accrued(public.customers) TO authenticated;
