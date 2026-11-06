import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase.js";
import { useAuth } from "./AuthContext.jsx";
import Badge from "./Badge.jsx";

const tanggal = (iso) =>
  new Date(iso).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const jam = (iso) =>
  new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

// Pengumuman dibuat lewat konsol admin (.ann). Halaman ini hanya menampilkan.
export default function Announcements() {
  const { profile, unread, annSince, markAnnSeen } = useAuth();
  const admin = profile?.role === "admin";
  const [list, setList] = useState([]);
  const [ready, setReady] = useState(false);

  // Waktu terakhir baca SEBELUM halaman ini dibuka, untuk menandai yang "Baru"
  const baseline = useRef(undefined);
  if (baseline.current === undefined && annSince) baseline.current = annSince;

  const muat = async () => {
    if (!supabase) return setReady(true);
    const { data } = await supabase
      .from("announcements")
      .select("id,title,body,created_at,author")
      .order("created_at", { ascending: false })
      .limit(50);
    setList(data || []);
    setReady(true);
  };

  useEffect(() => {
    muat();
    if (!supabase) return;
    const ch = supabase
      .channel("ann-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, muat)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  // Selama halaman terbuka, semua yang tampil dianggap sudah dibaca
  useEffect(() => {
    if (unread > 0 && list.length) markAnnSeen(list[0].created_at);
  }, [unread, list, markAnnSeen]);

  async function hapus(id) {
    await supabase.from("announcements").delete().eq("id", id);
  }

  const baru = (a) =>
    baseline.current && a.author !== profile?.id && new Date(a.created_at) > new Date(baseline.current);

  return (
    <>
      <h1 className="page-title">Pengumuman</h1>
      {ready && list.length === 0 && <p className="notice">Belum ada pengumuman.</p>}

      <div className="ann-list">
        {list.map((a) => (
          <article className={"ann-card" + (baru(a) ? " baru" : "")} key={a.id}>
            <div className="ann-top">
              <span className="ann-from">Admin<Badge role="admin" /></span>
              <span className="ann-right">
                {baru(a) && <span className="ann-new">Baru</span>}
                {admin && <button className="link-btn del" onClick={() => hapus(a.id)}>Hapus</button>}
              </span>
            </div>
            {a.title !== "Pengumuman" && <h3>{a.title}</h3>}
            <p className="ann-body">{a.body}</p>
            <div className="ann-foot">
              <span>{tanggal(a.created_at)}</span>
              <span>{jam(a.created_at)}</span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
