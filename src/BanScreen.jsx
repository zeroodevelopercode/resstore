import { supabase } from "./supabase.js";
import { useAuth } from "./AuthContext.jsx";
import "./chat.css";

const fmt = (iso) =>
  new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Tampil menggantikan seluruh aplikasi saat akunmu sedang dibanned
export default function BanScreen() {
  const { ban } = useAuth();
  async function keluar() {
    await supabase.auth.signOut({ scope: "local" });
    window.location.href = "/";
  }
  return (
    <div className="ban">
      <div className="ban-box">
        <h1>Akunmu sedang dibanned</h1>
        <p className="ban-until">
          {ban.permanent ? "Ban berlaku permanen." : `Ban berlaku sampai ${fmt(ban.until)}.`}
        </p>
        <div className="ban-reason">
          <span>Alasan</span>
          <p>{ban.reason}</p>
        </div>
        <p className="muted">Selama dibanned kamu tidak bisa memposting, mengirim pesan, atau menyukai postingan. Kalau merasa ini keliru, hubungi admin.</p>
        <button type="button" className="btn ghost full" onClick={keluar}>Keluar</button>
      </div>
    </div>
  );
}
