import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDraft } from "./DraftContext.jsx";
import CropEditor from "./CropEditor.jsx";
import { IMG_TYPES, VID_TYPES, MAX_PHOTOS, cropStyle } from "./postUtils.js";
import "./post.css";

// Layar penuh tanpa header dan navbar. Kartu dan tombol konfirmasi ada di bawah.
export default function PostConfirm() {
  const { kind, items, notice, addPhotos, setVideo, remove, updateItem, reset } = useDraft();
  const navigate = useNavigate();
  const [focus, setFocus] = useState(0);
  const [cropping, setCropping] = useState(false);
  const photoRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!items.length) navigate("/post", { replace: true });
  }, [items.length, navigate]);

  if (!items.length) return null;
  const cur = items[Math.min(focus, items.length - 1)];

  function batal() {
    reset();
    navigate("/post", { replace: true });
  }

  function onPhotos(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (picked.length) addPhotos(picked);
  }

  function onVideo(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) setVideo(f);
  }

  function hasilPotong(r) {
    if (kind === "video") updateItem(cur.id, { crop: r.crop, aspect: r.crop ? r.aspect : null });
    else updateItem(cur.id, { file: r.file, url: r.url });
    setCropping(false);
  }

  return (
    <div className="fs">
      <header className="fs-top">
        <button type="button" className="link-btn" onClick={batal}>Batal</button>
        <h1>{kind === "photo" ? "Konfirmasi foto" : "Konfirmasi video"}</h1>
        <span className="fs-count">{kind === "photo" ? `${items.length}/${MAX_PHOTOS}` : ""}</span>
      </header>

      <div className="fs-stage">
        {kind === "video" ? (
          cur.crop ? (
            <div className="crop-box" style={{ "--ar": cur.aspect || 1 }}>
              <video key={cur.id} src={cur.url} style={cropStyle(cur.crop)} autoPlay loop muted playsInline />
            </div>
          ) : (
            <video key={cur.id} src={cur.url} autoPlay loop muted playsInline />
          )
        ) : (
          <img src={cur.url} alt={`Foto ${items.indexOf(cur) + 1}`} />
        )}
      </div>

      <footer className="fs-bottom">
        {notice && <p className="fs-notice">{notice}</p>}

        {kind === "photo" && (
          <div className="strip">
            {items.map((it, i) => (
              <div className={"mini" + (it === cur ? " on" : "")} key={it.id}>
                <button type="button" className="mini-img" onClick={() => setFocus(i)} aria-label={`Lihat foto ${i + 1}`}>
                  <img src={it.url} alt="" />
                </button>
                <span className="idx">{i + 1}</span>
                <button type="button" className="rm" onClick={() => remove(it.id)} aria-label={`Hapus foto ${i + 1}`}>×</button>
              </div>
            ))}
            {items.length < MAX_PHOTOS && (
              <button type="button" className="mini add" onClick={() => photoRef.current.click()}>Tambah</button>
            )}
          </div>
        )}

        <div className="row-actions two">
          <button type="button" className="btn ghost sm" onClick={() => setCropping(true)}>
            {kind === "photo" ? "Potong foto ini" : "Potong video"}
          </button>
          {kind === "video" && (
            <button type="button" className="btn ghost sm" onClick={() => videoRef.current.click()}>Ganti video</button>
          )}
        </div>

        <div className="confirm">
          <h3>Posting ke feed?</h3>
          <p>
            {kind === "photo"
              ? `${items.length} foto ini akan dipasang berurutan di postinganmu.`
              : "Video ini akan dipasang di postinganmu."}
          </p>
          <div className="confirm-actions">
            <button type="button" className="btn ghost" onClick={batal}>Batal</button>
            <button type="button" className="btn" onClick={() => navigate("/post/detail")}>Ya, lanjutkan</button>
          </div>
        </div>
      </footer>

      {cropping && (
        <CropEditor kind={kind === "video" ? "video" : "image"} src={cur.srcUrl}
          onCancel={() => setCropping(false)} onDone={hasilPotong} />
      )}

      <input ref={photoRef} type="file" accept={IMG_TYPES.join(",")} multiple hidden onChange={onPhotos} />
      <input ref={videoRef} type="file" accept={VID_TYPES.join(",")} hidden onChange={onVideo} />
    </div>
  );
}
