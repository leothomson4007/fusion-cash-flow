## Root cause

Yesterday's grants migration removed `EXECUTE` from two functions that are still called via the Data API:

1. **`customer_bills_accrued(customers)`** — referenced inside the `customer_balances` view. When `authenticated` queries the view, PostgREST evaluates the function and now returns `42501 permission denied for function customer_bills_accrued`. This is why **customers** and **dashboard balances** fail.
2. **`admin_exists()`** — called from `/auth` to decide whether to show "Claim first admin". Anon users hit it pre-login, so we need it granted to `anon` (not just `authenticated`). Right now anon gets `42501 permission denied for function admin_exists`.

Both are read-only and safe to expose:
- `customer_bills_accrued` is `IMMUTABLE`, takes a `customers` row, returns a number — no data leak, the view's own RLS still gates access.
- `admin_exists` only returns a boolean ("does any admin exist?") — needed before login.

## Fix (single small migration)

```sql
GRANT EXECUTE ON FUNCTION public.customer_bills_accrued(public.customers) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;
```

No code changes needed. After this, `customer_balances` reads succeed for authenticated users and `/auth` works for anon.

## Why this doesn't reopen the security findings

- `customer_bills_accrued` is `IMMUTABLE` and only computes a derived number from the row passed in. It exposes nothing the caller can't already see via the `customers` RLS policy.
- `admin_exists` is intentionally public — the auth page needs it before sign-in. It returns one boolean.

Security memory will be updated to record these two as intentionally exposed.