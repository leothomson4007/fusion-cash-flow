
# Fusion Net — ISP Billing & Cash Collection

A mobile-first internal app for a small ISP (≤600 customers). Two roles (Admin, Collector), strict sequential receipts, partial payments with running balances, cash submission/verification, and an immutable audit log.

## Stack & foundation
- TanStack Start + Tailwind v4, shadcn/ui, **Trust Blue** theme (primary `#1E6FD9`, deep `#0B3D91`, success `#16A34A`, surface `#F4F7FB`).
- Lovable Cloud for DB + auth (email/password). Admin pre-seeded; admin creates collector accounts via Edge Function (service role).
- Currency: PKR `Rs. 2,500` formatting helper.
- Mobile-first layout: bottom-nav on phones, sidebar on desktop. Large tap targets.

## Database (Cloud / Postgres + RLS)
- `profiles` — id (auth.users), full_name, phone, active.
- `user_roles` — (user_id, role enum: admin | collector). `has_role()` security-definer fn.
- `customers` — customer_no (FN-Cxxxx, unique), name, phone, address, area, monthly_bill, billing_day (1–28), status, created_by, timestamps.
- `receipts` — id, **receipt_no** (`FN-YYYY-000001`, unique, sequential), customer_id, amount, payment_type (`cash|bank|easypaisa|jazzcash`), status (`active|cancelled`), cancelled_reason, collector_id, created_by, created_at.
  - Sequence generated via a Postgres function + `receipt_sequence` table per year, inside a `SECURITY DEFINER` RPC so collectors never set the number. Unique constraint + gap-detection view.
- `cash_submissions` — collector_id, expected_amount (sum of their active cash receipts since last submission), declared_amount, received_amount (admin), status (`pending|verified`), difference, verified_by, timestamps.
- `audit_log` — actor_id, action, entity, entity_id, old_data jsonb, new_data jsonb, created_at. Triggers on receipts, customers, cash_submissions. Insert-only RLS.
- Running balance per customer = sum(active bills generated) − sum(active receipts). Monthly bill rows auto-created by a Postgres function `generate_monthly_bills()` invoked on demand from admin dashboard + on customer login of cycle date check.

### RLS summary
- Admin: full select/insert/update where policies use `has_role(uid,'admin')`.
- Collector: select own profile, select customers (read-only list), insert receipts (only as themselves, payment_type forced to `cash` via trigger), select own receipts + own cash submissions.
- No deletes anywhere; cancel = update status with reason (admin-only, audit-logged).

## Routes
```
/auth                       login
/_authenticated/
  index                     role-based redirect
  admin/
    dashboard               KPIs + today's collection + collector perf
    customers               list + search + create/edit/deactivate
    customers/$id           detail + payment history + balance
    receipts                all receipts + filter, edit/cancel
    receipts/new            admin-create receipt (any payment type)
    cash                    submissions queue + verify
    audit                   audit log viewer
    reports                 daily cash, unpaid, missing receipts, monthly revenue, collector perf
    staff                   create/manage collectors
  collector/
    dashboard               today's receipts, total, submit cash button
    new-receipt             fast customer search → amount → confirm
    history                 my receipts (read-only)
    submit-cash             declare amount, see expected, submit
```

## Receipt flow (anti-fraud)
1. Collector taps **New Receipt** → searches customer → enters amount.
2. Client calls server fn → server fn calls `create_receipt()` RPC (SECURITY DEFINER): locks sequence row, generates `FN-YYYY-NNNNNN`, inserts receipt, writes audit row. Returns full receipt.
3. UI shows printable/share-ready receipt; immediately locked (no edits for collector).
4. Admin edit/cancel goes through `admin_modify_receipt()` RPC requiring reason; writes audit diff.
5. **Missing-receipt report**: query joins sequence range against existing numbers to flag any gap (should be impossible by design but reported for assurance).

## Cash reconciliation
- Collector dashboard shows: today's receipt count, total cash, last submission status.
- **Submit Cash** computes expected = sum of own active cash receipts since last verified submission, collector declares amount, creates `pending` submission.
- Admin **Cash** page lists pending → enters received amount → system computes difference (Match / Shortage / Excess) → marks verified. Audit-logged.

## Dashboards & reports
- Admin KPIs: total/active customers, MRR (sum monthly_bill of active), today's collection, outstanding balance, collector leaderboard.
- Collector KPI cards + recent receipts list.
- Reports use server fns returning aggregated data; CSV export for each.

## Audit log
- DB triggers on insert/update of receipts, customers, cash_submissions write to `audit_log` with `to_jsonb(OLD)` / `to_jsonb(NEW)` + `auth.uid()`. Admin-only read; nobody can update/delete.

## UI/design system
- Tokens in `src/styles.css` (oklch): background `#F4F7FB`, primary `#1E6FD9`, primary-deep `#0B3D91`, success `#16A34A`, warning amber, destructive. Card shadows, rounded-xl, generous spacing.
- Font: Inter (via @fontsource).
- Components: KPI cards, data tables (TanStack-style), money display, receipt card (printable), status badges, mobile bottom nav, sticky FAB for "New Receipt" on collector.

## Build order
1. Enable Cloud + email auth, theme + layout shell + auth page + role-routing + sidebar/bottom-nav.
2. Migrations: profiles, user_roles, has_role, customers, receipts + sequence RPC, cash_submissions, audit_log + triggers, RLS, GRANTs.
3. Admin: staff mgmt (edge fn for creating collector users), customers CRUD, customer detail + balance.
4. Collector: new-receipt flow, history, submit-cash.
5. Admin: receipts list + edit/cancel, cash verification, audit viewer.
6. Dashboards + reports (CSV export, missing receipt detector).
7. Polish, mobile pass, seed first admin instructions.

## Notes / constraints
- First admin: after signup the user runs a one-time "Claim admin" action only allowed when no admin exists yet; afterwards locked.
- Collectors are created by admin via edge function using service role (no public signup).
- All money stored as integer paisa? → keep as numeric(12,2) PKR for simplicity; format with `Rs.` helper.
- Strict: no physical deletes, sequential numbering enforced server-side, all mutations audit-logged.

Ready to build on approval.
