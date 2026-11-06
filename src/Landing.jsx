import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabase.js";
import Navbar from "./Navbar.jsx";

const demo = [
  { id: 1, name: "Notely", category: "Produktivitas", price: 0 },
  { id: 2, name: "Pixelkit", category: "Desain", price: 49000 },
  { id: 3, name: "Ledgerly", category: "Keuangan", price: 79000 },
  { id: 4, name: "Stockwise", category: "Bisnis", price: 0 },
  { id: 5, name: "Clipbox", category: "Utilitas", price: 15000 },
  { id: 6, name: "Fieldnote", category: "Produktivitas", price: 0 },
];

const rupiah = (n) => (n === 0 ? "Gratis" : "Rp " + n.toLocaleString("id-ID"));

const pembeli = [
  "Jelajahi aplikasi berdasarkan kategori",
  "Cari dengan cepat lewat kolom pencarian",
  "Lihat harga dengan jelas sebelum memilih",
];
const penjual = [
  "Pasang aplikasimu di katalog",
  "Atur harga dan kategori sendiri",
  "Kelola stok dari satu akun",
];
const langkah = [
  { t: "Buat akun", d: "Daftar dengan email. Gratis dan hanya butuh satu menit." },
  { t: "Pilih peranmu", d: "Cari aplikasi untuk dibeli, atau pasang aplikasimu untuk dijual." },
  { t: "Mulai berjalan", d: "Katalog diperbarui langsung, tanpa perlu muat ulang halaman." },
];
const faq = [
  { q: "Apakah daftar di resstore gratis?", a: "Ya. Membuat akun tidak dipungut biaya." },
  { q: "Bagaimana kalau aku lupa password?", a: "Hubungi admin lewat halaman Masuk. Admin akan membantu mengatur ulang passwordmu." },
  { q: "Apakah data akunku aman?", a: "Login dikelola sistem autentikasi terpisah, dan setiap data hanya bisa diubah oleh pemiliknya." },
];

export default function Landing() {
  const [apps, setApps] = useState(demo);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!supabase) return;
    const muat = async () => {
      const { data } = await supabase
        .from("apps")
        .select("id,name,category,price")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data?.length) setApps(data);
    };
    muat();

    const ch = supabase
      .channel("apps-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "apps" }, muat)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const hasil = apps.filter((a) =>
    (a.name + a.category).toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <>
      <Navbar />
      <header className="hero">
        <div className="wrap">
          <h1>
            Jual dan beli aplikasi <span>di satu tempat.</span>
          </h1>
          <p className="lead">
            resstore adalah toko aplikasi online. Pembeli menemukan aplikasi yang
            mereka butuhkan, penjual memasarkan dan mengelola stoknya sendiri.
          </p>
          <div className="actions">
            <Link to="/register" className="btn">Daftar gratis</Link>
            <a href="#katalog" className="btn ghost">Lihat katalog</a>
          </div>
        </div>
      </header>

      <section id="tentang" className="section">
        <div className="wrap">
          <h2>Apa itu resstore?</h2>
          <p className="lead">
            Nama resstore berasal dari "store you stock": toko tempat kamu
            menyimpan dan memajang stokmu sendiri. Ada dua peran di sini, dan
            satu akun bisa menjalankan keduanya.
          </p>
          <div className="cols">
            <article className="cell">
              <h3>Untuk pembeli</h3>
              <ul>{pembeli.map((x) => <li key={x}>{x}</li>)}</ul>
            </article>
            <article className="cell">
              <h3>Untuk penjual</h3>
              <ul>{penjual.map((x) => <li key={x}>{x}</li>)}</ul>
            </article>
          </div>
        </div>
      </section>

      <section id="cara" className="section">
        <div className="wrap">
          <h2>Cara kerja</h2>
          <div className="cols">
            {langkah.map((s, i) => (
              <article className="cell" key={s.t}>
                <div className="icon">{i + 1}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="katalog" className="section">
        <div className="wrap">
          <h2>Katalog aplikasi</h2>
          <input
            className="input search"
            type="search"
            placeholder="Cari aplikasi atau kategori"
            value={q}
            maxLength={60}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="grid" aria-label="Daftar aplikasi">
            {hasil.map((a) => (
              <article className="app" key={a.id}>
                <div className="icon">{a.name[0]}</div>
                <div className="info">
                  <h3>{a.name}</h3>
                  <p>{a.category}</p>
                </div>
                <span className="price">{rupiah(a.price)}</span>
              </article>
            ))}
            {hasil.length === 0 && <p className="empty">Tidak ada aplikasi yang cocok.</p>}
          </div>
        </div>
      </section>

      <section id="faq" className="section">
        <div className="wrap">
          <h2>Pertanyaan umum</h2>
          <div className="faq">
            {faq.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap">
        <div className="cta">
          <h2>Siap mulai? Buat akunmu sekarang.</h2>
          <Link to="/register" className="btn">Daftar gratis</Link>
        </div>
      </section>

      <div className="wrap">
        <footer className="footer">
          <span>© 2026 resstore | store you stock</span>
          <Link to="/login">Masuk</Link>
        </footer>
      </div>
    </>
  );
}
