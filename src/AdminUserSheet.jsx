import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import Avatar from "./Avatar.jsx";
import Badge from "./Badge.jsx";
import useSheet from "./useSheet.js";
import { rpc, adminFn, waktu, sampai, labelPeran } from "./adminApi.js";
import "./admin.css";

const DURASI = [
  { id: "1h", label: "1 jam", ms: 3600e3 },
  { id: "6h", label: "6 jam", ms: 6 * 3600e3 },
  { id: "1d", label: "1 hari", ms: 86400e3 },
  { id: "7d", label: "7 hari", ms: 7 * 86400e3 },
  { id: "30d", label: "30 hari", ms: 30 * 86400e3 },
  { id: "perm", label: "Permanen", ms: null },
  { id: "custom", label: "Atur sendiri" },
];

function passwordAcak() {
  const huruf = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const acak = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(acak, (n) => huruf[n % huruf.length]).join("");
}

export default function AdminUserSheet({ user, onClose, onChanged }) {
  const { profile: me } = useAuth();
  const navigate = useNavigate();
  const [u, setU] = useState(user);
  const [mode, setMode] = useState("menu"); // menu | ban | role | password | delete
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [durasi, setDurasi] = useState("1d");
  const [custom, setCustom] = useState("");
  const [alasan, setAlasan] = useState("");
  const [pw, setPw] = useState("");
  const [pwBaru, setPwBaru] = useState("");
  const [konfirmasi, setKonfirmasi] = useState("");
  useSheet(onClose);

  const diriSendiri = u.id === me.id;
  const banned = u.ban_until && new Date(u.ban_until) > new Date();

  // Menjalankan satu aksi, lalu memperbarui tampilan lokal dan daftar di belakang
  async function jalankan(fn, pesan, patch) {
    setBusy(true); setErr(""); setInfo("");
    try {
      await fn();
      setInfo(pesan);
      if (patch) setU((x) => ({ ...x, ...patch }));
      onChanged();
      return true;
    } catch (e) {
      setErr(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const ubahVerifikasi = () =>
    jalankan(() => rpc("admin_set_verified", { p_user: u.id, p_verified: !u.verified }),
      u.verified ? "Verifikasi dicabut." : "Akun diverifikasi.", { verified: !u.verified });

  const ubahPeran = async (r) => {
    if (await jalankan(() => rpc("admin_set_role", { p_user: u.id, p_role: r }), `Peran diubah menjadi ${labelPeran(r)}.`, { role: r }))
      setMode("menu");
  };

  async function banAkun() {
    let sampaiIso = null;
    if (durasi === "custom") {
      const d = new Date(custom);
      if (!custom || isNaN(d) || d <= new Date()) return setErr("Pilih waktu berakhir di masa depan.");
      sampaiIso = d.toISOString();
    } else if (durasi !== "perm") {
      sampaiIso = new Date(Date.now() + DURASI.find((x) => x.id === durasi).ms).toISOString();
    }
    const ok = await jalankan(
      () => rpc("admin_ban", { p_user: u.id, p_until: sampaiIso, p_reason: alasan }),
      "Akun dibanned.",
      { ban_until: sampaiIso || "9999-12-31T23:59:59Z", ban_reason: alasan.trim() }
    );
    if (ok) { setMode("menu"); setAlasan(""); }
  }

  const cabutBan = () =>
    jalankan(() => rpc("admin_unban", { p_user: u.id }), "Ban dicabut.", { ban_until: null, ban_reason: null });

  async function simpanPassword() {
    if (pw.length < 10) return setErr("Password minimal 10 karakter.");
    const ok = await jalankan(() => adminFn({ action: "set_password", user_id: u.id, password: pw }), "Password diubah.");
    if (ok) { setPwBaru(pw); setPw(""); }
  }

  async function hapusAkun() {
    if (konfirmasi !== u.username) return setErr("Ketik username dengan benar untuk konfirmasi.");
    const ok = await jalankan(() => rpc("admin_delete_user", { p_user: u.id }), "Akun dihapus.");
    if (ok) onClose();
  }

  const baris = [
    ["ID", <span className="pecah">{u.id}</span>],
    ["Email", <>{u.email}{!u.email_confirmed && " (belum dikonfirmasi)"}</>],
    ["Nama", u.full_name || "-"],
    ["Peran", labelPeran(u.role)],
    ["Terverifikasi", u.verified ? "Ya" : "Tidak"],
    ["Terdaftar", waktu(u.created_at)],
    ["Login terakhir", u.last_sign_in_at ? waktu(u.last_sign_in_at) : "Belum pernah"],
    ["Postingan aktif", u.post_count],
    ["Suka diterima", u.likes_received],
    ["Status", banned ? `Dibanned sampai ${sampai(u.ban_until)}` : "Aktif"],
    ...(banned ? [["Alasan ban", u.ban_reason]] : []),
    ["Password", "Terenkripsi, tidak bisa dilihat siapa pun"],
  ];

  return createPortal(
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet adm-sheet" role="dialog" aria-modal="true" aria-label={`Akun ${u.username}`}
        onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>Akun</h2>
          <button type="button" className="link-btn" onClick={onClose}>Tutup</button>
        </div>

        <div className="adm-id">
          <Avatar user={u} className="lg" />
          <div>
            <b>{u.username}<Badge role={u.role} verified={u.verified} /></b>
            <small>{u.email}</small>
          </div>
        </div>

        <div className="adm-info">
          {baris.map(([k, v]) => (
            <div key={k}><span>{k}</span><span>{v}</span></div>
          ))}
        </div>

        {err && <p className="error" role="alert">{err}</p>}
        {info && <p className="adm-ok" role="status">{info}</p>}

        {mode === "menu" && (
          <div className="adm-actions">
            <button type="button" className="btn ghost" onClick={() => { onClose(); navigate(`/u/${u.username}`); }}>Lihat profil</button>
            <button type="button" className="btn ghost" disabled={busy} onClick={ubahVerifikasi}>
              {u.verified ? "Cabut verifikasi" : "Verifikasi akun"}
            </button>
            <button type="button" className="btn ghost" disabled={busy || diriSendiri} onClick={() => setMode("role")}>Ubah peran</button>
            {banned
              ? <button type="button" className="btn ghost" disabled={busy} onClick={cabutBan}>Cabut ban</button>
              : <button type="button" className="btn ghost" disabled={busy || diriSendiri || u.role === "admin"} onClick={() => setMode("ban")}>Ban akun</button>}
            <button type="button" className="btn ghost" disabled={busy} onClick={() => { setPw(passwordAcak()); setPwBaru(""); setMode("password"); }}>Atur password baru</button>
            <button type="button" className="btn ghost danger" disabled={busy || diriSendiri || u.role === "admin"} onClick={() => { setKonfirmasi(""); setMode("delete"); }}>Hapus akun</button>
            {diriSendiri && <p className="muted">Ini akunmu sendiri. Ubah peran, ban, dan hapus dinonaktifkan.</p>}
            {u.role === "admin" && !diriSendiri && <p className="muted">Admin tidak bisa dibanned atau dihapus. Turunkan perannya dulu.</p>}
          </div>
        )}

        {mode === "role" && (
          <div className="adm-form">
            <p className="muted">Pilih peran baru untuk {u.username}.</p>
            <div className="opts">
              {["user", "reseller", "admin"].map((r) => (
                <button key={r} type="button" className={"chip" + (u.role === r ? " on" : "")} disabled={busy || u.role === r}
                  onClick={() => ubahPeran(r)}>{labelPeran(r)}</button>
              ))}
            </div>
            <p className="muted">Admin memiliki akses penuh ke panel ini. Berikan dengan hati-hati.</p>
            <button type="button" className="btn ghost" onClick={() => setMode("menu")}>Kembali</button>
          </div>
        )}

        {mode === "ban" && (
          <div className="adm-form">
            <div className="field">
              <label>Lama ban</label>
              <div className="opts">
                {DURASI.map((d) => (
                  <button key={d.id} type="button" className={"chip" + (durasi === d.id ? " on" : "")}
                    onClick={() => setDurasi(d.id)}>{d.label}</button>
                ))}
              </div>
            </div>
            {durasi === "custom" && (
              <div className="field">
                <label htmlFor="bc">Berakhir pada</label>
                <input id="bc" className="input" type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label htmlFor="ba">Alasan (terlihat oleh akun yang dibanned)</label>
              <textarea id="ba" className="input area" value={alasan} maxLength={300}
                placeholder="Contoh: menyebar spam di kolom pesan" onChange={(e) => setAlasan(e.target.value)} />
              <span className="status">{alasan.length}/300</span>
            </div>
            <div className="sheet-actions">
              <button type="button" className="btn ghost" onClick={() => setMode("menu")} disabled={busy}>Batal</button>
              <button type="button" className="btn" onClick={banAkun} disabled={busy || alasan.trim().length < 3}>
                {busy ? "Memproses..." : "Ban akun"}
              </button>
            </div>
          </div>
        )}

        {mode === "password" && (
          <div className="adm-form">
            {pwBaru ? (
              <>
                <p className="muted">Password baru sudah aktif. Sampaikan ke pemilik akun, lalu sarankan segera menggantinya. Password ini tidak akan ditampilkan lagi.</p>
                <div className="adm-secret">{pwBaru}</div>
                <button type="button" className="btn ghost" onClick={() => setMode("menu")}>Selesai</button>
              </>
            ) : (
              <>
                <p className="muted">Password lama tidak bisa dilihat. Kamu hanya bisa menggantinya dengan yang baru.</p>
                <div className="field">
                  <label htmlFor="pw">Password baru</label>
                  <input id="pw" className="input" value={pw} maxLength={72} autoCapitalize="none" autoComplete="off"
                    onChange={(e) => setPw(e.target.value)} />
                </div>
                <button type="button" className="btn ghost sm" onClick={() => setPw(passwordAcak())}>Buat acak</button>
                <div className="sheet-actions">
                  <button type="button" className="btn ghost" onClick={() => setMode("menu")} disabled={busy}>Batal</button>
                  <button type="button" className="btn" onClick={simpanPassword} disabled={busy || pw.length < 10}>
                    {busy ? "Memproses..." : "Simpan password"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {mode === "delete" && (
          <div className="adm-form">
            <p className="error">Menghapus akun akan menghapus seluruh postingan, cerita, dan chat miliknya secara permanen. File foto dan video di penyimpanan tidak ikut terhapus otomatis.</p>
            <div className="field">
              <label htmlFor="dl">Ketik <b>{u.username}</b> untuk konfirmasi</label>
              <input id="dl" className="input" value={konfirmasi} autoCapitalize="none" autoComplete="off"
                onChange={(e) => setKonfirmasi(e.target.value)} />
            </div>
            <div className="sheet-actions">
              <button type="button" className="btn ghost" onClick={() => setMode("menu")} disabled={busy}>Batal</button>
              <button type="button" className="btn" onClick={hapusAkun} disabled={busy || konfirmasi !== u.username}>
                {busy ? "Memproses..." : "Hapus akun"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
