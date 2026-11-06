import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "./supabase.js";
import { useAuth } from "./AuthContext.jsx";
import Badge from "./Badge.jsx";
import Icon from "./Icon.jsx";
import Avatar from "./Avatar.jsx";
import ActionSheet from "./ActionSheet.jsx";
import CropEditor from "./CropEditor.jsx";
import useSheet from "./useSheet.js";
import { EXT, IMG_TYPES, VID_TYPES, MAX_IMG, MAX_VID } from "./postUtils.js";

const bulanTahun = (iso) =>
  new Date(iso).toLocaleDateString("id-ID", { month: "short", year: "numeric" });

const pesan = {
  invalid: "3-20 karakter: huruf kecil, angka, titik, atau underscore.",
  taken: "Username sudah dipakai.",
  ok: "Username tersedia.",
  checking: "Memeriksa...",
};

/* Lembar edit: tampil di atas profil, terpisah dari halaman profil */
function EditSheet({ p, onClose }) {
  const { refreshProfile } = useAuth();
  const [username, setUsername] = useState(p.username);
  const [name, setName] = useState(p.full_name || "");
  const [bio, setBio] = useState(p.bio || "");
  const [avail, setAvail] = useState("same");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useSheet(onClose);

  const u = username.trim().toLowerCase();

  // Cek ketersediaan username secara langsung
  useEffect(() => {
    if (u === p.username) return setAvail("same");
    if (!/^[a-z0-9_.]{3,20}$/.test(u)) return setAvail("invalid");
    setAvail("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id").eq("username", u).maybeSingle();
      setAvail(data ? "taken" : "ok");
    }, 400);
    return () => clearTimeout(t);
  }, [u, p.username]);

  const bisaSimpan = ["same", "ok"].includes(avail) && !saving;

  async function save(e) {
    e.preventDefault();
    if (!bisaSimpan) return;
    setError("");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: u, full_name: name.trim() || null, bio: bio.trim() || null })
      .eq("id", p.id);
    setSaving(false);
    if (error) return setError(error.code === "23505" ? "Username sudah dipakai." : "Gagal menyimpan. Coba lagi.");
    await refreshProfile();
    onClose();
  }

  return createPortal(
    <div className="sheet-back" onClick={onClose}>
      <form className="sheet" role="dialog" aria-modal="true" aria-label="Edit profil"
        onClick={(e) => e.stopPropagation()} onSubmit={save} noValidate>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>Edit profil</h2>
          <button type="button" className="link-btn" onClick={onClose}>Tutup</button>
        </div>

        <div className="preview">
          <Avatar user={{ username: u || "?", avatar_url: p.avatar_url }} />
          <div className="preview-text">
            <b>@{u || "username"}</b>
            <span>{bio.trim() || "Bio kamu akan tampil di sini."}</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="un">Username</label>
          <div className="prefix">
            <span>@</span>
            <input id="un" className="input" value={username} maxLength={20}
              autoCapitalize="none" autoComplete="off" onChange={(e) => setUsername(e.target.value)} />
          </div>
          <span className={"status " + (avail === "ok" ? "ok" : avail === "taken" || avail === "invalid" ? "bad" : "")}>
            {pesan[avail] || "\u00A0"}
          </span>
        </div>

        <div className="field">
          <label htmlFor="fn">Nama</label>
          <input id="fn" className="input" value={name} maxLength={60}
            onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="bio">Bio</label>
          <textarea id="bio" className="input area" value={bio} maxLength={160}
            onChange={(e) => setBio(e.target.value)} />
          <span className="status">{bio.length}/160</span>
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <div className="sheet-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Batal</button>
          <button className="btn" disabled={!bisaSimpan}>{saving ? "Menyimpan..." : "Simpan"}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

export default function Profile() {
  const { username } = useParams();
  const { session, profile: me, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [other, setOther] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [posts, setPosts] = useState([]);
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState(null); // "avatar" | "cover"
  const [cropSrc, setCropSrc] = useState(null);
  const [coverSrc, setCoverSrc] = useState(null);
  const [msg, setMsg] = useState("");
  const avatarRef = useRef(null);
  const coverRef = useRef(null);

  const isSelf = !username || username === me?.username;
  const p = isSelf ? me : other;

  useEffect(() => {
    setOther(null);
    setNotFound(false);
    if (!supabase || isSelf || !username) return;
    supabase.from("profiles").select("*").eq("username", username.toLowerCase()).maybeSingle()
      .then(({ data }) => (data ? setOther(data) : setNotFound(true)));
  }, [username, isSelf]);

  useEffect(() => {
    if (!supabase || !p?.id) return;
    supabase.from("posts").select("id,media_url,media_type").eq("author", p.id).is("takedown_at", null)
      .order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => setPosts(data || []));
  }, [p?.id]);

  async function keluar() {
    await supabase.auth.signOut({ scope: "local" });
    navigate("/");
  }

  /* ---------- Foto profil dan latar ---------- */
  async function unggah(file, nama) {
    const path = `${me.id}/${nama}-${Date.now()}.${EXT[file.type]}`;
    const { error } = await supabase.storage.from("posts").upload(path, file, {
      contentType: file.type, cacheControl: "31536000",
    });
    if (error) throw error;
    return supabase.storage.from("posts").getPublicUrl(path).data.publicUrl;
  }

  // Hapus file lama dari penyimpanan (jika ada)
  async function hapusLama(url) {
    const path = url?.split("/object/public/posts/")[1];
    if (path) await supabase.storage.from("posts").remove([path]);
  }

  async function simpanProfil(patch, lama, teks) {
    setMsg(teks);
    try {
      const { error } = await supabase.from("profiles").update(patch).eq("id", me.id);
      if (error) throw error;
      if (lama) hapusLama(lama);
      await refreshProfile();
      setMsg("");
    } catch (e) {
      setMsg("Gagal menyimpan: " + (e.message || "coba lagi."));
    }
  }

  function pilihAvatar(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!IMG_TYPES.includes(f.type) || f.size > MAX_IMG)
      return setMsg("Foto tidak valid. Gunakan JPG, PNG, atau WEBP maksimal 10 MB.");
    setMsg("");
    setCropSrc(URL.createObjectURL(f));
  }

  async function simpanAvatar(r) {
    URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setMsg("Mengunggah foto profil...");
    try {
      const url = await unggah(r.file, "avatar");
      await simpanProfil({ avatar_url: url }, me.avatar_url, "Menyimpan...");
    } catch (e) {
      setMsg("Gagal mengunggah: " + (e.message || "coba lagi."));
    }
    URL.revokeObjectURL(r.url);
  }

  async function pilihCover(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const img = IMG_TYPES.includes(f.type);
    const vid = VID_TYPES.includes(f.type);
    if (!img && !vid) return setMsg("Format tidak didukung. Gunakan foto atau video MP4, WEBM, MOV.");
    if ((img && f.size > MAX_IMG) || (vid && f.size > MAX_VID))
      return setMsg(img ? "Foto terlalu besar. Maksimal 10 MB." : "Video terlalu besar. Maksimal 50 MB.");
    if (img) { setMsg(""); return setCoverSrc(URL.createObjectURL(f)); } // foto: atur dulu di editor
    setMsg("Mengunggah latar...");
    try {
      const url = await unggah(f, "cover");
      await simpanProfil({ cover_url: url, cover_type: "video" }, me.cover_url, "Menyimpan...");
    } catch (err) {
      setMsg("Gagal mengunggah: " + (err.message || "coba lagi."));
    }
  }

  async function simpanCover(r) {
    URL.revokeObjectURL(coverSrc);
    setCoverSrc(null);
    setMsg("Mengunggah latar...");
    try {
      const url = await unggah(r.file, "cover");
      await simpanProfil({ cover_url: url, cover_type: "image" }, me.cover_url, "Menyimpan...");
    } catch (err) {
      setMsg("Gagal mengunggah: " + (err.message || "coba lagi."));
    }
    URL.revokeObjectURL(r.url);
  }

  if (notFound) return <p className="notice">Akun tidak ditemukan.</p>;
  if (!p)
    return (
      <>
        <p className="notice">Memuat profil... Kalau terlalu lama, akunmu mungkin sudah dihapus.</p>
        {isSelf && (
          <div className="pf-actions pad">
            <button className="btn ghost" onClick={keluar}>Keluar</button>
          </div>
        )}
      </>
    );

  const admin = p.role === "admin";
  const cover = typeof p.cover_url === "string" && /^https:\/\//i.test(p.cover_url) ? p.cover_url : null;

  return (
    <>
      <div className="pf-cover">
        {cover && (p.cover_type === "video"
          ? <video className="cover-media" src={cover} autoPlay loop muted playsInline />
          : <img className="cover-media" src={cover} alt="" />)}
        {isSelf && (
          <button type="button" className="cover-edit" onClick={() => setChoice("cover")}>Ubah latar</button>
        )}
      </div>

      <div className="pf-top">
        <div className="frame">
          <Avatar user={p} className="xl" />
          {isSelf && (
            <button type="button" className="avatar-edit" aria-label="Ubah foto profil" onClick={() => setChoice("avatar")}>
              <Icon name="image" size={14} />
            </button>
          )}
        </div>
        {isSelf && (
          <div className="pf-actions">
            {admin && (
              <button className="btn ghost sm icon" onClick={() => navigate("/admin")}
                aria-label="Panel admin" title="Panel admin">
                <Icon name="gear" size={18} />
              </button>
            )}
            {admin && (
              <button className="btn ghost sm icon" onClick={() => navigate("/agent")}
                aria-label="Agent AI" title="Agent AI">
                <Icon name="spark" size={18} />
              </button>
            )}
            <button className="btn sm" onClick={() => setEditing(true)}>Edit profil</button>
            <button className="btn ghost sm" onClick={keluar}>Keluar</button>
          </div>
        )}
        {!isSelf && me && (
          <div className="pf-actions">
            <button className="btn sm" onClick={() => navigate(`/chat/${p.username}`)}>Kirim pesan</button>
          </div>
        )}
      </div>

      {msg && <p className="notice">{msg}</p>}

      <div className="pf-id">
        <h1>{p.username}<Badge role={p.role} verified={p.verified} /></h1>
        {p.full_name && <p className="pf-name">{p.full_name}</p>}
        {admin && <span className="dev-tag">Developer</span>}
        {p.bio
          ? <p className="pf-bio">{p.bio}</p>
          : isSelf && <p className="pf-bio muted">Belum ada bio. Tambahkan lewat Edit profil.</p>}
      </div>

      <div className="pf-stats">
        <div><b>{posts.length}</b><span>postingan</span></div>
        <div><b className={admin ? "admin" : ""}>{admin ? "Developer" : p.role === "reseller" ? "Reseller" : "Anggota"}</b><span>peran</span></div>
        <div><b>{bulanTahun(p.created_at)}</b><span>bergabung</span></div>
      </div>

      <div className="data-panel">
        <div><span>Username</span><span>@{p.username}</span></div>
        {p.full_name && <div><span>Nama</span><span>{p.full_name}</span></div>}
        {isSelf && <div><span>Email</span><span>{session.user.email}</span></div>}
      </div>
      {isSelf && <p className="hint pad">Email hanya terlihat olehmu. Foto profil dan latar terlihat oleh semua orang.</p>}

      <div className="thumbs">
        {posts.map((x) => (
          <div key={x.id}>
            {x.media_type === "video"
              ? <video src={x.media_url} muted playsInline preload="metadata" />
              : <img src={x.media_url} alt="" loading="lazy" />}
          </div>
        ))}
      </div>
      {posts.length === 0 && <p className="notice">Belum ada postingan.</p>}

      {editing && <EditSheet p={p} onClose={() => setEditing(false)} />}

      {choice === "avatar" && (
        <ActionSheet title="Foto profil" onClose={() => setChoice(null)}
          actions={[
            { label: "Pilih foto baru", onClick: () => avatarRef.current.click() },
            ...(me.avatar_url ? [{
              label: "Hapus foto profil", danger: true,
              onClick: () => simpanProfil({ avatar_url: null }, me.avatar_url, "Menghapus foto..."),
            }] : []),
          ]} />
      )}
      {choice === "cover" && (
        <ActionSheet title="Latar profil" onClose={() => setChoice(null)}
          actions={[
            { label: "Pilih foto atau video", onClick: () => coverRef.current.click() },
            ...(me.cover_url ? [{
              label: "Kembalikan ke kotak-kotak", danger: true,
              onClick: () => simpanProfil({ cover_url: null, cover_type: null }, me.cover_url, "Menghapus latar..."),
            }] : []),
          ]} />
      )}

      {cropSrc && (
        <CropEditor kind="image" src={cropSrc} fixedAspect={1} maxSide={640}
          onCancel={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null); }} onDone={simpanAvatar} />
      )}

      {coverSrc && (
        <CropEditor kind="image" src={coverSrc} fixedAspect={3} maxSide={1600}
          fixedHint="Geser ke atas atau bawah untuk memilih bagian yang tampil di latar."
          onCancel={() => { URL.revokeObjectURL(coverSrc); setCoverSrc(null); }} onDone={simpanCover} />
      )}

      <input ref={avatarRef} type="file" accept={IMG_TYPES.join(",")} hidden onChange={pilihAvatar} />
      <input ref={coverRef} type="file" accept={[...IMG_TYPES, ...VID_TYPES].join(",")} hidden onChange={pilihCover} />
    </>
  );
}
