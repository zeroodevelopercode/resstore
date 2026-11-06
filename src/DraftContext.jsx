import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  IMG_TYPES, VID_TYPES, MAX_IMG, MAX_VID, MAX_PHOTOS, keyOf,
} from "./postUtils.js";

const Ctx = createContext(null);
export const useDraft = () => useContext(Ctx);

// item: { id, file, url, srcUrl, crop?, aspect? }
// srcUrl = media asli (untuk memotong ulang), url = hasil potong (foto) atau sama dengan srcUrl
const free = (it) => {
  URL.revokeObjectURL(it.url);
  if (it.srcUrl && it.srcUrl !== it.url) URL.revokeObjectURL(it.srcUrl);
};

// Menyimpan draf postingan supaya bisa dipakai lintas halaman (pilih, konfirmasi, detail)
export function DraftProvider({ children }) {
  const [kind, setKind] = useState(null);
  const [items, setItems] = useState([]);
  const [notice, setNotice] = useState("");
  const [desc, setDesc] = useState("");
  const [link, setLink] = useState("");
  const [music, setMusic] = useState(null);
  const [boost, setBoost] = useState(false);
  const ref = useRef([]);

  const put = (next) => { ref.current = next; setItems(next); };

  const reset = useCallback(() => {
    ref.current.forEach(free);
    ref.current = [];
    setItems([]); setKind(null); setNotice("");
    setDesc(""); setLink(""); setMusic(null); setBoost(false);
  }, []);

  const baru = (f) => {
    const url = URL.createObjectURL(f);
    return { id: keyOf(f), file: f, url, srcUrl: url };
  };

  // Menambah foto (maks 15). Mengembalikan true bila ada foto di draf.
  const addPhotos = (picked) => {
    const msgs = [];
    let valid = picked.filter((f) => IMG_TYPES.includes(f.type) && f.size <= MAX_IMG);
    if (valid.length < picked.length)
      msgs.push(`${picked.length - valid.length} file dilewati (hanya JPG, PNG, WEBP, maks 10 MB).`);

    const ada = new Set(ref.current.map((i) => i.id));
    valid = valid.filter((f) => !ada.has(keyOf(f)));

    const room = MAX_PHOTOS - ref.current.length;
    if (valid.length > room)
      msgs.push(`Maksimal ${MAX_PHOTOS} foto. ${valid.length - room} foto tidak diikutkan.`);

    const tambah = valid.slice(0, Math.max(room, 0)).map(baru);
    setNotice(msgs.join(" "));
    const next = [...ref.current, ...tambah];
    if (!next.length) return false;
    setKind("photo");
    put(next);
    return true;
  };

  const setVideo = (f) => {
    if (!VID_TYPES.includes(f.type)) { setNotice("Format video tidak didukung. Gunakan MP4, WEBM, atau MOV."); return false; }
    if (f.size > MAX_VID) { setNotice("Video terlalu besar. Maksimal 50 MB."); return false; }
    ref.current.forEach(free);
    setNotice("");
    setKind("video");
    put([baru(f)]);
    return true;
  };

  const remove = (id) => {
    const it = ref.current.find((i) => i.id === id);
    if (it) free(it);
    put(ref.current.filter((i) => i.id !== id));
  };

  // Ubah satu item (hasil potong). Hasil potong lama dibuang, media asli tetap disimpan.
  const updateItem = (id, patch) => {
    put(ref.current.map((i) => {
      if (i.id !== id) return i;
      if (patch.url && patch.url !== i.url && i.url !== i.srcUrl) URL.revokeObjectURL(i.url);
      return { ...i, ...patch };
    }));
  };

  return (
    <Ctx.Provider value={{
      kind, items, notice, desc, link, music, boost,
      setDesc, setLink, setMusic, setBoost, setNotice,
      addPhotos, setVideo, remove, updateItem, reset,
    }}>
      {children}
    </Ctx.Provider>
  );
}
