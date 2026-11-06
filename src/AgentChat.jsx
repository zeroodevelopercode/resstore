import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";
import useViewportFit from "./useViewportFit.js";
import "./crop.css";
import "./agent.css";

const DEFAULT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:8787";

const CHIPS = [
  { label: "Cek database", kirim: "Cek database" },
  { label: "Daftar data", kirim: "Tampilkan daftar data" },
  { label: "Daftar file", kirim: "Tampilkan daftar file data" },
  { label: "Analisa kesalahan", kirim: "Analisa kesalahan data" },
  { label: "Verifikasi yang bersih", kirim: "Verifikasi semua data yang bersih" },
  { label: "Laporan 3 hari", kirim: "Laporan revisi 3 hari terakhir" },
  { label: "Masuk data...", isi: "Masuk data ini: " },
];

const NAMA_TOOL = {
  db_check: "Memeriksa database",
  list_accounts: "Mencari akun",
  db_overview: "Membuat ringkasan data",
  list_items: "Mengambil daftar data",
  analyze_errors: "Menganalisa kesalahan",
  apply_fix: "Menyiapkan perbaikan",
  verify_item: "Memeriksa untuk verifikasi",
  verify_all_clean: "Mencari item yang bersih",
  flag_item: "Menyiapkan penolakan",
  insert_data: "Menyiapkan data masuk",
  list_paths: "Melihat folder data",
  read_path: "Membaca file",
  import_path: "Membaca file untuk impor",
  revision_report: "Menyusun laporan revisi",
  send_report: "Menyiapkan pengiriman laporan",
};

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* abaikan */ } };

// Teks agent: **tebal** dan blok kode ```...```
function Inline({ text }) {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((p, i) =>
    p.length > 4 && p.startsWith("**") && p.endsWith("**")
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  );
}
function Rich({ text }) {
  const parts = text.split(/```(?:\w+)?\n?([\s\S]*?)```/g);
  return parts.map((p, i) =>
    i % 2 ? <pre key={i} className="a-code">{p.trim()}</pre> : p ? <span key={i}><Inline text={p} /></span> : null
  );
}

