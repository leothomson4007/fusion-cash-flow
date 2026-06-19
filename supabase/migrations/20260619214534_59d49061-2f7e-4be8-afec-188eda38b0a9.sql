
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('admin', 'collector');
CREATE TYPE public.payment_type AS ENUM ('cash', 'bank', 'easypaisa', 'jazzcash');
CREATE TYPE public.receipt_status AS ENUM ('active', 'cancelled');
CREATE TYPE public.customer_status AS ENUM ('active', 'inactive');
CREATE TYPE public.submission_status AS ENUM ('pending', 'verified');

-- =========================
-- UPDATED_AT HELPER
-- =========================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- USER ROLES
-- =========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'admin' THEN 1 ELSE 2 END LIMIT 1;
$$;

-- Profiles policies
CREATE POLICY "Profiles: own select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Profiles: own update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Profiles: admin insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR id = auth.uid());

-- User_roles policies
CREATE POLICY "Roles: self or admin select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- =========================
-- ONE-TIME ADMIN CLAIM
-- =========================
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS public.app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'Admin already exists';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin');
  RETURN 'admin';
END; $$;

CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin');
$$;

-- =========================
-- CUSTOMERS
-- =========================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_no TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  area TEXT,
  monthly_bill NUMERIC(12,2) NOT NULL DEFAULT 0,
  billing_day INTEGER NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.customer_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_customers_status ON public.customers(status);
CREATE INDEX idx_customers_area ON public.customers(area);

CREATE POLICY "Customers: authenticated read" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Customers: admin insert" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Customers: admin update" ON public.customers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Customer number generator
CREATE SEQUENCE public.customer_no_seq START 1;
CREATE OR REPLACE FUNCTION public.next_customer_no()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'FN-C' || LPAD(nextval('public.customer_no_seq')::TEXT, 4, '0');
$$;

-- =========================
-- RECEIPT SEQUENCE TABLE (per year)
-- =========================
CREATE TABLE public.receipt_sequence (
  year INTEGER PRIMARY KEY,
  last_no BIGINT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.receipt_sequence TO authenticated;
GRANT ALL ON public.receipt_sequence TO service_role;
ALTER TABLE public.receipt_sequence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seq: admin read" ON public.receipt_sequence FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- =========================
-- RECEIPTS
-- =========================
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no TEXT NOT NULL UNIQUE,
  year INTEGER NOT NULL,
  seq BIGINT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_type public.payment_type NOT NULL DEFAULT 'cash',
  status public.receipt_status NOT NULL DEFAULT 'active',
  cancelled_reason TEXT,
  collector_id UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (year, seq)
);
GRANT SELECT ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_receipts_updated BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_receipts_customer ON public.receipts(customer_id);
CREATE INDEX idx_receipts_collector ON public.receipts(collector_id);
CREATE INDEX idx_receipts_created_at ON public.receipts(created_at);

-- Admin sees all; collector sees their own
CREATE POLICY "Receipts: admin or own" ON public.receipts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR collector_id = auth.uid() OR created_by = auth.uid());
-- All writes via SECURITY DEFINER RPCs

-- =========================
-- CASH SUBMISSIONS
-- =========================
CREATE TABLE public.cash_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id UUID NOT NULL REFERENCES auth.users(id),
  expected_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  declared_amount NUMERIC(12,2) NOT NULL,
  received_amount NUMERIC(12,2),
  difference NUMERIC(12,2),
  status public.submission_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cash_submissions TO authenticated;
GRANT ALL ON public.cash_submissions TO service_role;
ALTER TABLE public.cash_submissions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_cash_updated BEFORE UPDATE ON public.cash_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Cash: admin or own" ON public.cash_submissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR collector_id = auth.uid());

-- =========================
-- AUDIT LOG
-- =========================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_created ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_entity ON public.audit_log(entity, entity_id);

CREATE POLICY "Audit: admin read" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.write_audit(
  _action TEXT, _entity TEXT, _entity_id UUID,
  _old JSONB, _new JSONB, _reason TEXT
) RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_log(actor_id, action, entity, entity_id, old_data, new_data, reason)
  VALUES (auth.uid(), _action, _entity, _entity_id, _old, _new, _reason);
$$;

