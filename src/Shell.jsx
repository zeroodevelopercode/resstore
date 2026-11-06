import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import Icon from "./Icon.jsx";
import BanScreen from "./BanScreen.jsx";

const tabs = [
  { to: "/home", icon: "home", label: "Beranda" },
  { to: "/messages", icon: "message", label: "Pesan" },
  { to: "/post", icon: "post", label: "Posting" },
  { to: "/announcements", icon: "announce", label: "Pengumuman" },
  { to: "/profile", icon: "user", label: "Profil" },
];

// Kerangka halaman setelah login: header atas + navbar bawah
export default function Shell() {
  const { session, loading, unread, dmUnread, ban } = useAuth();
  const { pathname } = useLocation();

  if (loading) return <div className="boot">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (ban) return <BanScreen />;

  const hitung = { "/announcements": unread, "/messages": dmUnread };

  return (
    <div className="shell">
      <header className="topbar"><span className="logo">resstore</span></header>
      <main className="shell-main">
        <div className="page" key={pathname}><Outlet /></div>
      </main>
      <div className="tabbar">
        <nav aria-label="Navigasi utama">
          {tabs.map((t) => {
            const count = hitung[t.to] || 0;
            return (
              <NavLink key={t.to} to={t.to}
                aria-label={count ? `${t.label}, ${count} belum dibaca` : t.label}
                className={({ isActive }) => "tab" + (isActive ? " on" : "")}>
                <Icon name={t.icon} />
                {count > 0 && <span className="tab-count">{count > 9 ? "9+" : count}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
