import { useCallback, useEffect, useState } from "react";
import { rpc, labelPeran } from "./adminApi.js";
import Avatar from "./Avatar.jsx";
import Badge from "./Badge.jsx";
import AdminUserSheet from "./AdminUserSheet.jsx";

const HALAMAN = 30;

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(null);

  const muat = useCallback(async (cari, offset, tambah) => {
    setLoading(true);
    setErr("");
    try {
      const data = await rpc("admin_list_users", { p_search: cari, p_limit: HALAMAN, p_offset: offset });
      setRows((lama) => (tambah ? [...lama, ...data] : data));
      setMore(data.length >= HALAMAN);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => muat(q.trim(), 0, false), 300);
    return () => clearTimeout(t);
  }, [q, muat]);

  return (
    <>
      <h2 className="adm-h">Pengguna</h2>
      <input className="input" type="search" placeholder="Cari username, nama, atau email"
        value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} />

      {err && <p className="error">{err}. Pastikan schema-admin.sql sudah dijalankan.</p>}

      <div className="adm-list">
        {rows.map((u) => {
          const banned = u.ban_until && new Date(u.ban_until) > new Date();
          return (
            <button type="button" className="adm-row" key={u.id} onClick={() => setSel(u)}>
              <Avatar user={u} />
              <div className="adm-row-body">
                <b>{u.username}<Badge role={u.role} verified={u.verified} /></b>
                <small>{u.email}</small>
              </div>
              <div className="adm-pills">
                {u.role !== "user" && <span className="pill teal">{labelPeran(u.role)}</span>}
                {u.verified && <span className="pill">Verified</span>}
                {banned && <span className="pill red">Banned</span>}
                {!u.email_confirmed && <span className="pill">Belum konfirmasi</span>}
              </div>
            </button>
          );
        })}
      </div>

      {loading && <p className="muted adm-foot">Memuat...</p>}
      {!loading && rows.length === 0 && !err && <p className="muted adm-foot">Tidak ada akun yang cocok.</p>}
      {!loading && more && (
        <button type="button" className="btn ghost full" onClick={() => muat(q.trim(), rows.length, true)}>Muat lebih banyak</button>
      )}

      {sel && (
        <AdminUserSheet user={sel} onClose={() => setSel(null)}
          onChanged={() => muat(q.trim(), 0, false)} />
      )}
    </>
  );
}
