import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase.js";
import { useAuth } from "./AuthContext.jsx";
import StoryViewer from "./StoryViewer.jsx";

const Ctx = createContext({ groups: new Map(), hasStory: () => false, openStory: () => {}, reload: () => {} });
export const useStories = () => useContext(Ctx);

// Menyimpan daftar cerita aktif (24 jam), dikelompokkan per akun
export function StoryProvider({ children }) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [groups, setGroups] = useState(new Map());
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    if (!supabase || !uid) return;
    const { data } = await supabase
      .from("stories")
      .select("id,author,media_url,media_type,crop,aspect,music,created_at,profiles(username,role,verified,avatar_url)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(300);
    const m = new Map();
    (data || []).forEach((s) => {
      if (!m.has(s.author)) m.set(s.author, { id: s.author, profile: s.profiles, items: [] });
      m.get(s.author).items.push(s);
    });
    setGroups(m);
  }, [uid]);

  useEffect(() => {
    if (!supabase || !uid) { setGroups(new Map()); return; }
    load();
    const ch = supabase
      .channel("stories-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, load)
      .subscribe();
    const iv = setInterval(load, 5 * 60 * 1000); // buang cerita yang sudah kedaluwarsa
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [uid, load]);

  // Urutan cerita: milikku dulu, lalu yang terbaru. Dipakai untuk lanjut ke cerita akun berikutnya.
  const order = useMemo(() => {
    const ts = (g) => new Date(g.items[g.items.length - 1].created_at).getTime();
    return [...groups.values()]
      .sort((a, b) => (a.id === uid ? -1 : b.id === uid ? 1 : ts(b) - ts(a)))
      .map((g) => g.id);
  }, [groups, uid]);

  const value = {
    groups,
    hasStory: (id) => groups.has(id),
    openStory: setViewing,
    reload: load,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {viewing && groups.has(viewing) && (
        <StoryViewer key={viewing} groups={groups} order={order} startId={viewing} onClose={() => setViewing(null)} />
      )}
    </Ctx.Provider>
  );
}
