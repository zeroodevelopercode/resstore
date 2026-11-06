import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { rpc, sampai, waktu } from "./adminApi.js";
import Avatar from "./Avatar.jsx";
import Badge from "./Badge.jsx";

// Halaman khusus untuk melihat akun yang dibanned
export default function AdminBanned() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(null);

  const muat = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bans")
      .select("user_id,until,reason,banned_at,profiles!bans_user_id_fkey(username,avatar_url,role,verified),oleh:profiles!bans_banned_by_fkey(username)")
      .order("banned_at", { ascending: false })
      .limit(200);
    if (error) setErr(error.message); else setErr("");
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { muat(); }, [muat]);

  async function cabut(r) {
    if (!window.confirm(`Cabut ban untuk ${r.profiles?.username}?`)) return;
    setBusy(r.user_id);
    try { await rpc("admin_unban", { p_user: r.user_id }); await muat(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  }

  const sekarang = new Date();
  const aktif = rows.filter((r) => new Date(r.until) > sekarang);
  const lewat = rows.filter((r) => new Date(r.until) <= sekarang);

  const Baris = ({ r, bisaCabut }) => (
    <div className="adm-card" key={r.user_id}>
      <div className="adm-card-top">
        <Avatar user={r.profiles} />
        <div className="adm-row-body">
          <b>{r.profiles?.username || "akun"}<Badge role={r.profiles?.role} verified={r.profiles?.verified} /></b>
          <small>{bisaCabut ? `Sampai ${sampai(r.until)}` : `Berakhir ${waktu(r.until)}`}</small>
        </div>
        {bisaCabut && (
          <button type="button" className="btn ghost sm" disabled={busy === r.user_id} onClick={() => cabut(r)}>
            {busy === r.user_id ? "..." : "Cabut ban"}
          </button>
        )}
      </div>
      <p className="adm-reason">{r.reason}</p>
      <small className="muted">Dibanned {waktu(r.banned_at)}{r.oleh?.username ? ` oleh ${r.oleh.username}` : ""}</small>
    </div>
  );

  return (
    <>
      <h2 className="adm-h">Akun dibanned</h2>
      {err && <p className="error">{err}</p>}
      {loading && <p className="muted">Memuat...</p>}
      {!loading && aktif.length === 0 && <p className="muted">Tidak ada akun yang sedang dibanned.</p>}
      <div className="adm-list">{aktif.map((r) => <Baris key={r.user_id} r={r} bisaCabut />)}</div>

      {lewat.length > 0 && (
        <>
          <h3 className="adm-h2">Ban yang sudah berakhir</h3>
          <div className="adm-list">{lewat.map((r) => <Baris key={r.user_id} r={r} />)}</div>
        </>
      )}
    </>
  );
}
