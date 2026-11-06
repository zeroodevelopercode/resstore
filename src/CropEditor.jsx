import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useSheet from "./useSheet.js";
import "./crop.css";

const PRESETS = [
  { id: "orig", label: "Asli" },
  { id: "1:1", label: "1:1", ar: 1 },
  { id: "4:5", label: "4:5", ar: 0.8 },
  { id: "9:16", label: "9:16", ar: 0.5625 },
  { id: "16:9", label: "16:9", ar: 1.7778 },
];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clampAr = (a) => clamp(a, 0.5625, 1.91);
const r4 = (n) => Math.round(clamp(n, 0, 1) * 10000) / 10000;

/*
  Potong foto atau video: geser dan cubit untuk mengatur area, pilih rasio.
  - Foto: hasilnya file baru yang sudah dipotong.
  - Video: hasilnya hanya area potong (file asli tidak diubah), ditampilkan lewat CSS.
*/
export default function CropEditor({ kind, src, fixedAspect, fixedHint, maxSide = 1600, onCancel, onDone }) {
  const stageRef = useRef(null);
  const mediaRef = useRef(null);
  const [nat, setNat] = useState(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [preset, setPreset] = useState("orig");
  const [z, setZ] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const ptr = useRef(new Map());
  const pinch = useRef(0);
  const lim = useRef({ x: 0, y: 0 });
  useSheet(onCancel);

  useLayoutEffect(() => {
    const el = stageRef.current;
    const ukur = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    ukur();
    window.addEventListener("resize", ukur);
    return () => window.removeEventListener("resize", ukur);
  }, []);

  // Hitungan bingkai dan posisi media
  let g = null;
  if (nat && box.w) {
    const ar = fixedAspect || (preset === "orig" ? clampAr(nat.w / nat.h) : PRESETS.find((p) => p.id === preset).ar);
    let fw = box.w * 0.9;
    let fh = fw / ar;
    if (fh > box.h * 0.9) { fh = box.h * 0.9; fw = fh * ar; }
    const s = Math.max(fw / nat.w, fh / nat.h) * z;
    const iw = nat.w * s;
    const ih = nat.h * s;
    const mx = Math.max(0, (iw - fw) / 2);
    const my = Math.max(0, (ih - fh) / 2);
    g = { ar, fw, fh, s, iw, ih, mx, my, px: clamp(pos.x, -mx, mx), py: clamp(pos.y, -my, my) };
  }
  lim.current = g ? { x: g.mx, y: g.my } : { x: 0, y: 0 };

  const dist = () => {
    const [a, b] = [...ptr.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  };

  const down = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    ptr.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g) setPos({ x: g.px, y: g.py });
    if (ptr.current.size === 2) pinch.current = dist();
  };

  const move = (e) => {
    const prev = ptr.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    ptr.current.set(e.pointerId, cur);
    if (ptr.current.size === 1) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      setPos((p) => ({
        x: clamp(p.x + dx, -lim.current.x, lim.current.x),
        y: clamp(p.y + dy, -lim.current.y, lim.current.y),
      }));
    } else if (ptr.current.size === 2) {
      const d = dist();
      if (pinch.current) setZ((v) => clamp((v * d) / pinch.current, 1, 4));
      pinch.current = d;
    }
  };

  const up = (e) => {
    ptr.current.delete(e.pointerId);
    pinch.current = 0;
  };

  const pilih = (id) => { setPreset(id); setZ(1); setPos({ x: 0, y: 0 }); };

  function selesai() {
    if (!g) return;
    const x0 = (g.iw / 2 - g.fw / 2 - g.px) / g.s;
    const y0 = (g.ih / 2 - g.fh / 2 - g.py) / g.s;
    const cw = g.fw / g.s;
    const ch = g.fh / g.s;

    if (kind === "video") {
      const crop = { x: r4(x0 / nat.w), y: r4(y0 / nat.h), w: r4(cw / nat.w), h: r4(ch / nat.h) };
      const penuh = crop.w >= 0.999 && crop.h >= 0.999;
      return onDone({ crop: penuh ? null : crop, aspect: g.ar });
    }

    setBusy(true);
    const skala = Math.min(1, maxSide / Math.max(cw, ch));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(cw * skala));
    canvas.height = Math.max(1, Math.round(ch * skala));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(mediaRef.current, x0, y0, cw, ch, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return setBusy(false);
      const file = new File([blob], `potong-${Date.now()}.jpg`, { type: "image/jpeg" });
      onDone({ file, url: URL.createObjectURL(file), aspect: g.ar });
    }, "image/jpeg", 0.9);
  }

  const style = g
    ? { width: g.iw, height: g.ih, left: box.w / 2 + g.px - g.iw / 2, top: box.h / 2 + g.py - g.ih / 2 }
    : { opacity: 0, width: 1, height: 1 };

  return createPortal(
    <div className="crop" role="dialog" aria-modal="true" aria-label="Potong">
      <header className="crop-top">
        <button type="button" className="link-btn" onClick={onCancel} disabled={busy}>Batal</button>
        <h2>Potong</h2>
        <button type="button" className="link-btn" onClick={selesai} disabled={!g || busy}>
          {busy ? "Memproses..." : "Selesai"}
        </button>
      </header>

      <div className="crop-stage" ref={stageRef}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onWheel={(e) => setZ((v) => clamp(v * (e.deltaY < 0 ? 1.08 : 0.92), 1, 4))}>
        {kind === "video" ? (
          <video ref={mediaRef} src={src} className="crop-media" style={style} autoPlay loop muted playsInline
            onLoadedMetadata={(e) => setNat({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })} />
        ) : (
          <img ref={mediaRef} src={src} alt="" className="crop-media" style={style} draggable={false}
            onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
        )}
        {g && <div className="crop-frame" style={{ width: g.fw, height: g.fh }} />}
      </div>

      <footer className="crop-bottom">
        {fixedAspect ? (
          <p className="crop-hint">{fixedHint || "Rasio tetap 1:1 untuk foto profil."}</p>
        ) : (
          <div className="crop-presets">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className={"chip" + (preset === p.id ? " on" : "")}
                onClick={() => pilih(p.id)}>{p.label}</button>
            ))}
          </div>
        )}
        <label className="crop-zoom">
          <span>Zoom</span>
          <input type="range" min="1" max="4" step="0.01" value={z} onChange={(e) => setZ(Number(e.target.value))} />
        </label>
        <p className="crop-hint">Geser dan cubit untuk mengatur area yang diambil.</p>
      </footer>
    </div>,
    document.body
  );
}
