
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS package_name TEXT,
  ADD COLUMN IF NOT EXISTS internet_speed TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS previous_due NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS remaining_due NUMERIC(12,2);

CREATE SEQUENCE IF NOT EXISTS public.cash_conf_seq;

DROP POLICY IF EXISTS "Receipts: admin or own" ON public.receipts;
CREATE POLICY "Receipts: authenticated read"
  ON public.receipts FOR SELECT TO authenticated USING (true);

DROP VIEW IF EXISTS public.customer_balances;
CREATE VIEW public.customer_balances
WITH (security_invoker = true) AS
SELECT
  c.id AS customer_id,
  c.customer_no, c.full_name, c.phone, c.area, c.status,
  c.monthly_bill, c.billing_day, c.opening_balance,
  c.service_type, c.package_name, c.internet_speed,
  public.customer_bills_accrued(c.*) AS bills_accrued,
  COALESCE((SELECT SUM(r.amount) FROM public.receipts r
            WHERE r.customer_id = c.id AND r.status = 'active'), 0) AS total_paid,
  (c.opening_balance + public.customer_bills_accrued(c.*) -
   COALESCE((SELECT SUM(r.amount) FROM public.receipts r
             WHERE r.customer_id = c.id AND r.status = 'active'), 0)) AS balance
FROM public.customers c
WHERE c.status <> 'deleted';

GRANT SELECT ON public.customer_balances TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_customer(
  _id uuid, _full_name text, _phone text, _address text, _area text,
  _monthly_bill numeric, _billing_day integer, _status public.customer_status,
  _opening_balance numeric, _notes text,
  _service_type text DEFAULT NULL,
  _package_name text DEFAULT NULL,
  _internet_speed text DEFAULT NULL
) RETURNS public.customers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _row public.customers; _old public.customers;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.customers(
      customer_no, full_name, phone, address, area, monthly_bill,
      billing_day, status, opening_balance, notes, created_by,
      service_type, package_name, internet_speed
    ) VALUES (
      public.next_customer_no(), _full_name, _phone, _address, _area,
      COALESCE(_monthly_bill,0), COALESCE(_billing_day,1),
      COALESCE(_status,'active'), COALESCE(_opening_balance,0), _notes, auth.uid(),
      _service_type, _package_name, _internet_speed
    ) RETURNING * INTO _row;
    PERFORM public.write_audit('create','customer', _row.id, NULL, to_jsonb(_row), NULL);
  ELSE
    SELECT * INTO _old FROM public.customers WHERE id = _id;
    UPDATE public.customers SET
      full_name = _full_name, phone = _phone, address = _address, area = _area,
      monthly_bill = COALESCE(_monthly_bill,0), billing_day = COALESCE(_billing_day,1),
      status = COALESCE(_status, _old.status), opening_balance = COALESCE(_opening_balance,0),
      notes = _notes,
      service_type = _service_type, package_name = _package_name,
      internet_speed = _internet_speed
      WHERE id = _id RETURNING * INTO _row;
    PERFORM public.write_audit('update','customer', _id, to_jsonb(_old), to_jsonb(_row), NULL);
  END IF;
  RETURN _row;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_customer(_id uuid, _reason text)
RETURNS public.customers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _old public.customers; _new public.customers;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO _old FROM public.customers WHERE id = _id;
  IF _old.id IS NULL THEN RAISE EXCEPTION 'Customer not found'; END IF;
  UPDATE public.customers SET status = 'deleted', deleted_at = now()
    WHERE id = _id RETURNING * INTO _new;
  PERFORM public.write_audit('delete','customer', _id, to_jsonb(_old), to_jsonb(_new), _reason);
  RETURN _new;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_restore_customer(_id uuid)
RETURNS public.customers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _old public.customers; _new public.customers;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO _old FROM public.customers WHERE id = _id;
  UPDATE public.customers SET status = 'active', deleted_at = NULL
    WHERE id = _id RETURNING * INTO _new;
  PERFORM public.write_audit('restore','customer', _id, to_jsonb(_old), to_jsonb(_new), NULL);
  RETURN _new;
END; $$;

CREATE OR REPLACE FUNCTION public.create_receipt(
  _customer_id uuid,
  _amount numeric,
  _payment_type public.payment_type DEFAULT 'cash',
  _note text DEFAULT NULL,
  _payment_reference text DEFAULT NULL
) RETURNS public.receipts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _is_admin BOOLEAN;
  _year INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  _next BIGINT;
  _no TEXT;
  _row public.receipts;
  _ptype public.payment_type := _payment_type;
  _ref TEXT := NULLIF(trim(_payment_reference), '');
  _prev NUMERIC(12,2);
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;

  _is_admin := public.has_role(_uid,'admin');
  IF NOT _is_admin AND NOT public.has_role(_uid,'collector') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF NOT _is_admin AND _ptype <> 'cash' THEN _ptype := 'cash'; END IF;

  IF _ptype = 'cash' AND _ref IS NULL THEN
    _ref := 'CONF-' || _year::TEXT || '-' || LPAD(nextval('public.cash_conf_seq')::TEXT, 6, '0');
  END IF;

  INSERT INTO public.receipt_sequence(year, last_no) VALUES (_year, 0)
    ON CONFLICT (year) DO NOTHING;
  UPDATE public.receipt_sequence SET last_no = last_no + 1
    WHERE year = _year RETURNING last_no INTO _next;
  _no := 'FN-' || _year::TEXT || '-' || LPAD(_next::TEXT, 6, '0');

  SELECT balance INTO _prev FROM public.customer_balances WHERE customer_id = _customer_id;
  _prev := COALESCE(_prev, 0);

  INSERT INTO public.receipts(
    receipt_no, year, seq, customer_id, amount, payment_type,
    collector_id, created_by, note, payment_reference,
    previous_due, remaining_due
  ) VALUES (
    _no, _year, _next, _customer_id, _amount, _ptype,
    CASE WHEN _ptype = 'cash' THEN _uid ELSE NULL END,
    _uid, _note, _ref,
    _prev, _prev - _amount
  ) RETURNING * INTO _row;

  PERFORM public.write_audit('create','receipt', _row.id, NULL, to_jsonb(_row), NULL);
  RETURN _row;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_receipt(
  _id uuid, _amount numeric, _payment_type public.payment_type,
  _note text, _reason text, _payment_reference text DEFAULT NULL
) RETURNS public.receipts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _old public.receipts; _new public.receipts;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'Reason required'; END IF;
  SELECT * INTO _old FROM public.receipts WHERE id = _id;
  IF _old.id IS NULL THEN RAISE EXCEPTION 'Receipt not found'; END IF;
  IF _old.status = 'cancelled' THEN RAISE EXCEPTION 'Cancelled receipts cannot be edited'; END IF;
  UPDATE public.receipts
    SET amount = _amount, payment_type = _payment_type, note = _note,
        payment_reference = COALESCE(NULLIF(trim(_payment_reference),''), _old.payment_reference)
    WHERE id = _id RETURNING * INTO _new;
  PERFORM public.write_audit('update','receipt', _id, to_jsonb(_old), to_jsonb(_new), _reason);
  RETURN _new;
END; $$;
