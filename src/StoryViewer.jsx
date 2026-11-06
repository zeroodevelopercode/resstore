import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "./supabase.js";
import { useAuth } from "./AuthContext.jsx";
import Badge from "./Badge.jsx";
import Avatar from "./Avatar.jsx";
import Icon from "./Icon.jsx";
import useSheet from "./useSheet.js";
import { ago } from "./time.js";
import { cropStyle, isAllowedAudio } from "./postUtils.js";
import { suspendFeed, resumeFeed } from "./playback.js";
import "./post.css";

const PHOTO_MS = 5000;
const HOLD_MS = 200;

/*
  Penampil cerita layar penuh.
  - Ketuk sisi kanan: cerita berikutnya (setelah yang terakhir, lanjut ke cerita akun lain).
  - Ketuk sisi kiri: kembali.
  - Tahan layar: cerita berhenti sementara, lepas untuk lanjut.
  - Suara di feed berhenti selama cerita terbuka.
*/
export default function StoryViewer({ groups, order, startId, onClose }) {
  const { profile } = useAuth();
  const [gid, setGid] = useState(startId);
  const [i, setI] = useState(0);
  const [prog, setProg] = useState(0); // 0..100
  const [paused, setPaused] = useState(false);
  const vid = useRef(null);
  const mus = useRef(null);
  const press = useRef({ timer: null, held: false, x: 0, y: 0 });
  useSheet(onClose);

  const group = groups.get(gid);
  const items = group?.items || [];
  const cur = items[Math.min(i, items.length - 1)];
  const musicUrl = cur?.music && isAllowedAudio(cur.music.url) ? cur.music.url : null;

  // Tahan semua suara di feed selama cerita terbuka
  useEffect(() => {
    suspendFeed();
    return () => resumeFeed();
  }, []);

  // Akun ini tidak punya cerita lagi (kedaluwarsa atau dihapus)
  useEffect(() => { if (!group || !cur) onClose(); }, [group, cur]); // eslint-disable-line

  const next = () => {
    if (i < items.length - 1) { setI(i + 1); setProg(0); return; }
    const berikut = order[order.indexOf(gid) + 1];
    if (berikut && groups.has(berikut)) { setGid(berikut); setI(0); setProg(0); }
    else onClose();
  };
  const prev = () => {
    if (i > 0) { setI(i - 1); setProg(0); return; }
    const sebelum = order[order.indexOf(gid) - 1];
    if (sebelum && groups.has(sebelum)) {
      setGid(sebelum); setI(groups.get(sebelum).items.length - 1); setProg(0);
    } else setProg(0);
  };
  const nextRef = useRef(next);
  nextRef.current = next;

  // Foto: progres berjalan 5 detik, berhenti saat ditahan dan lanjut dari titik yang sama
  useEffect(() => {
    if (!cur || cur.media_type !== "image" || paused) return;
    const mulai = performance.now() - (prog / 100) * PHOTO_MS;
    let raf;
    const tick = (now) => {
      const p = Math.min(100, ((now - mulai) / PHOTO_MS) * 100);
      setProg(p);
      if (p >= 100) nextRef.current();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gid, i, paused, cur?.id]); // eslint-disable-line

  // Video dan musik cerita ikut berhenti atau lanjut
  useEffect(() => {
    const v = vid.current;
    const a = mus.current;
    if (paused) { v?.pause(); a?.pause(); return; }
    if (v) {
      v.muted = !!musicUrl; // bila ada musik, suara asli video dimatikan
      v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    }
    if (a) a.play().catch(() => {});
  }, [paused, cur?.id]); // eslint-disable-line

  if (!group || !cur) return null;

  const nama = group.profile?.username || "akun";
  const milikku = profile && (profile.id === group.id || profile.role === "admin");

  // Sentuhan: tahan = jeda, ketuk = pindah cerita
  const down = (e) => {
    const p = press.current;
    p.x = e.clientX; p.y = e.clientY; p.held = false;
    clearTimeout(p.timer);
    p.timer = setTimeout(() => { p.held = true; setPaused(true); }, HOLD_MS);
  };
  const up = (e) => {
    const p = press.current;
    clearTimeout(p.timer);
    if (p.held) { p.held = false; setPaused(false); return; }
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 24) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (x < 0.33) prev(); else next();
  };
  const batal = () => {
    const p = press.current;
    clearTimeout(p.timer);
    if (p.held) { p.held = false; setPaused(false); }
  };

  async function hapus() {
    await supabase.from("stories").delete().eq("id", cur.id);
    onClose();
  }

  const videoProps = {
    ref: vid, src: cur.media_url, playsInline: true,
    onTimeUpdate: (e) => setProg((e.currentTarget.currentTime / (e.currentTarget.duration || 1)) * 100),
    onEnded: () => nextRef.current(),
  };

  return createPortal(
    <div className={"story-view" + (paused ? " held" : "")} role="dialog" aria-modal="true" aria-label={`Cerita ${nama}`}>
      <div className="story-bars">
        {items.map((s, k) => (
          <span key={s.id} className={k < i ? "done" : k === i ? "now" : ""}>
            <i style={k === i ? { width: prog + "%" } : undefined} />
          </span>
        ))}
      </div>

      <div className="story-head">
        <Avatar user={group.profile} />
        <b>{nama}<Badge role={group.profile?.role} verified={group.profile?.verified} /></b>
        <small>{ago(cur.created_at)}</small>
        <span className="grow" />
        {milikku && <button type="button" className="link-btn" onClick={hapus}>Hapus</button>}
        <button type="button" className="link-btn" onClick={onClose}>Tutup</button>
      </div>

      <div className="story-stage" onPointerDown={down} onPointerUp={up} onPointerCancel={batal} onPointerLeave={batal}>
        {cur.media_type === "video" ? (
          cur.crop ? (
            <div className="crop-box" style={{ "--ar": cur.aspect || 1 }}>
              <video key={cur.id} {...videoProps} style={cropStyle(cur.crop)} />
            </div>
          ) : (
            <video key={cur.id} {...videoProps} />
          )
        ) : (
          <img key={cur.id} src={cur.media_url} alt={`Cerita ${nama}`} draggable={false} />
        )}
        {musicUrl && <audio key={"m" + cur.id} ref={mus} src={musicUrl} loop preload="auto" />}
      </div>

      {cur.music && (
        <div className="story-music">
          <Icon name="music" size={14} />
          <span>{cur.music.title}{cur.music.artist ? `, ${cur.music.artist}` : ""}</span>
        </div>
      )}
    </div>,
    document.body
  );
}
