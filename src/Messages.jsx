import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";
import { useAuth } from "./AuthContext.jsx";
import { useStories } from "./StoryContext.jsx";
import Badge from "./Badge.jsx";
import Avatar from "./Avatar.jsx";
import CropEditor from "./CropEditor.jsx";
import useSheet from "./useSheet.js";
import { EXT, IMG_TYPES, VID_TYPES, MAX_IMG, MAX_VID, cropStyle, cleanMusic } from "./postUtils.js";
import MusicSheet from "./MusicSheet.jsx";
import Icon from "./Icon.jsx";
import { shortTime } from "./time.js";
import "./post.css";
import "./chat.css";

function StoryComposer({ file, url, onClose, onDone }) {
  const { profile } = useAuth();
  const video = file.type.startsWith("video");
  const [media, setMedia] = useState({ file, url, crop: null, aspect: null });
  const [cropping, setCropping] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  
  // State untuk musik
  const [music, setMusic] = useState(null);
  const [musicOpen, setMusicOpen] = useState(false);
  
  useSheet(onClose);

  // Buang hasil potong lama saat diganti atau ditutup (media asli dibuang oleh halaman induk)
  useEffect(() => () => { if (media.url !== url) URL.revokeObjectURL(media.url); }, [media.url, url]);

  function hasilPotong(r) {
    if (video) setMedia((m) => ({ ...m, crop: r.crop, aspect: r.crop ? r.aspect : null }));
    else setMedia({ file: r.file, url: r.url, crop: null, aspect: null });
    setCropping(false);
  }

  async function bagikan() {
    setSending(true);
    setError("");
    const path = `${profile.id}/story-${Date.now()}.${EXT[media.file.type]}`;
    
    // 1. Upload file ke storage
    const { error: e1 } = await supabase.storage.from("posts").upload(path, media.file, { contentType: media.file.type });
    if (e1) { setSending(false); return setError("Gagal mengunggah: " + e1.message); }

    const publicUrl = supabase.storage.from("posts").getPublicUrl(path).data.publicUrl;
    
    // 2. Insert data ke tabel stories (termasuk musik)
    const { error: e2 } = await supabase.from("stories").insert({
      media_url: publicUrl,
      media_type: video ? "video" : "image",
      crop: media.crop,
      aspect: media.crop ? media.aspect : null,
      music: cleanMusic(music), // <-- Data musik disimpan di sini
    });
    
    if (e2) {
      await supabase.storage.from("posts").remove([path]);
      setSending(false);
      return setError("Gagal menyimpan cerita: " + e2.message);
    }
    onDone();
  }

  return (
    <>
    {createPortal(
    <div className="sheet-back" onClick={sending ? undefined : onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Tambah cerita"
        onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>Tambah cerita</h2>
          <button type="button" className="link-btn" onClick={onClose} disabled={sending}>Tutup</button>
        </div>

        <div className="story-preview">
          {video ? (
            media.crop ? (
              <div className="crop-box sm" style={{ "--ar": media.aspect || 1 }}>
                <video src={media.url} style={cropStyle(media.crop)} autoPlay loop muted playsInline />
              </div>
            ) : (
              <video src={media.url} autoPlay loop muted playsInline />
            )
          ) : (
            <img src={media.url} alt="Pratinjau cerita" />
          )}
        </div>

        <div className="row-actions two">
          <button type="button" className="btn ghost sm" onClick={() => setCropping(true)} disabled={sending}>
            {video ? "Potong video" : "Potong foto"}
          </button>
          
          {/* Tombol Pilih Musik */}
          <button type="button" className="btn ghost sm" onClick={() => setMusicOpen(true)} disabled={sending}>
            <Icon name="music" size={16} style={{marginRight: 6}} />
            {music ? music.title : "Pilih Musik"}
          </button>
        </div>

        <p className="sheet-note">Cerita tampil selama 24 jam.</p>
        {error && <p className="error" role="alert">{error}</p>}
        
        <div className="sheet-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={sending}>Batal</button>
          <button type="button" className="btn" onClick={bagikan} disabled={sending}>
            {sending ? "Mengunggah..." : "Bagikan"}
          </button>
        </div>
      </div>
    </div>,
    document.body
    )}
    
    {cropping && (
      <CropEditor kind={video ? "video" : "image"} src={url}
        onCancel={() => setCropping(false)} onDone={hasilPotong} />
    )}

    {/* Render MusicSheet kalau tombol musik ditekan */}
    {musicOpen && (
      <MusicSheet current={music} onClose={() => setMusicOpen(false)}
        onPick={(s) => { setMusic(s); setMusicOpen(false); }} />
    )}
    </>
  );
}

export default function Messages() {
  const { profile: me } = useAuth();
  const { groups, openStory, reload, hasStory } = useStories();
  const navigate = useNavigate();
  const admin = me?.role === "admin";
  const fileRef = useRef(null);
  const [all, setAll] = useState([]);
  const [draft, setDraft] = useState(null);
  const [notice, setNotice] = useState("");

  // Chat
  const [threads, setThreads] = useState([]);
  const [ready, setReady] = useState(false);
  const [cari, setCari] = useState("");
  const [hasil, setHasil] = useState([]);

  const muatChat = useCallback(async () => {
    const { data } = await supabase.rpc("my_threads");
    setThreads(data || []);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    muatChat();
    const ch = supabase
      .channel("dm-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_messages" }, muatChat)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [muatChat]);

  // Cari akun untuk memulai chat baru
  useEffect(() => {
    const q = cari.trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
    if (q.length < 2) { setHasil([]); return; }
    let batal = false;
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles")
        .select("id,username,role,verified,avatar_url")
        .ilike("username", q + "%").neq("id", me.id).limit(8);
      if (!batal) setHasil(data || []);
    }, 300);
    return () => { batal = true; clearTimeout(t); };
  }, [cari, me.id]);

  // Admin melihat semua akun terdaftar
  useEffect(() => {
    if (!admin || !supabase) return;
    supabase.from("profiles").select("id,username,role,verified,avatar_url,created_at")
      .order("created_at", { ascending: false }).limit(300)
      .then(({ data }) => setAll(data || []));
  }, [admin]);

  useEffect(() => () => draft && URL.revokeObjectURL(draft.url), [draft]);

  function onPick(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const img = IMG_TYPES.includes(f.type);
    const vid = VID_TYPES.includes(f.type);
    if (!img && !vid) return setNotice("Format tidak didukung. Gunakan foto JPG, PNG, WEBP atau video MP4, WEBM, MOV.");
    if ((img && f.size > MAX_IMG) || (vid && f.size > MAX_VID))
      return setNotice(img ? "Foto terlalu besar. Maksimal 10 MB." : "Video terlalu besar. Maksimal 50 MB.");
    setNotice("");
    setDraft({ file: f, url: URL.createObjectURL(f) });
  }

  const mine = groups.get(me?.id);
  const people = (admin
    ? all.filter((p) => p.id !== me.id).map((p) => ({ id: p.id, username: p.username, role: p.role, verified: p.verified, avatar_url: p.avatar_url }))
    : [...groups.values()].filter((g) => g.id !== me?.id)
        .map((g) => ({ id: g.id, username: g.profile?.username || "akun", role: g.profile?.role, verified: g.profile?.verified, avatar_url: g.profile?.avatar_url }))
  ).sort((a, b) =>
    Number(groups.has(b.id)) - Number(groups.has(a.id)) || a.username.localeCompare(b.username)
  );

  return (
    <>
      <div className="stories" aria-label="Cerita">
        <div className="story-item">
          <button type="button" className="story-av" aria-label={mine ? "Lihat ceritamu" : "Tambah cerita"}
            onClick={() => (mine ? openStory(me.id) : fileRef.current.click())}>
            <Avatar user={me} className={"lg" + (mine ? " story" : "")} />
          </button>
          <button type="button" className="story-plus" aria-label="Tambah cerita" onClick={() => fileRef.current.click()}>+</button>
          <span>Cerita kamu</span>
        </div>

        {people.map((p) => (
          <div className="story-item" key={p.id}>
            <button type="button" className="story-av"
              aria-label={groups.has(p.id) ? `Lihat cerita ${p.username}` : `Buka profil ${p.username}`}
              onClick={() => (groups.has(p.id) ? openStory(p.id) : navigate(`/u/${p.username}`))}>
              <Avatar user={p} className={"lg" + (groups.has(p.id) ? " story" : "")} />
            </button>
            <span>{p.username}<Badge role={p.role} verified={p.verified} /></span>
          </div>
        ))}
      </div>

      {admin && <p className="sub top">Sebagai admin, semua akun terdaftar tampil di sini ({all.length}).</p>}
      {notice && <p className="notice">{notice}</p>}

      <div className="chat-search">
        <input className="input" type="search" placeholder="Cari akun untuk memulai chat" value={cari}
          maxLength={30} autoCapitalize="none" onChange={(e) => setCari(e.target.value)} />
      </div>

      {hasil.length > 0 && (
        <div className="chat-results">
          {hasil.map((p) => (
            <button type="button" className="thread" key={p.id} onClick={() => navigate(`/chat/${p.username}`)}>
              <Avatar user={p} className={hasStory(p.id) ? "story" : ""} />
              <div className="thread-body">
                <div className="thread-top"><b>{p.username}<Badge role={p.role} verified={p.verified} /></b></div>
                <div className="thread-bottom"><span className="thread-last">Mulai percakapan</span></div>
              </div>
            </button>
          ))}
        </div>
      )}

      {ready && threads.length === 0 && hasil.length === 0 && (
        <p className="chat-empty">Belum ada percakapan. Cari akun di atas untuk mulai mengobrol.</p>
      )}

      <div>
        {threads.map((t) => (
          <button type="button" key={t.thread_id} className={"thread" + (t.unread > 0 ? " unread" : "")}
            onClick={() => navigate(`/chat/${t.username}`)}>
            <Avatar user={{ username: t.username, avatar_url: t.avatar_url }} className={hasStory(t.other_id) ? "story" : ""} />
            <div className="thread-body">
              <div className="thread-top">
                <b>{t.username}<Badge role={t.role} verified={t.verified} /></b>
                <time dateTime={t.last_at}>{shortTime(t.last_at)}</time>
              </div>
              <div className="thread-bottom">
                <span className="thread-last">{t.last_sender === me.id ? "Kamu: " : ""}{t.last_body}</span>
                {t.unread > 0 && <span className="thread-count">{t.unread > 99 ? "99+" : t.unread}</span>}
              </div>
            </div>
          </button>
        ))}
      </div>

      <input ref={fileRef} type="file" accept={[...IMG_TYPES, ...VID_TYPES].join(",")} hidden onChange={onPick} />

      {draft && (
        <StoryComposer file={draft.file} url={draft.url}
          onClose={() => setDraft(null)}
          onDone={() => { setDraft(null); reload(); }} />
      )}
    </>
  );
}
