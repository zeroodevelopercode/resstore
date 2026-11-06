import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";
import { useAuth } from "./AuthContext.jsx";
import { useDraft } from "./DraftContext.jsx";
import Icon from "./Icon.jsx";
import MusicSheet from "./MusicSheet.jsx";
import PreviewSheet from "./PreviewSheet.jsx";
import { EXT, TAG, normalizeLink, cleanMusic, aspectOf } from "./postUtils.js";
import "./post.css";

// Layar penuh tanpa header dan navbar
export default function PostDetail() {
  const { profile } = useAuth();
  const {
    kind, items, desc, setDesc, link, setLink, music, setMusic, boost, setBoost, reset,
  } = useDraft();
  const navigate = useNavigate();
  const finished = useRef(false);

  const [linkOpen, setLinkOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [aspect, setAspect] = useState(null);

  useEffect(() => {
    if (!items.length && !finished.current) navigate("/post", { replace: true });
  }, [items.length, navigate]);

  // Rasio bingkai untuk pratinjau (sudah memperhitungkan hasil potong)
  useEffect(() => {
    if (!items.length) return;
    let batal = false;
    aspectOf(items, kind).then((a) => { if (!batal) setAspect(a); });
    return () => { batal = true; };
  }, [items, kind]);

  if (!items.length) return null;

  const linkNorm = normalizeLink(link);
  const linkBad = link.trim() !== "" && linkNorm === null;

  let finalCaption = desc.trim();
  if (boost && !new RegExp(TAG, "i").test(finalCaption)) finalCaption = (finalCaption + " " + TAG).trim();

  const previewPost = {
    profiles: { username: profile.username, role: profile.role, avatar_url: profile.avatar_url },
    media_urls: items.map((i) => i.url),
    media_type: kind === "video" ? "video" : "image",
    caption: finalCaption || null,
    link: linkNorm || null,
    music: cleanMusic(music),
    aspect,
    media_crop: kind === "video" ? items[0].crop || null : null,
    like_count: 0,
    created_at: new Date().toISOString(),
  };

  async function publish() {
    setError("");
    setPosting(true);
    setStatus("Mengunggah 0%");

    // Ukuran asli dipakai agar tampilan di feed sesuai dengan yang diposting
    const aspectFinal = await aspectOf(items, kind);

    let selesai = 0;
    const unggah = async (it, i) => {
      const path = `${profile.id}/${Date.now()}-${i}.${EXT[it.file.type]}`;
      const { error } = await supabase.storage.from("posts").upload(path, it.file, {
        contentType: it.file.type, cacheControl: "31536000",
      });
      if (error) throw error;
      selesai += 1;
      setStatus(`Mengunggah ${Math.round((selesai / items.length) * 100)}%`);
      return { path, url: supabase.storage.from("posts").getPublicUrl(path).data.publicUrl };
    };

    const hasil = await Promise.allSettled(items.map(unggah));
    const berhasil = hasil.filter((r) => r.status === "fulfilled").map((r) => r.value);
    const gagal = hasil.find((r) => r.status === "rejected");

    if (gagal) {
      if (berhasil.length) await supabase.storage.from("posts").remove(berhasil.map((b) => b.path));
      setError("Gagal mengunggah: " + (gagal.reason?.message || "coba lagi."));
      return setPosting(false);
    }

    setStatus("Menyimpan postingan...");
    const urls = berhasil.map((b) => b.url);
    const { error } = await supabase.from("posts").insert({
      media_url: urls[0],
      media_type: kind === "video" ? "video" : "image",
      media_urls: urls,
      aspect: aspectFinal,
      media_crop: kind === "video" ? items[0].crop || null : null,
      caption: finalCaption || null,
      link: linkNorm || null,
      music: cleanMusic(music),
    });
    if (error) {
      await supabase.storage.from("posts").remove(berhasil.map((b) => b.path));
      setError("Gagal menyimpan: " + error.message);
      return setPosting(false);
    }
    finished.current = true;
    navigate("/home", { replace: true });
    reset();
  }

  return (
    <div className="fs">
      <header className="fs-top">
        <button type="button" className="link-btn" onClick={() => navigate("/post/confirm")} disabled={posting}>Kembali</button>
        <h1>Detail postingan</h1>
        <span />
      </header>

      <div className="fs-scroll">
        <div className="strip" aria-label="Media yang akan diposting">
          {items.map((it, i) => (
            <div className="mini" key={it.id}>
              {kind === "video"
                ? <video src={it.url + "#t=0.1"} muted playsInline preload="metadata" />
                : <img src={it.url} alt={`Foto ${i + 1}`} />}
              {kind === "photo" && <span className="idx">{i + 1}</span>}
            </div>
          ))}
        </div>

        <div className="compose-form">
          <div className="field">
            <label htmlFor="desc">Deskripsi {kind === "video" ? "video" : "foto"}</label>
            <textarea id="desc" className="input area" value={desc} maxLength={500} disabled={posting}
              placeholder="Tulis deskripsi, gunakan # untuk tagar" onChange={(e) => setDesc(e.target.value)} />
            <span className="status">{desc.length}/500</span>
          </div>

          <div className="opt-group">
            <button type="button" className="opt" onClick={() => setLinkOpen(!linkOpen)} disabled={posting}>
              <Icon name="link" size={20} />
              <span className="opt-t">Tambah tautan</span>
              <span className="opt-v">{linkNorm ? new URL(linkNorm).hostname : "Tambah"}</span>
            </button>
            {linkOpen && (
              <div className="opt-body">
                <input className="input" type="url" inputMode="url" placeholder="https://contoh.com"
                  value={link} maxLength={300} autoCapitalize="none" disabled={posting}
                  onChange={(e) => setLink(e.target.value)} />
                <span className={"status " + (linkBad ? "bad" : "")}>
                  {linkBad ? "Tautan tidak valid. Gunakan alamat http atau https." : "\u00A0"}
                </span>
              </div>
            )}
          </div>

          <button type="button" className="opt" onClick={() => setMusicOpen(true)} disabled={posting}>
            <Icon name="music" size={20} />
            <span className="opt-t">Musik</span>
            <span className="opt-v">{music ? music.title : "Pilih"}</span>
          </button>

          <div className={"boost" + (boost ? " on" : "")}>
            <div>
              <h3>{TAG}</h3>
              <p>Tambahkan tagar ini supaya postinganmu lebih berpeluang muncul di beranda orang lain.</p>
            </div>
            <button type="button" role="switch" aria-checked={boost} aria-label={`Gunakan ${TAG}`}
              className="switch" onClick={() => setBoost(!boost)} disabled={posting}>
              <span />
            </button>
          </div>
        </div>
      </div>

      <footer className="fs-bottom">
        {error && <p className="error fs-msg" role="alert">{error}</p>}
        {posting && <p className="up-status fs-msg" role="status">{status}</p>}
        <div className="compose-actions fs-actions">
          <button type="button" className="btn ghost" onClick={() => setPreviewOpen(true)} disabled={posting}>Pratinjau</button>
          <button type="button" className="btn" onClick={publish} disabled={posting || linkBad}>
            {posting ? "Memproses..." : "Posting ke feed"}
          </button>
        </div>
      </footer>

      {musicOpen && (
        <MusicSheet current={music} onClose={() => setMusicOpen(false)}
          onPick={(s) => { setMusic(s); setMusicOpen(false); }} />
      )}
      {previewOpen && <PreviewSheet post={previewPost} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}
