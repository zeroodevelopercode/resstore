import { Fragment, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "./supabase.js";
import { useAuth } from "./AuthContext.jsx";
import Avatar from "./Avatar.jsx";
import Badge from "./Badge.jsx";
import useViewportFit from "./useViewportFit.js";
import "./chat.css";

const jam = (iso) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const kunciHari = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
function labelHari(iso) {
  const d = new Date(iso);
  const n = new Date();
  const h = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const s = Math.round((h(n) - h(d)) / 86400000);
  if (s <= 0) return "Hari ini";
  if (s === 1) return "Kemarin";
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// Layar chat penuh tanpa navbar. Kolom ketik menempel di atas keyboard.
export default function Chat() {
  const { username } = useParams();
  const { profile: me, ban, reloadDm } = useAuth();
  const navigate = useNavigate();
  const [other, setOther] = useState(null);
  const [tid, setTid] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [state, setState] = useState("loading"); // loading | ok | notfound | error
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const nempel = useRef(true); // true = tetap di bawah saat ada pesan baru

  const keBawah = () => {
    const el = listRef.current;
    if (el && nempel.current) el.scrollTop = el.scrollHeight;
  };
  useViewportFit(rootRef, keBawah);

  /* ---------- Muat lawan bicara dan riwayat ---------- */
  useEffect(() => {
    let off = false;
    (async () => {
      setState("loading");
      const { data: o } = await supabase.from("profiles")
        .select("id,username,role,verified,avatar_url").eq("username", username.toLowerCase()).maybeSingle();
      if (off) return;
      if (!o || o.id === me.id) return setState("notfound");
      setOther(o);

      const { data: id, error } = await supabase.rpc("start_dm", { p_other: o.id });
      if (off) return;
      if (error) return setState("error");
      setTid(id);

      const { data: m } = await supabase.from("dm_messages")
        .select("id,sender,body,created_at,read_at").eq("thread_id", id)
        .order("created_at", { ascending: false }).limit(100);
      if (off) return;
      nempel.current = true;
      setMsgs((m || []).reverse());
      setState("ok");
    })();
    return () => { off = true; };
  }, [username, me.id]);

  /* ---------- Pesan baru secara langsung ---------- */
  useEffect(() => {
    if (!tid) return;
    const ch = supabase
      .channel("dm-" + tid)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages", filter: `thread_id=eq.${tid}` },
        (p) => setMsgs((prev) => (prev.some((x) => x.id === p.new.id) ? prev : [...prev, p.new])))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "dm_messages", filter: `thread_id=eq.${tid}` },
        (p) => setMsgs((prev) => prev.map((x) => (x.id === p.new.id ? { ...x, ...p.new } : x))))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [tid]);

  /* ---------- Tandai pesan masuk sebagai dibaca ---------- */
  useEffect(() => {
    if (!tid) return;
    const adaBaru = msgs.some((m) => m.sender !== me.id && !m.read_at);
    if (!adaBaru || document.hidden) return;
    const waktu = new Date().toISOString();
    supabase.from("dm_messages").update({ read_at: waktu })
      .eq("thread_id", tid).neq("sender", me.id).is("read_at", null)
      .then(({ error }) => {
        if (error) return;
        setMsgs((p) => p.map((m) => (m.sender !== me.id && !m.read_at ? { ...m, read_at: waktu } : m)));
        reloadDm();
      });
  }, [msgs, tid]); // eslint-disable-line

  // Saat aplikasi dibuka lagi, periksa ulang pesan yang belum dibaca
  useEffect(() => {
    const f = () => { if (!document.hidden) setMsgs((p) => [...p]); };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);

  useEffect(keBawah, [msgs.length]);

  // Kolom ketik tumbuh sesuai isi
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [text]);

  async function kirim() {
    const body = text.trim();
    if (!body || sending || !tid || ban) return;
    setSending(true);
    setErr("");
    const { data, error } = await supabase.from("dm_messages")
      .insert({ thread_id: tid, body })
      .select("id,sender,body,created_at,read_at").single();
    setSending(false);
    if (error) return setErr("Pesan gagal dikirim. Coba lagi.");
    nempel.current = true;
    setText("");
    setMsgs((p) => (p.some((x) => x.id === data.id) ? p : [...p, data]));
    inputRef.current?.focus();
  }

  const onScroll = (e) => {
    const el = e.currentTarget;
    nempel.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const halusPointer = typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches;
  const lastMine = [...msgs].reverse().find((m) => m.sender === me.id);

  return (
    <div className="chat" ref={rootRef}>
      <header className="chat-top">
        <button type="button" className="link-btn" onClick={() => navigate("/messages")}>Kembali</button>
        {other && (
          <button type="button" className="chat-who" onClick={() => navigate(`/u/${other.username}`)}>
            <Avatar user={other} />
            <b>{other.username}<Badge role={other.role} verified={other.verified} /></b>
          </button>
        )}
        <span />
      </header>

      <div className="chat-list" ref={listRef} onScroll={onScroll}>
        {state === "loading" && <p className="chat-note">Memuat percakapan...</p>}
        {state === "notfound" && <p className="chat-note">Akun tidak ditemukan.</p>}
        {state === "error" && <p className="chat-note">Gagal membuka percakapan. Coba lagi.</p>}
        {state === "ok" && msgs.length === 0 && (
          <p className="chat-note">Belum ada pesan. Kirim pesan pertama ke {other?.username}.</p>
        )}

        {msgs.map((m, i) => {
          const mine = m.sender === me.id;
          const prev = msgs[i - 1];
          const hariBaru = !prev || kunciHari(prev.created_at) !== kunciHari(m.created_at);
          const awal = hariBaru || prev.sender !== m.sender;
          return (
            <Fragment key={m.id}>
              {hariBaru && <div className="chat-day"><span>{labelHari(m.created_at)}</span></div>}
              <div className={"msg " + (mine ? "me" : "them") + (awal ? " first" : "")}>
                <div className="bubble">
                  <span className="b-text">{m.body}</span>
                  <span className="b-time">{jam(m.created_at)}</span>
                </div>
                {lastMine?.id === m.id && <span className="b-status">{m.read_at ? "Dibaca" : "Terkirim"}</span>}
              </div>
            </Fragment>
          );
        })}
      </div>

      {err && <p className="chat-err" role="alert">{err}</p>}
      {ban ? (
        <p className="chat-note ban-note">Akunmu sedang dibanned, jadi tidak bisa mengirim pesan.</p>
      ) : (
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); kirim(); }}>
          <textarea ref={inputRef} rows={1} value={text} maxLength={2000} placeholder="Tulis pesan"
            aria-label="Pesan" disabled={state !== "ok"}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (halusPointer && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); kirim(); }
            }} />
          <button className="btn" disabled={!text.trim() || sending || state !== "ok"}>Kirim</button>
        </form>
      )}
    </div>
  );
}
