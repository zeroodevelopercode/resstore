// Centang: merah untuk developer/admin, kuning untuk reseller, biru untuk akun terverifikasi
export default function Badge({ role, verified }) {
  let warna;
  let judul;
  if (role === "admin") { warna = "#c25b5b"; judul = "Developer"; }
  else if (role === "reseller") { warna = "#eab308"; judul = "Reseller Terpercaya"; }
  else if (verified) { warna = "#4a90d9"; judul = "Terverifikasi"; }
  else return null;

  return (
    <span className="badge" title={judul} aria-label={judul}>
      <svg width="16" height="16" viewBox="0 0 24 24">
        <path
          fill={warna}
          d="M12 1.5l2.6 1.9 3.2-.1 1 3 2.6 1.9-1 3 1 3-2.6 1.9-1 3-3.2-.1L12 22.5l-2.6-1.9-3.2.1-1-3L2.6 15.8l1-3-1-3 2.6-1.9 1-3 3.2.1z"
        />
        <path
          d="M8 12.2l2.9 2.9L16.2 9.5"
          fill="none" stroke="#fff" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
