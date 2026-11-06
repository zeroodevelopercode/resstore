import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase.js";

const Ctx = createContext({
  session: null, profile: null, loading: true, ban: null,
  unread: 0, annSince: null, dmUnread: 0,
  refreshProfile: () => {}, markAnnSeen: () => {}, reloadDm: () => {},
});
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [annSince, setAnnSince] = useState(null);
  const [ban, setBan] = useState(null);
  const [dmUnread, setDmUnread] = useState(0);

  const uid = session?.user.id;
  const joined = profile?.created_at;

  const loadProfile = useCallback(async (id) => {
    if (!supabase || !id) return setProfile(null);
    const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    setProfile(data);
  }, []);

  useEffect(() => {
    if (!supabase) return setLoading(false);

    (async () => {
      const { data } = await supabase.auth.getSession();
      let s = data.session;

      // Cek ke server: kalau akun sudah dihapus, sesi lama dibuang otomatis
      if (s) {
        const { error } = await supabase.auth.getUser();
        if (error && [401, 403, 404].includes(error.status)) {
          await supabase.auth.signOut({ scope: "local" });
          s = null;
        }
      }
      setSession(s);
      await loadProfile(s?.user.id);
      setLoading(false);
    })();

    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setTimeout(() => loadProfile(s?.user.id), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [loadProfile]);

  /* ---------- Pengumuman belum dibaca ---------- */
  const loadUnread = useCallback(async () => {
    if (!supabase || !uid || !joined) return;
    const { data: st } = await supabase.from("ann_state").select("seen_at").eq("user_id", uid).maybeSingle();
    const since = st?.seen_at || joined;
    const { count } = await supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .gt("created_at", since)
      .neq("author", uid);
    setAnnSince(since);
    setUnread(count || 0);
  }, [uid, joined]);

  useEffect(() => {
    if (!supabase || !uid || !joined) {
      setUnread(0);
      setAnnSince(null);
      return;
    }
    loadUnread();
    const ch = supabase
      .channel("ann-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, loadUnread)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [uid, joined, loadUnread]);

  const markAnnSeen = useCallback(async (ts) => {
    if (!supabase || !uid || !ts) return;
    setUnread(0);
    setAnnSince(ts);
    await supabase.from("ann_state").upsert({ user_id: uid, seen_at: ts });
  }, [uid]);

  /* ---------- Status ban akunku ---------- */
  const loadBan = useCallback(async () => {
    if (!supabase || !uid) return setBan(null);
    const { data } = await supabase.from("bans").select("until,reason").eq("user_id", uid).maybeSingle();
    if (data && new Date(data.until) > new Date()) {
      setBan({ until: data.until, reason: data.reason, permanent: new Date(data.until).getFullYear() >= 9000 });
    } else {
      setBan(null);
    }
  }, [uid]);

  useEffect(() => {
    if (!supabase || !uid) { setBan(null); return; }
    loadBan();
    const ch = supabase
      .channel("my-ban")
      .on("postgres_changes", { event: "*", schema: "public", table: "bans" }, loadBan)
      .subscribe();
    const iv = setInterval(loadBan, 60000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [uid, loadBan]);

  // Ban sementara berakhir otomatis di layar saat waktunya habis
  useEffect(() => {
    if (!ban || ban.permanent) return;
    const sisa = new Date(ban.until) - Date.now();
    if (sisa <= 0 || sisa > 2147483000) return;
    const t = setTimeout(loadBan, sisa + 500);
    return () => clearTimeout(t);
  }, [ban, loadBan]);

  /* ---------- Pesan chat belum dibaca ---------- */
  const reloadDm = useCallback(async () => {
    if (!supabase || !uid) return;
    const { count } = await supabase
      .from("dm_messages")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .neq("sender", uid);
    setDmUnread(count || 0);
  }, [uid]);

  useEffect(() => {
    if (!supabase || !uid) { setDmUnread(0); return; }
    reloadDm();
    const ch = supabase
      .channel("dm-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_messages" }, reloadDm)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [uid, reloadDm]);

  const refreshProfile = () => loadProfile(uid);

  return (
    <Ctx.Provider value={{
      session, profile, loading, ban, unread, annSince, dmUnread,
      refreshProfile, markAnnSeen, reloadDm,
    }}>
      {children}
    </Ctx.Provider>
  );
}
