import { supabase } from "./supabase.js";

// Memanggil fungsi database milik admin
export async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

// Edge Function admin-users (butuh kunci service_role yang hanya ada di server)
export async function adminFn(body) {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) {
    let msg = "Edge Function admin-users belum dipasang atau gagal dijalankan.";
    try {
      const j = await error.context.json();
      if (j?.error) msg = j.error;
    } catch { /* abaikan */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const waktu = (iso) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "-";
export const permanen = (iso) => new Date(iso).getFullYear() >= 9000;
export const sampai = (iso) => (permanen(iso) ? "Permanen" : waktu(iso));
export const labelPeran = (r) => (r === "admin" ? "Admin" : r === "reseller" ? "Reseller" : "Pengguna");
