
-- Remove old overloads that make PostgREST fail with "could not choose the best candidate function"
DROP FUNCTION IF EXISTS public.create_receipt(uuid, numeric, public.payment_type, text);
DROP FUNCTION IF EXISTS public.admin_update_receipt(uuid, numeric, public.payment_type, text, text);

-- Rebuild directory view with address included
DROP VIEW IF EXISTS public.customer_balances;
CREATE VIEW public.customer_balances
WITH (security_invoker = on) AS
SELECT c.id AS customer_id,
    c.customer_no, c.full_name, c.phone, c.address, c.area, c.status,
    c.monthly_bill, c.billing_day, c.opening_balance,
    c.service_type, c.package_name,
    public.customer_bills_accrued(c.*) AS bills_accrued,
    COALESCE((SELECT sum(r.amount) FROM public.receipts r
       WHERE r.customer_id = c.id AND r.status = 'active'::receipt_status), 0) AS total_paid,
    c.opening_balance + public.customer_bills_accrued(c.*)
      - COALESCE((SELECT sum(r.amount) FROM public.receipts r
          WHERE r.customer_id = c.id AND r.status = 'active'::receipt_status), 0) AS balance
FROM public.customers c
WHERE c.status <> 'deleted'::customer_status;

GRANT SELECT ON public.customer_balances TO authenticated;
GRANT ALL ON public.customer_balances TO service_role;
