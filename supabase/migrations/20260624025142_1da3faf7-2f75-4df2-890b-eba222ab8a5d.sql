GRANT EXECUTE ON FUNCTION public.customer_bills_accrued(public.customers) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;