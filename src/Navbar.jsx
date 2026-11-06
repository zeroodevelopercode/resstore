import { Link } from "react-router-dom";

// Navbar khusus tamu (belum login), dipakai di landing page
export default function Navbar() {
  return (
    <div className="wrap">
      <nav className="nav">
        <Link to="/" className="logo">resstore</Link>
        <ul className="nav-links">
          <li><a href="/#tentang">Tentang</a></li>
          <li><a href="/#cara">Cara kerja</a></li>
          <li><a href="/#katalog">Katalog</a></li>
          <li><a href="/#faq">FAQ</a></li>
        </ul>
        <div className="nav-actions">
          <Link to="/login" className="btn ghost">Masuk</Link>
          <Link to="/register" className="btn">Daftar</Link>
        </div>
      </nav>
    </div>
  );
}
