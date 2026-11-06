import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "./admin.css";

const menu = [
  { to: "/admin", label: "Ringkasan", end: true },
  { to: "/admin/users", label: "Pengguna" },
  { to: "/admin/banned", label: "Banned" },
  { to: "/admin/posts", label: "Postingan" },
  { to: "/admin/logs", label: "Log" },
];

// Kerangka panel admin: layar penuh, terpisah dari navbar aplikasi
export default function AdminLayout() {
  const navigate = useNavigate();
  return (
    <div className="adm">
      <header className="adm-top">
        <button type="button" className="link-btn" onClick={() => navigate("/profile")}>Kembali</button>
        <h1>Panel admin</h1>
        <span />
      </header>
      <nav className="adm-tabs" aria-label="Menu admin">
        {menu.map((m) => (
          <NavLink key={m.to} to={m.to} end={m.end}>{m.label}</NavLink>
        ))}
      </nav>
      <main className="adm-main"><Outlet /></main>
    </div>
  );
}