// Layar penuh untuk mengobrol dengan Agent AI (server agent.py). Khusus owner.
export default function AgentChat() {
  const navigate = useNavigate();
  const [url, setUrl] = useState(() => lsGet("agent_url") || DEFAULT_URL);
  const [urlInput, setUrlInput] = useState(url);
  const [panel, setPanel] = useState(false);
  const [online, setOnline] = useState(null);   // null = memeriksa
  const [access, setAccess] = useState(null);   // { ok, name } atau { ok:false, msg }
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const abortRef = useRef(null);
  const idRef = useRef(0);
  const nempel = useRef(true);

  const keBawah = () => {
    const el = listRef.current;
    if (el && nempel.current) el.scrollTop = el.scrollHeight;
  };
  useViewportFit(rootRef, keBawah);

  const add = (m) => setMsgs((p) => [...p, { id: ++idRef.current, ...m }]);

  // Semua permintaan membawa token login, server yang memutuskan boleh atau tidak
  const api = useCallback(async (path, opts = {}) => {
    const { data } = await supabase.auth.getSession();
    return fetch(url + path, {
      ...opts,
      headers: { ...(opts.headers || {}), Authorization: `Bearer ${data.session?.access_token}` },
    });
  }, [url]);

  // Status server
  useEffect(() => {
    let off = false;
    const cek = async () => {
      try {
        const r = await fetch(url + "/api/health", { cache: "no-store" });
        const j = await r.json();
        if (!off) setOnline(!!j.ok);
      } catch {
        if (!off) setOnline(false);
      }
    };
    cek();
    const iv = setInterval(cek, 15000);
    return () => { off = true; clearInterval(iv); };
  }, [url]);

  // Apakah akun ini owner menurut server
  useEffect(() => {
    if (!online) return;
    let off = false;
    (async () => {
      try {
        const r = await api("/api/me");
        const j = await r.json().catch(() => ({}));
        if (!off) setAccess(r.ok ? { ok: true, name: j.username } : { ok: false, msg: j.error || `HTTP ${r.status}` });
      } catch {
        if (!off) setAccess({ ok: false, msg: "Gagal memeriksa akses" });
      }
    })();
    return () => { off = true; };
  }, [online, api]);

  useEffect(keBawah, [msgs]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [text]);

  function tangani(ev) {
    if (ev.type === "message") add({ kind: "agent", text: ev.text });
    else if (ev.type === "tool") add({ kind: "tool", text: NAMA_TOOL[ev.name] || ev.name });
    else if (ev.type === "confirm") add({ kind: "confirm", cid: ev.id, text: ev.text, state: "wait" });
    else if (ev.type === "confirm_expired")
      setMsgs((p) => p.map((m) => (m.cid === ev.id && m.state === "wait" ? { ...m, state: "expired" } : m)));
    else if (ev.type === "error") add({ kind: "error", text: ev.text });
  }

  async function kirim(teks) {
    const pesan = (teks ?? text).trim();
    if (!pesan || busy) return;
    nempel.current = true;
    setText("");
    setBusy(true);
    add({ kind: "user", text: pesan });
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await api("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: pesan }), signal: ctrl.signal,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (line) { try { tangani(JSON.parse(line)); } catch { /* baris rusak diabaikan */ } }
        }
      }
    } catch (e) {
      if (e.name !== "AbortError")
        add({ kind: "error", text: e.message === "Failed to fetch" ? "Tidak bisa terhubung ke server agent." : e.message });
    } finally {
      setBusy(false);
      abortRef.current = null;
      // permintaan konfirmasi yang belum dijawab tidak berlaku lagi
      setMsgs((p) => p.map((m) => (m.kind === "confirm" && m.state === "wait" ? { ...m, state: "expired" } : m)));
    }
  }

  async function jawab(cid, ok) {
    setMsgs((p) => p.map((m) => (m.cid === cid ? { ...m, state: ok ? "ok" : "no" } : m)));
    try {
      const r = await api("/api/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: cid, ok }),
      });
      if (!r.ok) add({ kind: "error", text: "Jawaban tidak terkirim (mungkin sudah kedaluwarsa)." });
    } catch {
      add({ kind: "error", text: "Jawaban tidak terkirim. Server tidak terhubung." });
    }
  }

  async function unggah(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/\.(csv|json|txt)$/i.test(f.name)) return add({ kind: "error", text: "Hanya file .csv, .json, atau .txt." });
    if (f.size > 2 * 1024 * 1024) return add({ kind: "error", text: "File terlalu besar (maksimal 2 MB)." });
    try {
      const r = await api(`/api/upload?name=${encodeURIComponent(f.name)}`, {
        method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: f,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      add({ kind: "tool", text: `File tersimpan di server: ${j.path}` });
      setText(`Impor data dari file ${j.path} sebagai draft`);
      inputRef.current?.focus();
    } catch (err) {
      add({ kind: "error", text: "Gagal mengunggah: " + err.message });
    }
  }

  async function ulang() {
    try { await api("/api/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); }
    catch { /* abaikan */ }
    setMsgs([]);
    setPanel(false);
  }

  function simpanUrl() {
    const u = urlInput.trim().replace(/\/+$/, "");
    if (!/^https?:\/\/\S+$/i.test(u)) return;
    lsSet("agent_url", u);
    setUrl(u);
    setOnline(null);
    setAccess(null);
  }

  const siap = online && access?.ok;
  const halusPointer = typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches;

  return (
    <div className="agent" ref={rootRef}>
      <header className="agent-top">
        <button type="button" className="link-btn" onClick={() => navigate("/profile")}>Kembali</button>
        <div className="agent-title">
          <b>Agent AI</b>
          <small>
            <span className={"dot " + (siap ? "on" : online === false || access?.ok === false ? "off" : "")} />
            {siap ? "Terhubung" : online === false ? "Server mati" : access?.ok === false ? "Akses ditolak" : "Memeriksa..."}
          </small>
        </div>
        <button type="button" className="link-btn" onClick={() => setPanel(!panel)}>Server</button>
      </header>

      {panel && (
        <div className="agent-panel">
          <label htmlFor="au" className="muted">Alamat server agent</label>
          <div className="agent-url">
            <input id="au" className="input" value={urlInput} autoCapitalize="none" autoComplete="off"
              inputMode="url" onChange={(e) => setUrlInput(e.target.value)} />
            <button type="button" className="btn" onClick={simpanUrl}>Simpan</button>
          </div>
          <button type="button" className="btn ghost" onClick={ulang}>Mulai percakapan baru</button>
        </div>
      )}

      <div className="agent-list" ref={listRef}
        onScroll={(e) => { const el = e.currentTarget; nempel.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
        {online === false && (
          <div className="agent-note">
            Server agent belum berjalan di <b>{url}</b>. Di Termux masuk ke folder agent lalu jalankan{" "}
            <code>python agent.py</code>. Kalau server ada di perangkat lain, ubah alamatnya lewat tombol Server.
          </div>
        )}
        {online && access?.ok === false && (
          <div className="agent-note bad">Akses ditolak: {access.msg}. Agent AI hanya untuk akun owner.</div>
        )}

        {siap && msgs.length === 0 && (
          <div className="agent-help">
            <p>Halo {access.name}. Aku mengelola pusat data lewat server agent. Coba:</p>
            <ul>
              <li>“Daftar data” atau “Cek database”</li>
              <li>“Masuk data ini: Kaos Hitam, Fashion, 50000, stok 10, sku KH-01”</li>
              <li>“Daftar file data” lalu “Impor file contoh.csv”</li>
              <li>“Analisa kesalahan”, “Verifikasi semua yang bersih”</li>
              <li>“Laporan revisi 3 hari terakhir”</li>
            </ul>
            <p>Tombol Lampir mengunggah file CSV/JSON ke server. Perubahan data selalu menunggu persetujuanmu.</p>
          </div>
        )}

        {msgs.map((m) => {
          if (m.kind === "user") return <div key={m.id} className="a-row me"><div className="a-bubble">{m.text}</div></div>;
          if (m.kind === "agent") return <div key={m.id} className="a-row them"><div className="a-bubble a-text"><Rich text={m.text} /></div></div>;
          if (m.kind === "tool") return <div key={m.id} className="a-tool">{m.text}</div>;
          if (m.kind === "error") return <div key={m.id} className="a-error a-text" role="alert">{m.text}</div>;
          return (
            <div key={m.id} className={"a-confirm" + (m.state !== "wait" ? " done" : "")}>
              <h3>Perlu persetujuan</h3>
              <pre className="a-text">{m.text}</pre>
              {m.state === "wait" ? (
                <div className="actions">
                  <button type="button" className="btn ghost" onClick={() => jawab(m.cid, false)}>Tolak</button>
                  <button type="button" className="btn" onClick={() => jawab(m.cid, true)}>Izinkan</button>
                </div>
              ) : (
                <span className="a-state">
                  {m.state === "ok" ? "Diizinkan" : m.state === "no" ? "Ditolak" : "Kedaluwarsa"}
                </span>
              )}
            </div>
          );
        })}

        {busy && <div className="a-tool">Agent bekerja...</div>}
      </div>

      <div className="agent-chips">
        {CHIPS.map((c) => (
          <button key={c.label} type="button" className="chip" disabled={!siap || busy}
            onClick={() => (c.kirim ? kirim(c.kirim) : (setText(c.isi), inputRef.current?.focus()))}>
            {c.label}
          </button>
        ))}
      </div>

      <form className="agent-input" onSubmit={(e) => { e.preventDefault(); kirim(); }}>
        <button type="button" className="btn ghost lampir" disabled={!siap || busy} onClick={() => fileRef.current.click()}>Lampir</button>
        <textarea ref={inputRef} rows={1} value={text} maxLength={4000} disabled={!siap}
          placeholder={siap ? "Tulis perintah" : "Menunggu server agent"} aria-label="Perintah"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (halusPointer && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); kirim(); }
          }} />
        {busy
          ? <button type="button" className="btn ghost" onClick={() => abortRef.current?.abort()}>Stop</button>
          : <button className="btn" disabled={!siap || !text.trim()}>Kirim</button>}
      </form>
      <input ref={fileRef} type="file" accept=".csv,.json,.txt" hidden onChange={unggah} />
    </div>
  );
}