-- =========================
-- CREATE RECEIPT RPC (sequential, locked)
-- =========================
CREATE OR REPLACE FUNCTION public.create_receipt(
  _customer_id UUID,
  _amount NUMERIC,
  _payment_type public.payment_type DEFAULT 'cash',
  _note TEXT DEFAULT NULL
) RETURNS public.receipts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _is_admin BOOLEAN;
  _year INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  _next BIGINT;
  _no TEXT;
  _row public.receipts;
  _ptype public.payment_type := _payment_type;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;

  _is_admin := public.has_role(_uid,'admin');
  IF NOT _is_admin AND NOT public.has_role(_uid,'collector') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  -- Collectors can only create cash
  IF NOT _is_admin AND _ptype <> 'cash' THEN _ptype := 'cash'; END IF;

  -- lock year row
  INSERT INTO public.receipt_sequence(year, last_no) VALUES (_year, 0)
    ON CONFLICT (year) DO NOTHING;
  UPDATE public.receipt_sequence SET last_no = last_no + 1
    WHERE year = _year RETURNING last_no INTO _next;
  _no := 'FN-' || _year::TEXT || '-' || LPAD(_next::TEXT, 6, '0');

  INSERT INTO public.receipts(
    receipt_no, year, seq, customer_id, amount, payment_type,
    collector_id, created_by, note
  ) VALUES (
    _no, _year, _next, _customer_id, _amount, _ptype,
    CASE WHEN _ptype = 'cash' THEN _uid ELSE NULL END,
    _uid, _note
  ) RETURNING * INTO _row;

  PERFORM public.write_audit('create','receipt', _row.id, NULL, to_jsonb(_row), NULL);
  RETURN _row;
END; $$;

-- =========================
-- ADMIN MODIFY RECEIPT (edit / cancel)
-- =========================
CREATE OR REPLACE FUNCTION public.admin_update_receipt(
  _id UUID, _amount NUMERIC, _payment_type public.payment_type,
  _note TEXT, _reason TEXT
) RETURNS public.receipts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _old public.receipts; _new public.receipts;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'Reason required'; END IF;
  SELECT * INTO _old FROM public.receipts WHERE id = _id;
  IF _old.id IS NULL THEN RAISE EXCEPTION 'Receipt not found'; END IF;
  IF _old.status = 'cancelled' THEN RAISE EXCEPTION 'Cancelled receipts cannot be edited'; END IF;
  UPDATE public.receipts
    SET amount = _amount, payment_type = _payment_type, note = _note
    WHERE id = _id RETURNING * INTO _new;
  PERFORM public.write_audit('update','receipt', _id, to_jsonb(_old), to_jsonb(_new), _reason);
  RETURN _new;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_cancel_receipt(_id UUID, _reason TEXT)
RETURNS public.receipts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _old public.receipts; _new public.receipts;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'Reason required'; END IF;
  SELECT * INTO _old FROM public.receipts WHERE id = _id;
  IF _old.id IS NULL THEN RAISE EXCEPTION 'Receipt not found'; END IF;
  UPDATE public.receipts SET status = 'cancelled', cancelled_reason = _reason
    WHERE id = _id RETURNING * INTO _new;
  PERFORM public.write_audit('cancel','receipt', _id, to_jsonb(_old), to_jsonb(_new), _reason);
  RETURN _new;
END; $$;

-- =========================
-- CUSTOMER UPSERT (admin)
-- =========================
CREATE OR REPLACE FUNCTION public.admin_upsert_customer(
  _id UUID, _full_name TEXT, _phone TEXT, _address TEXT, _area TEXT,
  _monthly_bill NUMERIC, _billing_day INTEGER, _status public.customer_status,
  _opening_balance NUMERIC, _notes TEXT
) RETURNS public.customers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.customers; _old public.customers;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.customers(
      customer_no, full_name, phone, address, area, monthly_bill,
      billing_day, status, opening_balance, notes, created_by
    ) VALUES (
      public.next_customer_no(), _full_name, _phone, _address, _area,
      COALESCE(_monthly_bill,0), COALESCE(_billing_day,1),
      COALESCE(_status,'active'), COALESCE(_opening_balance,0), _notes, auth.uid()
    ) RETURNING * INTO _row;
    PERFORM public.write_audit('create','customer', _row.id, NULL, to_jsonb(_row), NULL);
  ELSE
    SELECT * INTO _old FROM public.customers WHERE id = _id;
    UPDATE public.customers SET
      full_name = _full_name, phone = _phone, address = _address, area = _area,
      monthly_bill = COALESCE(_monthly_bill,0), billing_day = COALESCE(_billing_day,1),
      status = COALESCE(_status,'active'), opening_balance = COALESCE(_opening_balance,0),
      notes = _notes
      WHERE id = _id RETURNING * INTO _row;
    PERFORM public.write_audit('update','customer', _id, to_jsonb(_old), to_jsonb(_row), NULL);
  END IF;
  RETURN _row;
END; $$;

