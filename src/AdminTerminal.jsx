import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";
import { useAuth } from "./AuthContext.jsx";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (n) => `[${String(n).padStart(3)}%]`;

const helpLines = () => [
  { k: "out", t: "Perintah yang tersedia:" },
  { k: "name", t: "  .ann <teks>" },
  { k: "dim", t: "      kirim pengumuman ke semua akun" },
  { k: "name", t: "  .help" },
  { k: "dim", t: "      tampilkan daftar perintah" },
  { k: "name", t: "  .clear" },
  { k: "dim", t: "      bersihkan layar" },
  { k: "name", t: "  .exit" },
  { k: "dim", t: "      keluar dari konsol" },
  { k: "out", t: "" },
  { k: "dim", t: "Contoh: .ann Maintenance malam ini pukul 22.00" },
];

let nextId = 1;
const withId = (l) => ({ id: nextId++, ...l });

export default function AdminTerminal() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [lines, setLines] = useState(() =>
    [
      { k: "ok", t: `Welcome, ${profile.username}` },
      { k: "dim", t: "resstore admin console" },
      { k: "out", t: "" },
      ...helpLines(),
    ].map((l, i) => withId({ ...l, delay: i * 80 }))
  );
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(null);
  const rootRef = useRef(null);
  const outRef = useRef(null);
  const inputRef = useRef(null);

  const add = (l) => setLines((p) => [...p, withId(l)]);
  const toBottom = () => {
    const o = outRef.current;
    if (o) o.scrollTop = o.scrollHeight;
  };

  // Terminal selalu mengikuti area yang terlihat, jadi kolom input menempel
  // tepat di atas keyboard dan tidak tertutup atau terdorong keluar layar.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = rootRef.current;
    document.body.style.overflow = "hidden";
    if (!vv || !el) return () => { document.body.style.overflow = ""; };
    const fit = () => {
      el.style.height = vv.height + "px";
      el.style.top = vv.offsetTop + "px";
      toBottom();
    };
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => {
      document.body.style.overflow = "";
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
    };
  }, []);

  // Textarea tumbuh sesuai isi, dibatasi tingginya
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 88) + "px";
    toBottom();
  }, [value]);

  useEffect(toBottom, [lines, prog]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  async function ann(text) {
    setBusy(true);
    try {
      if (!text) throw new Error("Teks pengumuman kosong. Contoh: .ann Maintenance malam ini");
      if (text.length < 3) throw new Error("Teks minimal 3 karakter.");
      if (text.length > 1000) throw new Error(`Teks terlalu panjang (${text.length}/1000 karakter).`);
      add({ k: "out", t: `${pct(25)} Teks valid (${text.length} karakter)` });

      // Persentase maju hanya setelah tiap proses database benar-benar selesai
      setProg(`${pct(25)} Memverifikasi akses admin...`);
      const { data: isAdmin, error: e1 } = await supabase.rpc("is_admin");
      if (e1) throw new Error(e1.message);
      if (!isAdmin) throw new Error("Akses ditolak. Akun ini bukan admin.");
      add({ k: "out", t: `${pct(50)} Akses admin terverifikasi` });

      setProg(`${pct(50)} Menyimpan ke database...`);
      const { data, error: e2 } = await supabase
        .from("announcements")
        .insert({ title: "Pengumuman", body: text })
        .select("id")
        .single();
      if (e2) throw new Error(e2.message);
      add({ k: "out", t: `${pct(100)} Tersimpan (id #${data.id})` });
      add({ k: "ok", t: "SUCCESS: Pengumuman terkirim ke semua akun." });
    } catch (e) {
      add({ k: "err", t: `ERROR: ${e.message}` });
    } finally {
      setProg(null);
      setBusy(false);
    }
  }

  async function run(raw) {
    const text = raw.trim();
    if (!text || busy) return;
    setValue("");
    add({ k: "cmd", t: "$ " + text });

    const first = text.split(/\s+/)[0];
    const name = first.toLowerCase();
    const arg = text.slice(first.length).trim();

    if (name === ".ann") return ann(arg);
    if (name === ".help") return helpLines().forEach(add);
    if (name === ".clear") return setLines([]);
    if (name === ".exit") {
      add({ k: "dim", t: "Menutup konsol..." });
      await sleep(300);
      return navigate("/profile");
    }
    add({ k: "err", t: `Perintah tidak dikenali: ${first}` });
    add({ k: "dim", t: "Ketik .help untuk melihat daftar perintah." });
  }

  return (
    <div className="term" ref={rootRef}>
      <div className="term-out" ref={outRef} onClick={() => inputRef.current?.focus()}>
        {lines.map((l) => (
          <div key={l.id} className={"t-line " + l.k}
            style={l.delay != null ? { animationDelay: l.delay + "ms" } : undefined}>
            {l.t || "\u00A0"}
          </div>
        ))}
        {prog && <div className="t-line dim">{prog}</div>}
      </div>

      <form className="t-prompt" onSubmit={(e) => { e.preventDefault(); run(value); }}>
        <span className="t-ps">$</span>
        <textarea
          ref={inputRef} rows={1} value={value} disabled={busy}
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          enterKeyHint="send" aria-label="Perintah"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(value); }
          }}
        />
        <button className="t-send" disabled={busy || !value.trim()}>Enter</button>
      </form>
    </div>
  );
}
   