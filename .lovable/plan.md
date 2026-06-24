## Remaining issues (from the security scan)

Six findings are still open. The previous turn discussed them but no migration was actually applied — the latest migration is still `20260622053907_…`. Here's what's wrong and how I'll fix each.

### 1. `has_role_no_search_path_bypass` — ERROR (privilege escalation)
`public.user_roles` has no write-restriction policy, so any signed-in user could `INSERT` themselves an `admin` row, and `has_role()` would then return true. This is the most serious finding.

**Fix:** Add strict RLS on `user_roles`:
- `SELECT`: only admins, or the row owner reading their own roles.
- `INSERT / UPDATE / DELETE`: admins only (`WITH CHECK (has_role(auth.uid(),'admin'))`).
- Keep `admin_set_role` / `admin_revoke_role` as the only sanctioned write path (they're SECURITY DEFINER and already gate on `has_role`).

### 2. `customers_all_authenticated_read` — WARN (PII exposure)
Current SELECT policy lets every signed-in user (including collectors) read every customer's phone, address, balance.

**Fix:** Replace the broad policy with two scoped ones:
- Admins: full SELECT.
- Collectors: SELECT only on `status = 'active'` rows, and project sensitive columns through a view (`customer_directory`) that omits `notes`, `opening_balance`, `address` — collectors need name / phone / area / monthly_bill / balance to collect cash, nothing more.
- Update `src/routes/app.collector.*` and `src/components/customer-search.tsx` to read from `customer_directory` instead of `customers` / `customer_balances` where applicable. Admin screens keep reading `customers` / `customer_balances` unchanged.

### 3. `receipts_all_authenticated_read` — WARN (financial exposure)
Same shape: every signed-in user can read every receipt.

**Fix:** Replace the SELECT policy with:
- Admins: full SELECT.
- Collectors: SELECT only where `collector_id = auth.uid()` OR `created_by = auth.uid()`.

Collector history / dashboard already filter by `collector_id`, so no UI change is needed beyond verifying queries still return rows under the new policy.

### 4. `realtime_messages_no_rls` — ERROR
`realtime.messages` has no RLS, so any signed-in user can subscribe to any topic and receive broadcasts for `customers` / `receipts` / `cash_submissions`.

**Fix:** Enable RLS on `realtime.messages` and add a policy that only allows subscription when `has_role(auth.uid(),'admin')` — the only place we use realtime today is the admin dashboard via `useRealtimeInvalidate`. Collectors don't subscribe, so this is safe. If we later need collector realtime, we'll scope by topic name.

### 5 & 6. `SUPA_anon_security_definer_function_executable` and `SUPA_authenticated_security_definer_function_executable` — WARN
Postgres' default `GRANT EXECUTE … TO public` exposes every SECURITY DEFINER function to both `anon` and `authenticated`, even ones meant to be called only by admins or only server-side.

**Fix:** For every function in `public`:
1. `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated;`
2. Re-grant narrowly:
   - `claim_first_admin`, `current_user_role`, `submit_cash`, `create_receipt`, `admin_exists`, `has_role`, `list_staff` → `GRANT EXECUTE … TO authenticated` (these are legitimately user-callable; SECURITY DEFINER bodies already enforce role checks).
   - `admin_*` (`admin_set_role`, `admin_revoke_role`, `admin_upsert_customer`, `admin_delete_customer`, `admin_restore_customer`, `admin_update_receipt`, `admin_cancel_receipt`, `verify_cash`) → `GRANT EXECUTE … TO authenticated` (their bodies all check `has_role(auth.uid(),'admin')`; revoking from public + keeping authenticated is what the linter expects, since the role check is in the body).
   - `handle_new_user`, `touch_updated_at`, `write_audit`, `next_customer_no`, `customer_bills_accrued`, `collector_expected_cash` → no grant to `anon`/`authenticated` (only triggers / other definer functions call them).

This is the standard remediation for linter lints 0028/0029.

## Deliverable

One migration `supabase/migrations/<ts>_security_hardening.sql` covering all six fixes, plus:
- New view `public.customer_directory` with `security_invoker=on` and appropriate GRANTs.
- Small edits in `src/components/customer-search.tsx` and any collector route currently selecting from `customers` directly, switching to `customer_directory`.
- After applying, call `manage_security_finding` with `mark_as_fixed` on all six `internal_id`s and update `@security-memory` with the new posture (admin-only realtime, role-scoped customer/receipt reads, locked-down definer grants).

## Technical notes

- The `realtime.messages` policy uses `realtime.topic()` for topic-aware checks if we later need per-topic scoping; the initial admin-only policy is simpler and matches current usage.
- Revoking `EXECUTE` from `PUBLIC` is what clears the linter — re-granting to `authenticated` is fine because the body-level `has_role` check is the real authorization boundary.
- No data migration needed; only policies, grants, and one view.

Shall I proceed?