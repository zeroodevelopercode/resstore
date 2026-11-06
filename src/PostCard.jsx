import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabase.js";
import { useAuth } from "./AuthContext.jsx";
import { useStories } from "./StoryContext.jsx";
import Badge from "./Badge.jsx";
import Avatar from "./Avatar.jsx";
import Icon from "./Icon.jsx";
import { ago } from "./time.js";
import { registerVideo, setSound, useSound } from "./videoManager.js";
import { registerAudio, toggleAudio } from "./audioManager.js";
import { cropStyle, isAllowedAudio } from "./postUtils.js";
import "./post.css";

const isHttp = (u) => typeof u === "string" && /^https?:\/\//i.test(u);
const isSrc = (u) => typeof u === "string" && /^(https?:|blob:)/i.test(u);
const isHttps = (u) => typeof u === "string" && /^https:\/\//i.test(u);

function host(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
}

// Tagar diberi warna aksen
function Caption({ text }) {
  const parts = text.split(/(#[\p{L}\p{N}_]+)/gu);
  return parts.map((p, i) =>
    p.startsWith("#") ? <span className="tag" key={i}>{p}</span> : p
  );
}

function MusicChip({ music, cardRef, heldKey }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const url = isAllowedAudio(music.url) ? music.url : null;

  // Diputar otomatis saat kartu postingan ini yang sedang terlihat di layar
  useEffect(() => {
    if (!url || !audio.current || !cardRef.current) return;
    return registerAudio(audio.current, cardRef.current, heldKey);
  }, [url, cardRef, heldKey]);

  return (
    <div className="music-chip">
      <Icon name="music" size={16} />
      <span className="music-name">
        {music.title}{music.artist ? `, ${music.artist}` : ""}
      </span>
      {url && (
        <>
          <button type="button" className="link-btn" onClick={() => toggleAudio(audio.current)}>
            {playing ? "Jeda" : "Putar"}
          </button>
          <audio ref={audio} src={url} loop preload="none"
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
        </>
      )}
    </div>
  );
}

/* Deteksi ketuk: kiri, tengah, kanan. Ketuk dua kali = aksi ganda. */
function useTaps(handlers) {
  const h = useRef(handlers);
  h.current = handlers;
  const last = useRef({ t: 0, zone: "" });
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const zone = x < 0.33 ? "left" : x > 0.67 ? "right" : "center";
    const now = Date.now();

    if (zone === last.current.zone && now - last.current.t < 300) {
      clearTimeout(timer.current);
      last.current = { t: 0, zone: "" };
      h.current[zone + "Double"]?.();
      return;
    }
    last.current = { t: now, zone };
    clearTimeout(timer.current);
    if (zone === "center" && h.current.centerSingle) {
      timer.current = setTimeout(() => h.current.centerSingle(), 300);
    }
  };
}

/* Video tanpa pemutar: berputar terus, ketuk tengah = jeda, ketuk dua kali di sisi = lompat */
function VideoMedia({ src, crop, onLike }) {
  const ref = useRef(null);
  const sound = useSound();
  const [held, setHeld] = useState(false);
  const [hint, setHint] = useState(null);

  useEffect(() => registerVideo(ref.current), []);

  const seek = (d) => {
    const v = ref.current;
    if (!v) return;
    const t = v.currentTime + d;
    v.currentTime = Math.max(0, v.duration ? Math.min(t, v.duration - 0.05) : t);
    setHint({ side: d < 0 ? "left" : "right", text: `${d < 0 ? "-" : "+"}${Math.abs(d)} dtk`, k: Date.now() });
  };

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) { v._held = false; v.play().catch(() => {}); setHeld(false); }
    else { v._held = true; v.pause(); setHeld(true); }
  };

  const tap = useTaps({
    centerSingle: toggle,
    centerDouble: onLike,
    leftDouble: () => seek(-5),
    rightDouble: () => seek(5),
  });

  return (
    <div className="vwrap" onClick={tap}>
      <video ref={ref} src={src} loop muted playsInline preload="metadata"
        style={crop ? cropStyle(crop) : undefined}
        disablePictureInPicture onPlay={() => setHeld(false)} />
      {held && <span className="state-icon"><Icon name="play" size={48} fill="currentColor" /></span>}
      {hint && <span key={hint.k} className={"seek-hint " + hint.side}>{hint.text}</span>}
      <button type="button" className="sound-btn" aria-label={sound ? "Matikan suara" : "Nyalakan suara"}
        onClick={(e) => { e.stopPropagation(); setSound(!sound); }}>
        <Icon name={sound ? "volume" : "mute"} size={18} />
      </button>
    </div>
  );
}

