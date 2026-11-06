import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { waktu } from "./adminApi.js";

const HALAMAN = 40;
const FILTER = [
  { id: "all", label: "Semua", aksi: null },
  { id: "post", label: "Postingan", aksi: ["post_create", "post_delete", "takedown", "restore"] },
  { id: "like", label: "Suka", aksi: ["like", "unlike"] },
  { id: "story", label: "Cerita", aksi: ["story_create", "story_delete"] },
  { id: "akun", label: "Akun", aksi: ["signup", "verify", "unverify", "role_change", "password_reset", "user_delete"] },
  { id: "mod", label: "Moderasi", aksi: ["takedown", "restore", "ban", "unban", "role_change", "verify", "unverify", "password_reset", "user_delete"] },
];

const nm = (p) => (p?.username ? `@${p.username}` : "akun yang sudah dihapus");

// Mengubah satu baris log menjadi kalimat
function jelaskan(r) {
  const a = nm(r.actor);
  const t = nm(r.target);
  const id = r.target_id;
  const d = r.detail || {};
  switch (r.action) {
    case "signup": return `${a} mendaftar`;
    case "post_create": return `${a} membuat postingan #${id}${d.caption ? `: “${d.caption}”` : ""}`;
    case "post_delete": return d.by_admin ? `${a} menghapus postingan #${id} milik ${t}` : `${a} menghapus postingannya #${id}`;
    case "like": return `${a} menyukai postingan #${id} milik ${t}`;
    case "unlike": return `${a} membatalkan suka di postingan #${id} milik ${t}`;
    case "story_create": return `${a} membuat cerita`;
    case "story_delete": return d.by_admin ? `${a} menghapus cerita milik ${t}` : `${a} menghapus ceritanya`;
    case "takedown": return `${a} men-takedown postingan #${id} milik ${t}. Alasan: ${d.reason || "-"}`;
    case "restore": return `${a} memulihkan postingan #${id} milik ${t}`;
    case "ban": return `${a} mem-ban ${t} (${d.until === "permanen" ? "permanen" : `sampai ${waktu(d.until)}`}). Alasan: ${d.reason || "-"}`;
    case "unban": return `${a} mencabut ban ${t}`;
    case "role_change": return `${a} mengubah peran ${t} dari ${d.from} menjadi ${d.to}`;
    case "verify": return `${a} memverifikasi ${t}`;
    case "unverify": return `${a} mencabut verifikasi ${t}`;
    case "password_reset": return `${a} mengganti password ${t}`;
    case "user_delete": return `${a} menghapus akun ${d.username ? `@${d.username}` : "pengguna"}`;
    default: return `${a}: ${r.action}`;
  }
}

export default function AdminLogs() {
  const [filter, setFilter] = useState("all");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState("");

  const muat = useCallback(async (f, dari, tambah) => {
    setLoading(true);
    let q = supabase
      .from("activity_log")
      .select("id,at,action,target_id,detail,actor:profiles!activity_log_actor_fkey(username),target:profiles!activity_log_target_user_fkey(username)")
      .order("at", { ascending: false })
      .range(dari, dari + HALAMAN - 1);
    const aksi = FILTER.find((x) => x.id === f).aksi;
    if (aksi) q = q.in("action", aksi);
    const { data, error } = await q;
    if (error) setErr(error.message); else setErr("");
    setRows((lama) => (tambah ? [...lama, ...(data || [])] : data || []));
    setMore((data || []).length >= HALAMAN);
    setLoading(false);
  }, []);

  useEffect(() => { muat(filter, 0, false); }, [filter, muat]);

  return (
    <>
      <h2 className="adm-h">Log aktivitas</h2>
      <div className="opts">
        {FILTER.map((f) => (
          <button key={f.id} type="button" className={"chip" + (filter === f.id ? " on" : "")}
            onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>

      {err && <p className="error">{err}. Pastikan schema-admin.sql sudah dijalankan.</p>}

      <div className="adm-logs">
        {rows.map((r) => (
          <div className="adm-log" key={r.id}>
            <time dateTime={r.at}>{waktu(r.at)}</time>
            <p>{jelaskan(r)}</p>
          </div>
        ))}
      </div>

      {loading && <p className="muted adm-foot">Memuat...</p>}
      {!loading && rows.length === 0 && !err && <p className="muted adm-foot">Belum ada aktivitas.</p>}
      {!loading && more && (
        <button type="button" className="btn ghost full" onClick={() => muat(filter, rows.length, true)}>Muat lebih banyak</button>
      )}
    </>
  );
}
