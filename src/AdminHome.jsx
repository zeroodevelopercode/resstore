import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { rpc } from "./adminApi.js";

const kartu = [
  ["users", "Akun terdaftar"], ["new_users_24h", "Akun baru (24 jam)"],
  ["verified", "Terverifikasi"], ["resellers", "Reseller"],
  ["admins", "Admin"], ["banned", "Sedang dibanned"],
  ["posts", "Postingan aktif"], ["takedown", "Di-takedown"],
  ["likes", "Total suka"], ["stories", "Cerita aktif"],
];

export default function AdminHome() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    rpc("admin_stats").then(setS).catch((e) => setErr(e.message));
  }, []);

  return (
    <>
      <h2 className="adm-h">Ringkasan</h2>
      {err && <p className="error">{err}. Pastikan schema-admin.sql sudah dijalankan.</p>}
      {!s && !err && <p className="muted">Memuat...</p>}
      {s && (
        <div className="adm-grid">
          {kartu.map(([k, label]) => (
            <div className="adm-stat" key={k}>
              <b>{(s[k] ?? 0).toLocaleString("id-ID")}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="adm-links">
        <Link to="/admin/users">Kelola pengguna, verifikasi, peran, dan ban</Link>
        <Link to="/admin/banned">Daftar akun yang dibanned</Link>
        <Link to="/admin/posts">Periksa postingan, suka, dan takedown</Link>
        <Link to="/admin/logs">Log aktivitas</Link>
        <Link to="/agent">Agent AI (khusus owner)</Link>
      </div>
      <p className="muted adm-foot">Isi chat pribadi tidak bisa dibaca admin. Password pengguna tersimpan terenkripsi dan tidak bisa dilihat siapa pun.</p>
    </>
  );
}