/* Foto: digeser satu per satu, ketuk dua kali di tengah = suka */
function PhotoMedia({ items, alt, onLike }) {
  const [i, setI] = useState(0);
  const tap = useTaps({ centerDouble: onLike });
  return (
    <>
      <div className="carousel" onClick={tap}
        onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {items.map((u, k) => <img key={k} src={u} alt={alt || "Foto postingan"} loading="lazy" draggable={false} />)}
      </div>
      {items.length > 1 && <span className="count-pill">{i + 1}/{items.length}</span>}
      {items.length > 1 && (
        <div className="dots" aria-hidden="true">
          {items.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}
        </div>
      )}
    </>
  );
}

export default function PostCard({ post, preview = false }) {
  const { session } = useAuth();
  const { hasStory, openStory } = useStories();
  const cardRef = useRef(null);

  const nama = post.profiles?.username || "akun";
  const items = (post.media_urls?.length ? post.media_urls : post.media_url ? [post.media_url] : []).filter(isSrc);
  const link = isHttp(post.link) ? post.link : null;
  const aspect = post.aspect || 1;
  const storied = !preview && post.author && hasStory(post.author);

  const [liked, setLiked] = useState(!!post.liked);
  const [count, setCount] = useState(post.like_count || 0);
  const [burst, setBurst] = useState(0);
  useEffect(() => { setLiked(!!post.liked); setCount(post.like_count || 0); }, [post.liked, post.like_count]);

  const persist = typeof post.id === "number";

  async function setLike(next) {
    if (preview || next === liked) return;
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    if (!persist || !supabase || !session) return;
    const { error } = next
      ? await supabase.from("post_likes").insert({ post_id: post.id })
      : await supabase.from("post_likes").delete().match({ post_id: post.id, user_id: session.user.id });
    if (error && error.code !== "23505") {
      setLiked(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
    }
  }

  const doubleLike = () => { setBurst((b) => b + 1); setLike(true); };

  const letter = nama[0].toUpperCase();
  const avatar = <Avatar user={post.profiles} className={storied ? "story" : ""} />;
  const who = <>{nama}<Badge role={post.profiles?.role} verified={post.profiles?.verified} /></>;

  return (
    <article className="post" ref={cardRef}>
      <div className="post-head">
        {storied
          ? <button type="button" className="avatar-btn" onClick={() => openStory(post.author)} aria-label={`Lihat cerita ${nama}`}>{avatar}</button>
          : avatar}
        {preview ? <span className="uname">{who}</span> : <Link to={`/u/${nama}`} className="uname">{who}</Link>}
      </div>

      <div className={"post-media" + (items.length ? "" : " empty")} style={{ aspectRatio: aspect }}>
        {!items.length && <span className="ph">{letter}</span>}
        {items.length > 0 && post.media_type === "video" && <VideoMedia src={items[0]} crop={post.media_crop} onLike={doubleLike} />}
        {items.length > 0 && post.media_type !== "video" && (
          <PhotoMedia items={items} alt={post.caption} onLike={doubleLike} />
        )}
        {burst > 0 && <span key={burst} className="burst"><Icon name="heart" size={88} fill="currentColor" /></span>}
      </div>

      <div className="post-actions">
        <button type="button" className={"like" + (liked ? " on" : "")} aria-pressed={liked}
          aria-label={liked ? "Batal suka" : "Suka"} onClick={() => setLike(!liked)}>
          <Icon name="heart" size={22} fill={liked ? "currentColor" : "none"} />
          <span>{count.toLocaleString("id-ID")}</span>
        </button>
      </div>

      <div className="post-body">
        {post.caption && <p><b>{nama}</b> <Caption text={post.caption} /></p>}
        {post.music && <MusicChip music={post.music} cardRef={cardRef} heldKey={String(post.id ?? post.music.url)} />}
        {link && (
          <a className="post-link" href={link} target="_blank" rel="noopener noreferrer nofollow ugc">
            <Icon name="link" size={14} />{host(link)}
          </a>
        )}
        {post.created_at && <p className="time">{ago(post.created_at)}</p>}
      </div>
    </article>
  );
}
