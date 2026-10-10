import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" }
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) return json({ error: "Server configuration missing" }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication required" }, 401);

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: callerData, error: callerError } = await admin.auth.getUser(token);
    const caller = callerData.user;
    if (callerError || !caller) return json({ error: "Invalid session" }, 401);

    const { data: profile, error: profileError } = await admin
      .from("user_profiles")
      .select("id,role,is_active")
      .eq("id", caller.id)
      .single();

    if (profileError || !profile || profile.role !== "owner" || !profile.is_active) {
      return json({ error: "Owner access required" }, 403);
    }

    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "create") {
      const email = String(body?.email || "").trim().toLowerCase();
      const password = String(body?.password || "");
      const fullName = String(body?.full_name || "").trim();
      const role = String(body?.role || "salesperson");
      const isActive = body?.is_active !== false;

      if (!email || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Valid email required" }, 400);
      if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
      if (!fullName) return json({ error: "Full name required" }, 400);
      if (!["owner", "manager", "salesperson"].includes(role)) return json({ error: "Invalid role" }, 400);

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      });
      if (createError || !created.user) return json({ error: createError?.message || "Could not create staff login" }, 400);

      const userId = created.user.id;
      const { error: insertError } = await admin
        .from("user_profiles")
        .insert({ id: userId, full_name: fullName, role, is_active: isActive });

      if (insertError) {
        await admin.auth.admin.deleteUser(userId).catch(() => {});
        return json({ error: insertError.message }, 400);
      }

      return json({ id: userId, email, full_name: fullName, role, is_active: isActive });
    }

    if (action === "delete") {
      const userId = String(body?.user_id || "");
      if (!userId) return json({ error: "Staff user ID required" }, 400);
      if (userId === caller.id) return json({ error: "You cannot delete your own owner account" }, 400);

      const { data: target, error: targetError } = await admin
        .from("user_profiles")
        .select("id,role")
        .eq("id", userId)
        .single();

      if (targetError || !target) return json({ error: "Staff profile not found" }, 404);

      if (target.role === "owner") {
        const { count } = await admin
          .from("user_profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "owner")
          .eq("is_active", true);
        if ((count || 0) <= 1) return json({ error: "The last active owner cannot be deleted" }, 400);
      }

      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError) return json({ error: deleteError.message }, 400);

      return json({ deleted: true, id: userId });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, 500);
  }
});
