import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Admin creates a collector (or another admin) user.
export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; fullName: string; phone?: string; role: "admin" | "collector" }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone ?? null },
    });
    if (error) throw new Error(error.message);
    const uid = created.user?.id;
    if (!uid) throw new Error("User creation failed");

    // profile auto-created via trigger; ensure phone/name persisted
    await supabaseAdmin.from("profiles")
      .update({ full_name: data.fullName, phone: data.phone ?? null })
      .eq("id", uid);

    // assign role
    const { error: rerr } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    if (rerr && !rerr.message.includes("duplicate")) throw new Error(rerr.message);

    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "create_user",
      entity: "user",
      entity_id: uid,
      new_data: { email: data.email, full_name: data.fullName, role: data.role },
    });

    return { id: uid, email: data.email };
  });

export const adminResetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; newPassword: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.newPassword });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId, action: "reset_password", entity: "user", entity_id: data.userId,
    });
    return { ok: true };
  });