-- =========================
-- BALANCE CALCULATION
-- Bills accrued = monthly_bill * months since first billing day on/after created_at (capped at current month)
-- Balance = opening_balance + bills_accrued - sum(active receipts)
-- =========================
CREATE OR REPLACE FUNCTION public.customer_bills_accrued(_c public.customers)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE _start DATE; _today DATE := current_date; _months INTEGER;
BEGIN
  _start := date_trunc('month', _c.created_at)::date
            + (_c.billing_day - 1) * INTERVAL '1 day';
  IF _start::date > _today THEN RETURN 0; END IF;
  _months := ((EXTRACT(YEAR FROM _today) - EXTRACT(YEAR FROM _start))*12
            + (EXTRACT(MONTH FROM _today) - EXTRACT(MONTH FROM _start)))::INTEGER + 1;
  IF EXTRACT(DAY FROM _today)::INTEGER < _c.billing_day THEN _months := _months - 1; END IF;
  IF _months < 0 THEN _months := 0; END IF;
  RETURN _c.monthly_bill * _months;
END; $$;

CREATE OR REPLACE VIEW public.customer_balances AS
SELECT
  c.id AS customer_id,
  c.customer_no,
  c.full_name,
  c.phone,
  c.area,
  c.status,
  c.monthly_bill,
  c.billing_day,
  c.opening_balance,
  public.customer_bills_accrued(c) AS bills_accrued,
  COALESCE((SELECT SUM(amount) FROM public.receipts r
            WHERE r.customer_id = c.id AND r.status='active'),0) AS total_paid,
  c.opening_balance + public.customer_bills_accrued(c)
    - COALESCE((SELECT SUM(amount) FROM public.receipts r
                WHERE r.customer_id = c.id AND r.status='active'),0) AS balance
FROM public.customers c;
GRANT SELECT ON public.customer_balances TO authenticated;

-- =========================
-- CASH SUBMISSION RPCs
-- =========================
CREATE OR REPLACE FUNCTION public.collector_expected_cash(_uid UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(r.amount),0)
  FROM public.receipts r
  WHERE r.collector_id = _uid
    AND r.payment_type = 'cash'
    AND r.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.cash_submissions s
      WHERE s.collector_id = _uid
        AND s.status = 'verified'
        AND s.verified_at >= r.created_at
    )
    AND r.created_at > COALESCE((
      SELECT MAX(verified_at) FROM public.cash_submissions
      WHERE collector_id = _uid AND status='verified'
    ), '1970-01-01'::timestamptz);
$$;

CREATE OR REPLACE FUNCTION public.submit_cash(_declared NUMERIC, _notes TEXT)
RETURNS public.cash_submissions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _expected NUMERIC; _row public.cash_submissions;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(_uid,'collector') THEN RAISE EXCEPTION 'Only collectors submit cash'; END IF;
  _expected := public.collector_expected_cash(_uid);
  INSERT INTO public.cash_submissions(collector_id, expected_amount, declared_amount, notes)
    VALUES (_uid, _expected, _declared, _notes) RETURNING * INTO _row;
  PERFORM public.write_audit('submit','cash_submission', _row.id, NULL, to_jsonb(_row), NULL);
  RETURN _row;
END; $$;

CREATE OR REPLACE FUNCTION public.verify_cash(_id UUID, _received NUMERIC, _notes TEXT)
RETURNS public.cash_submissions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _old public.cash_submissions; _new public.cash_submissions;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO _old FROM public.cash_submissions WHERE id = _id;
  IF _old.id IS NULL THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF _old.status = 'verified' THEN RAISE EXCEPTION 'Already verified'; END IF;
  UPDATE public.cash_submissions SET
    received_amount = _received,
    difference = _received - _old.expected_amount,
    status = 'verified',
    verified_by = auth.uid(),
    verified_at = now(),
    notes = COALESCE(_notes, notes)
    WHERE id = _id RETURNING * INTO _new;
  PERFORM public.write_audit('verify','cash_submission', _id, to_jsonb(_old), to_jsonb(_new), _notes);
  RETURN _new;
END; $$;

-- =========================
-- ADMIN STAFF MGMT (assign role)
-- =========================
CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id UUID, _role public.app_role)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, _role)
    ON CONFLICT DO NOTHING;
  PERFORM public.write_audit('grant_role','user_role', _user_id, NULL,
    jsonb_build_object('role', _role), NULL);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_revoke_role(_user_id UUID, _role public.app_role)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _role = 'admin' AND _user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot revoke your own admin role'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  PERFORM public.write_audit('revoke_role','user_role', _user_id, NULL,
    jsonb_build_object('role', _role), NULL);
END; $$;

-- View of staff (profiles + roles), admin only via function
CREATE OR REPLACE FUNCTION public.list_staff()
RETURNS TABLE (id UUID, full_name TEXT, phone TEXT, active BOOLEAN, roles public.app_role[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.phone, p.active,
    COALESCE(ARRAY_AGG(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE public.has_role(auth.uid(),'admin')
  GROUP BY p.id;
$$;
