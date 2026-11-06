import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { musicReady, musicDirect, searchMusic, resolveAudio, PAGE_SIZE } from "./music.js";
import Avatar from "./Avatar.jsx";
import useSheet from "./useSheet.js";
import { isAllowedAudio } from "./postUtils.js";

export default function MusicSheet({ current, onPick, onClose }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [state, setState] = useState("ok");
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [playing, setPlaying] = useState(null);
  const [busy, setBusy] = useState(null);
  const [tanpaAudio, setTanpaAudio] = useState(new Set());
  const [msg, setMsg] = useState("");
  const audio = useRef(null);
  const offset = useRef(0);
  useSheet(onClose);

  const terlaluPendek = q.trim().length < 2;

  useEffect(() => {
    if (!musicReady || terlaluPendek) { setList([]); setMore(false); setState("ok"); return; }
    let batal = false;
    setState("loading");
    const t = setTimeout(async () => {
      try {
        offset.current = 0;
        const hasil = await searchMusic(q, 0);
        if (batal) return;
        setList(hasil);
        setMore(hasil.length >= PAGE_SIZE);
        offset.current = PAGE_SIZE;
        setState("ok");
      } catch {
        if (!batal) { setState("error"); setList([]); setMore(false); }
      }
    }, 450);
    return () => { batal = true; clearTimeout(t); };
  }, [q, terlaluPendek]);

  async function muatLagi() {
    if (!more || loadingMore || state !== "ok") return;
    setLoadingMore(true);
    try {
      const hasil = await searchMusic(q, offset.current);
      offset.current += PAGE_SIZE;
      setList((lama) => {
        const ada = new Set(lama.map((s) => s.id));
        return [...lama, ...hasil.filter((s) => !ada.has(s.id))];
      });
      setMore(hasil.length >= PAGE_SIZE);
    } catch {
      setMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  const onScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) muatLagi();
  };

  useEffect(() => () => audio.current?.pause(), []);

  async function audioDari(s) {
    setMsg("");
    setBusy(s.id);
    try {
      const url = await resolveAudio(s.spotify_id);
      if (!isAllowedAudio(url)) {
        setTanpaAudio((p) => new Set(p).add(s.id));
        setMsg("Lagu ini tidak punya audio yang bisa diputar. Pilih lagu lain.");
        return null;
      }
      return url;
    } catch (e) {
      setMsg(e.message || "Gagal memuat audio.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function putar(s) {
    audio.current?.pause();
    if (playing === s.id) return setPlaying(null);
    const url = await audioDari(s);
    if (!url) return;
    const a = new Audio(url);
    a.onended = () => setPlaying(null);
    a.play().catch(() => setPlaying(null));
    audio.current = a;
    setPlaying(s.id);
  }

  async function pilih(s) {
    const url = await audioDari(s);
    if (!url) return;
    audio.current?.pause();
    onPick({ ...s, url });
  }

  return createPortal(
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Pilih musik"
        onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>Pilih musik</h2>
          <button type="button" className="link-btn" onClick={onClose}>Tutup</button>
        </div>

        {!musicReady ? (
          <p className="error">
            API musik belum disambungkan. Isi VITE_RAPIDAPI_KEY atau VITE_MUSIC_FUNCTION di file .env, lalu restart server.
          </p>
        ) : (
          <>
            <input className="input" type="search" placeholder="Cari lagu atau artis"
              value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} />
            {musicDirect && (
              <p className="sheet-note">Mode uji coba: kunci API terlihat di browser. Pindah ke Edge Function sebelum web dibuka untuk umum.</p>
            )}
          </>
        )}

        {musicReady && terlaluPendek && <p className="sheet-note">Ketik minimal 2 huruf untuk mencari.</p>}
        {musicReady && !terlaluPendek && state === "loading" && <p className="sheet-note">Memuat...</p>}
        {state === "error" && <p className="error">Gagal memuat musik. Coba lagi sebentar lagi.</p>}
        {musicReady && !terlaluPendek && state === "ok" && list.length === 0 && <p className="sheet-note">Lagu tidak ditemukan.</p>}
        {msg && <p className="error" role="alert">{msg}</p>}

        {state === "ok" && list.length > 0 && (
          <ul className="song-list scroll" onScroll={onScroll}>
            {list.map((s) => {
              const kosong = tanpaAudio.has(s.id);
              return (
                <li key={s.id}>
                  <div className="song">
                    <Avatar user={{ username: s.title, avatar_url: s.cover }} />
                    <div className="info">
                      <b>{s.title}</b>
                      <small>{kosong ? "Tanpa audio" : s.artist}</small>
                    </div>
                    <button type="button" className="link-btn" disabled={!!busy || kosong} onClick={() => putar(s)}>
                      {busy === s.id ? "Memuat..." : playing === s.id ? "Jeda" : "Putar"}
                    </button>
                    <button type="button" className="btn ghost sm" disabled={!!busy || kosong} onClick={() => pilih(s)}>
                      {current?.id === s.id ? "Dipilih" : "Pilih"}
                    </button>
                  </div>
                </li>
              );
            })}
            {loadingMore && <li className="song-more">Memuat lagi...</li>}
          </ul>
        )}

        {current && (
          <button type="button" className="btn ghost" onClick={() => onPick(null)}>Hapus musik</button>
        )}
      </div>
    </div>,
    document.body
  );
}