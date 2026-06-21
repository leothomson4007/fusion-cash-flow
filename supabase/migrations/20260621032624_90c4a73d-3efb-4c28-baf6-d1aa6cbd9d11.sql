
DROP VIEW IF EXISTS public.customer_balances;

ALTER TABLE public.customers DROP COLUMN IF EXISTS internet_speed;

CREATE VIEW public.customer_balances AS
SELECT id AS customer_id,
    customer_no, full_name, phone, area, status, monthly_bill, billing_day,
    opening_balance, service_type, package_name,
    public.customer_bills_accrued(c.*) AS bills_accrued,
    COALESCE((SELECT sum(r.amount) FROM public.receipts r
       WHERE r.customer_id = c.id AND r.status = 'active'::receipt_status), 0) AS total_paid,
    opening_balance + public.customer_bills_accrued(c.*)
      - COALESCE((SELECT sum(r.amount) FROM public.receipts r
          WHERE r.customer_id = c.id AND r.status = 'active'::receipt_status), 0) AS balance
FROM public.customers c
WHERE status <> 'deleted'::customer_status;

GRANT SELECT ON public.customer_balances TO authenticated;
GRANT ALL ON public.customer_balances TO service_role;

CREATE OR REPLACE FUNCTION public.admin_upsert_customer(
  _id uuid, _full_name text, _phone text, _address text, _area text,
  _monthly_bill numeric, _billing_day integer, _status customer_status,
  _opening_balance numeric, _notes text,
  _service_type text DEFAULT NULL,
  _package_name text DEFAULT NULL,
  _internet_speed text DEFAULT NULL
)
RETURNS public.customers
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _row public.customers; _old public.customers;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM _internet_speed; -- ignored: column removed
  IF _id IS NULL THEN
    INSERT INTO public.customers(
      customer_no, full_name, phone, address, area, monthly_bill,
      billing_day, status, opening_balance, notes, created_by,
      service_type, package_name
    ) VALUES (
      public.next_customer_no(), _full_name, _phone, _address, _area,
      COALESCE(_monthly_bill,0), COALESCE(_billing_day,1),
      COALESCE(_status,'active'), COALESCE(_opening_balance,0), _notes, auth.uid(),
      _service_type, _package_name
    ) RETURNING * INTO _row;
    PERFORM public.write_audit('create','customer', _row.id, NULL, to_jsonb(_row), NULL);
  ELSE
    SELECT * INTO _old FROM public.customers WHERE id = _id;
    UPDATE public.customers SET
      full_name = _full_name, phone = _phone, address = _address, area = _area,
      monthly_bill = COALESCE(_monthly_bill,0), billing_day = COALESCE(_billing_day,1),
      status = COALESCE(_status, _old.status), opening_balance = COALESCE(_opening_balance,0),
      notes = _notes,
      service_type = _service_type, package_name = _package_name
      WHERE id = _id RETURNING * INTO _row;
    PERFORM public.write_audit('update','customer', _id, to_jsonb(_old), to_jsonb(_row), NULL);
  END IF;
  RETURN _row;
END; $function$;
