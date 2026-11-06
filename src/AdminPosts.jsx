import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";
import { rpc, waktu } from "./adminApi.js";
import Avatar from "./Avatar.jsx";
import Badge from "./Badge.jsx";
import useSheet from "./useSheet.js";
import "./admin.css";

const HALAMAN = 30;
const KOLOM =
  "id,author,media_url,media_type,media_urls,caption,link,music,like_count,created_at,takedown_at,takedown_reason,profiles!posts_author_fkey(username,avatar_url,role,verified)";

function PostSheet({ post, onClose, onChanged }) {
  const navigate = useNavigate();
  const [likes, setLikes] = useState(null);
  const [alasan, setAlasan] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useSheet(onClose);

  useEffect(() => {
    rpc("admin_post_likes", { p_post: post.id }).then(setLikes).catch((e) => setErr(e.message));
  }, [post.id]);

  const media = post.media_urls?.length ? post.media_urls : [post.media_url];
  const down = !!post.takedown_at;

  async function aksi(fn) {
    setBusy(true); setErr("");
    try { await fn(); onChanged(); onClose(); }
    catch (e) { setErr(e.message); setBusy(false); }
  }

  return createPortal(
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet adm-sheet" role="dialog" aria-modal="true" aria-label={`Postingan ${post.id}`}
        onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>Postingan #{post.id}</h2>
          <button type="button" className="link-btn" onClick={onClose}>Tutup</button>
        </div>

        <div className="adm-id">
          <Avatar user={post.profiles} />
          <div>
            <b>{post.profiles?.username}<Badge role={post.profiles?.role} verified={post.profiles?.verified} /></b>
            <small>{waktu(post.created_at)}</small>
          </div>
        </div>

        <div className="adm-media">
          {post.media_type === "video"
            ? <video src={media[0]} controls playsInline preload="metadata" />
            : media.map((u, k) => <img key={k} src={u} alt={`Foto ${k + 1}`} loading="lazy" />)}
        </div>

        <div className="adm-info">
          <div><span>Deskripsi</span><span>{post.caption || "-"}</span></div>
          <div><span>Tautan</span><span className="pecah">{post.link || "-"}</span></div>
          <div><span>Musik</span><span>{post.music ? `${post.music.title}${post.music.artist ? `, ${post.music.artist}` : ""}` : "-"}</span></div>
          <div><span>Jumlah suka</span><span>{post.like_count}</span></div>
          {down && <div><span>Takedown</span><span>{waktu(post.takedown_at)}</span></div>}
          {down && <div><span>Alasan</span><span>{post.takedown_reason}</span></div>}
        </div>

        <h3 className="adm-h2">Yang menyukai ({likes ? likes.length : "..."})</h3>
        {likes && likes.length === 0 && <p className="muted">Belum ada yang menyukai.</p>}
        {likes && likes.length > 0 && (
          <div className="adm-likes">
            {likes.map((l) => (
              <div key={l.user_id}>
                <Avatar user={l} />
                <span>{l.username}</span>
                <small>{waktu(l.liked_at)}</small>
              </div>
            ))}
          </div>
        )}

        {err && <p className="error" role="alert">{err}</p>}

        <div className="adm-form">
          <button type="button" className="btn ghost" onClick={() => { onClose(); navigate(`/u/${post.profiles?.username}`); }}>Lihat profil pemilik</button>
          {down ? (
            <button type="button" className="btn" disabled={busy} onClick={() => aksi(() => rpc("admin_restore_post", { p_post: post.id }))}>
              {busy ? "Memproses..." : "Pulihkan postingan"}
            </button>
          ) : (
            <>
              <div className="field">
                <label htmlFor="ta">Alasan takedown</label>
                <textarea id="ta" className="input area" value={alasan} maxLength={300}
                  placeholder="Contoh: melanggar aturan konten" onChange={(e) => setAlasan(e.target.value)} />
              </div>
              <button type="button" className="btn ghost danger" disabled={busy || alasan.trim().length < 3}
                onClick={() => aksi(() => rpc("admin_takedown_post", { p_post: post.id, p_reason: alasan }))}>
                {busy ? "Memproses..." : "Takedown postingan"}
              </button>
              <p className="muted">Postingan disembunyikan dari semua orang, tapi tidak dihapus dan bisa dipulihkan.</p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function AdminPosts() {
  const [tab, setTab] = useState("aktif");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(null);

  const muat = useCallback(async (jenis, dari, tambah) => {
    setLoading(true);
    let q = supabase.from("posts").select(KOLOM).order("created_at", { ascending: false }).range(dari, dari + HALAMAN - 1);
    q = jenis === "aktif" ? q.is("takedown_at", null) : q.not("takedown_at", "is", null);
    const { data, error } = await q;
    if (error) setErr(error.message); else setErr("");
    setRows((lama) => (tambah ? [...lama, ...(data || [])] : data || []));
    setMore((data || []).length >= HALAMAN);
    setLoading(false);
  }, []);

  useEffect(() => { muat(tab, 0, false); }, [tab, muat]);

  return (
    <>
      <h2 className="adm-h">Postingan</h2>
      <div className="opts">
        <button type="button" className={"chip" + (tab === "aktif" ? " on" : "")} onClick={() => setTab("aktif")}>Aktif</button>
        <button type="button" className={"chip" + (tab === "takedown" ? " on" : "")} onClick={() => setTab("takedown")}>Takedown</button>
      </div>

      {err && <p className="error">{err}. Pastikan schema-admin.sql sudah dijalankan.</p>}

      <div className="adm-list">
        {rows.map((p) => (
          <button type="button" className="adm-row" key={p.id} onClick={() => setSel(p)}>
            <div className="adm-thumb">
              {p.media_type === "video"
                ? <video src={(p.media_urls?.[0] || p.media_url) + "#t=0.1"} muted playsInline preload="metadata" />
                : <img src={p.media_urls?.[0] || p.media_url} alt="" loading="lazy" />}
            </div>
            <div className="adm-row-body">
              <b>{p.profiles?.username}<Badge role={p.profiles?.role} verified={p.profiles?.verified} /></b>
              <small className="adm-cap">{p.caption || "Tanpa deskripsi"}</small>
              <small>{p.like_count} suka, {waktu(p.created_at)}</small>
            </div>
          </button>
        ))}
      </div>

      {loading && <p className="muted adm-foot">Memuat...</p>}
      {!loading && rows.length === 0 && !err && <p className="muted adm-foot">Tidak ada postingan.</p>}
      {!loading && more && (
        <button type="button" className="btn ghost full" onClick={() => muat(tab, rows.length, true)}>Muat lebih banyak</button>
      )}

      {sel && <PostSheet post={sel} onClose={() => setSel(null)} onChanged={() => muat(tab, 0, false)} />}
    </>
  );
}
