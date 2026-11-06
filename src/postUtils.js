export const MAX_PHOTOS = 15;
export const MAX_IMG = 10 * 1024 * 1024;
export const MAX_VID = 50 * 1024 * 1024;
export const IMG_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const VID_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const EXT = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};
export const TAG = "#resstoretop";

export const keyOf = (f) => `${f.name}-${f.size}-${f.lastModified}`;
export const isHttps = (u) => typeof u === "string" && /^https:\/\//i.test(u);

// Audio hanya boleh dari layanan musik yang kita pakai (mencegah tautan pelacak)
// Tambahan: izinkan domain mzstatic (Apple) dan itunes
const AUDIO_HOSTS = /(^|\.)(itunes\.apple\.com|mzstatic\.com|jamendo\.com|scdn\.co|audio-ssl\.itunes\.apple\.com)$/i;

export function isAllowedAudio(u) {
  if (typeof u !== "string") return false;
  // Paksa https
  const secureUrl = u.replace(/^http:\/\//i, "https://");
  try { 
    return AUDIO_HOSTS.test(new URL(secureUrl).hostname); 
  } catch { 
    return false; 
  }
}

export const PROVIDER_LABEL = { itunes: "Apple", jamendo: "Jamendo", spotify: "Spotify" };
const isCcLicense = (u) => {
  if (!isHttps(u)) return false;
  try { return new URL(u).hostname.endsWith("creativecommons.org"); } catch { return false; }
};

// Hanya http/https yang diterima, selain itu ditolak
export function normalizeLink(v) {
  const t = v.trim();
  if (!t) return "";
  const withScheme = /^https?:\/\//i.test(t) ? t : "https://" + t;
  try {
    const u = new URL(withScheme);
    if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes(".")) return null;
    return u.href.length <= 300 ? u.href : null;
  } catch {
    return null;
  }
}

export function cleanMusic(m) {
  if (!m) return null;
  
  // Paksa URL jadi https biar aman dan lolos validasi
  let safeUrl = m.url || null;
  if (safeUrl) {
    safeUrl = safeUrl.replace(/^http:\/\//i, "https://");
  }

  return {
    id: String(m.id || "").slice(0, 80),
    title: String(m.title || "Lagu").slice(0, 100),
    artist: String(m.artist || "").slice(0, 100),
    cover: isHttps(m.cover) ? m.cover : null,
    // Kita panggil isAllowedAudio dengan URL yang udah di-https-kan
    url: isAllowedAudio(safeUrl) ? safeUrl : null,
    provider: PROVIDER_LABEL[m.provider] ? m.provider : "itunes",
    license: isCcLicense(m.license) ? m.license : null,
    spotify_id: /^[A-Za-z0-9]{10,30}$/.test(m.spotify_id || "") ? m.spotify_id : null,
  };
}

// Ukuran asli foto/video
export function measure(it, kind) {
  return new Promise((res) => {
    if (kind === "video") {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.onloadedmetadata = () => res({ w: v.videoWidth, h: v.videoHeight });
      v.onerror = () => res(null);
      v.src = it.url;
    } else {
      const im = new Image();
      im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
      im.onerror = () => res(null);
      im.src = it.url;
    }
  });
}

// Ambil rasio dari media yang paling besar. Yang lebih kecil diisi hitam di feed.
export function pickAspect(dims) {
  const ok = dims.filter((d) => d && d.w > 0 && d.h > 0);
  if (!ok.length) return null;
  const big = ok.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
  const ar = big.w / big.h;
  return Math.min(1.91, Math.max(0.5625, Math.round(ar * 1000) / 1000));
}

// Gaya untuk menampilkan video yang dipotong (tanpa mengubah file aslinya).
// Dipakai di dalam kotak yang rasionya sama dengan area potong.
export function cropStyle(c) {
  return {
    position: "absolute", right: "auto", bottom: "auto", maxWidth: "none", maxHeight: "none",
    width: `${100 / c.w}%`, height: `${100 / c.h}%`,
    left: `${-(c.x / c.w) * 100}%`, top: `${-(c.y / c.h) * 100}%`,
    objectFit: "fill",
  };
}

// Rasio bingkai postingan, dihitung dari media paling besar setelah dipotong
export async function aspectOf(items, kind) {
  const dims = await Promise.all(items.map((it) => measure(it, kind)));
  return pickAspect(
    dims.map((d, i) => (d && items[i].crop ? { w: d.w * items[i].crop.w, h: d.h * items[i].crop.h } : d))
  );
}