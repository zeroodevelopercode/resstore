// Supabase Edge Function: admin-users
// Aksi admin yang butuh kunci service_role (tidak boleh ada di browser):
//   { "action": "set_password", "user_id": "...", "password": "..." }
//   { "action": "delete_user",  "user_id": "..." }
//
// Cara pasang (tanpa CLI):
//  1. Supabase Dashboard -> Edge Functions -> buat function bernama "admin-users",
//     tempel isi file ini lewat editor di dashboard.
//  2. SUPABASE_URL, SUPABASE_ANON_KEY, dan SUPABASE_SERVICE_ROLE_KEY sudah tersedia otomatis
//     di dalam Edge Function, jadi tidak perlu menambah secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  // Pemanggil harus login DAN berperan admin
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json({ error: "Harus login" }, 401);
  const { data: me } = await caller.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return json({ error: "Hanya admin" }, 403);

  let body: { action?: string; user_id?: string; password?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "Permintaan tidak valid" }, 400); }

  const target = String(body.user_id ?? "");
  if (!UUID.test(target)) return json({ error: "ID akun tidak valid" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: t } = await admin.from("profiles").select("username, role").eq("id", target).maybeSingle();
  if (!t) return json({ error: "Akun tidak ditemukan" }, 404);

  if (body.action === "set_password") {
    const pw = String(body.password ?? "");
    if (pw.length < 10 || pw.length > 72) return json({ error: "Password 10 sampai 72 karakter" }, 400);
    if (t.role === "admin" && target !== user.id) return json({ error: "Password admin lain tidak bisa diubah dari sini" }, 403);
    const { error } = await admin.auth.admin.updateUserById(target, { password: pw });
    if (error) return json({ error: error.message }, 400);
    await admin.from("activity_log").insert({
      action: "password_reset", actor: user.id, target_user: target, target_type: "user", target_id: target,
    });
    return json({ ok: true });
  }

  if (body.action === "delete_user") {
    if (target === user.id) return json({ error: "Tidak bisa menghapus akunmu sendiri" }, 403);
    if (t.role === "admin") return json({ error: "Admin tidak bisa dihapus. Turunkan perannya dulu." }, 403);
    await admin.from("activity_log").insert({
      action: "user_delete", actor: user.id, target_type: "user", target_id: target, detail: { username: t.username },
    });
    const { error } = await admin.auth.admin.deleteUser(target);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "Aksi tidak dikenal" }, 400);
});
