// Layanan Musik via iTunes API (100% Gratis, Tanpa API Key)
export const musicReady = true;
export const musicDirect = true; // Biar ga nampilin warning API key di UI

export const PAGE_SIZE = 20;
const cari = new Map();
const audioCache = new Map(); // Nyimpen link audio biar ga bolak-balik fetch

// 1. Fungsi pencarian lagu
export async function searchMusic(query, offset = 0) {
  const q = query.trim();
  if (q.length < 2) return [];
  
  const k = `${q.toLowerCase()}:${offset}`;
  if (cari.has(k)) return cari.get(k);

  const limit = PAGE_SIZE;
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=${limit}&offset=${offset}`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error("Gagal memuat musik dari iTunes");
  
  const data = await res.json();
  
  // Format data dari iTunes biar sesuai sama MusicSheet
  const hasil = (data.results || []).map(item => {
    const audioUrl = item.previewUrl || null;
    
    // Simpan URL audio ke cache sementara
    if (audioUrl) audioCache.set(String(item.trackId), audioUrl);

    return {
      id: "it" + item.trackId,
      spotify_id: String(item.trackId), // Tetep namanya spotify_id biar ga error di MusicSheet
      title: item.trackName,
      artist: item.artistName,
      cover: item.artworkUrl100 ? item.artworkUrl100.replace("100x100", "300x300") : null,
      url: audioUrl,
      provider: "itunes",
    };
  });

  if (cari.size > 80) cari.clear();
  cari.set(k, hasil);
  return hasil;
}

// 2. Ambil audio saat lagu diputar/dipilih
export async function resolveAudio(trackId) {
  const id = String(trackId);
  
  // Kalau udah ada di cache, langsung kasih
  if (audioCache.has(id)) return audioCache.get(id);
  
  // Kalau karena satu dan lain hal ga ada di cache, kita fetch manual by ID
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${id}`);
    const data = await res.json();
    const item = data.results?.[0];
    const url = item?.previewUrl || null;
    
    if (url) audioCache.set(id, url);
    return url;
  } catch {
    return null;
  }
}