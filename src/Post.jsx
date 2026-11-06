import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon.jsx";
import { useDraft } from "./DraftContext.jsx";
import { IMG_TYPES, VID_TYPES, MAX_PHOTOS } from "./postUtils.js";
import "./post.css";

// Halaman awal: pilih foto atau video. Setelah dipilih, pindah ke layar penuh.
export default function Post() {
  const { reset, addPhotos, setVideo, notice } = useDraft();
  const navigate = useNavigate();
  const photoRef = useRef(null);
  const videoRef = useRef(null);

  // Mulai dari draf kosong setiap kali halaman ini dibuka
  useEffect(() => { reset(); }, [reset]);

  function onPhotos(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (picked.length && addPhotos(picked)) navigate("/post/confirm");
  }

  function onVideo(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f && setVideo(f)) navigate("/post/confirm");
  }

  return (
    <>
      <h1 className="page-title">Buat postingan</h1>
      <p className="sub">Pilih jenis postingan yang ingin dibagikan.</p>
      <div className="pick-cards">
        <button type="button" className="pick-card" onClick={() => photoRef.current.click()}>
          <span className="ico"><Icon name="image" size={22} /></span>
          <h3>Foto</h3>
          <p>Pilih hingga {MAX_PHOTOS} foto dari galeri.</p>
        </button>
        <button type="button" className="pick-card" onClick={() => videoRef.current.click()}>
          <span className="ico"><Icon name="video" size={22} /></span>
          <h3>Video</h3>
          <p>Pilih satu video dari galeri.</p>
        </button>
      </div>
      {notice && <p className="notice">{notice}</p>}
      <input ref={photoRef} type="file" accept={IMG_TYPES.join(",")} multiple hidden onChange={onPhotos} />
      <input ref={videoRef} type="file" accept={VID_TYPES.join(",")} hidden onChange={onVideo} />
    </>
  );
}
