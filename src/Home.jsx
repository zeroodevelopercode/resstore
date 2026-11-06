import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import PostCard from "./PostCard.jsx";

const demo = [
  { id: "d1", caption: "Stok baru minggu ini sudah masuk.", profiles: { username: "toko.maju", role: "user" } },
  { id: "d2", caption: "Koleksi aplikasi desain terbaru.", profiles: { username: "pixel.studio", role: "user" } },
  { id: "d3", caption: "Promo akhir bulan, cek katalog kami.", profiles: { username: "ledger.id", role: "user" } },
];

// Postingan dengan #resstoretop mendapat bonus 24 jam, jadi tampil lebih tinggi di beranda
const skor = (p) => new Date(p.created_at).getTime() + (p.boosted ? 24 * 3600 * 1000 : 0);

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) return setReady(true);

    const muat = async () => {
      // 1. Ambil data POSTINGAN murni (tanpa join profiles)
      const { data: postsData, error } = await supabase
        .from("posts")
        .select("id,author,media_url,media_type,media_urls,media_crop,aspect,link,music,boosted,like_count,caption,created_at")
        .is("takedown_at", null)
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) {
        console.error("Gagal ambil data postingan:", error);
        return setReady(true);
      }

      const list = postsData || [];

      // 2. Ambil data PROFIL secara terpisah berdasarkan author ID
      if (list.length > 0) {
        const authorIds = [...new Set(list.map((p) => p.author))]; 
        
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id,username,role,verified,avatar_url")
          .in("id", authorIds);

        // 3. Gabungkan data profil ke masing-masing postingan
        const profileMap = {};
        (profilesData || []).forEach((prof) => {
          profileMap[prof.id] = prof;
        });

        list.forEach((p) => {
          p.profiles = profileMap[p.author] || { username: "unknown", role: "user" };
        });
      }

      // 4. Ambil data LIKE
      let mine = new Set();
      if (list.length) {
        const { data: l } = await supabase
          .from("post_likes")
          .select("post_id")
          .in("post_id", list.map((p) => p.id));
        mine = new Set((l || []).map((x) => x.post_id));
      }
      list.forEach((p) => { p.liked = mine.has(p.id); });

      // 5. Set data dan urutkan
      setPosts(list.sort((a, b) => skor(b) - skor(a)));
      setReady(true);
    };

    muat();

    // Realtime listener
    const ch = supabase
      .channel("posts-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, muat)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, muat)
      .subscribe();
      
    return () => supabase.removeChannel(ch);
  }, []);

  if (!ready) return <p className="notice">Memuat beranda...</p>;

  const kosong = posts.length === 0;

  return (
    <>
      {kosong && (
        <p className="notice">
          Belum ada postingan. Ini contoh tampilan, postingan asli akan muncul di sini.
        </p>
      )}
      {(kosong ? demo : posts).map((p) => <PostCard key={p.id} post={p} />)}
    </>
  );
}