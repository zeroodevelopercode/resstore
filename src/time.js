export function ago(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return "baru saja";
  if (s < 3600) return Math.floor(s / 60) + " menit lalu";
  if (s < 86400) return Math.floor(s / 3600) + " jam lalu";
  if (s < 604800) return Math.floor(s / 86400) + " hari lalu";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Waktu singkat untuk daftar chat: jam hari ini, "Kemarin", atau tanggal
export function shortTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const hari = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const selisih = Math.round((hari(now) - hari(d)) / 86400000);
  if (selisih <= 0) return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  if (selisih === 1) return "Kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
