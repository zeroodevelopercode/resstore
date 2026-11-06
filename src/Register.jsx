import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";
import AuthForm, { PasswordInput } from "./AuthForm.jsx";

export default function Register() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError(""); setInfo("");
    if (!supabase) return setError("Supabase belum dikonfigurasi (.env).");
    if (name.trim().length < 2) return setError("Nama minimal 2 karakter.");
    const uname = username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(uname))
      return setError("Username 3-20 karakter: huruf kecil, angka, titik, atau underscore.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Format email tidak valid.");
    if (password.length < 10) return setError("Password minimal 10 karakter.");
    if (password !== confirm) return setError("Konfirmasi password tidak sama.");

    setLoading(true);
    const { data: ada } = await supabase.from("profiles").select("id").eq("username", uname).maybeSingle();
    if (ada) {
      setLoading(false);
      return setError("Username sudah dipakai. Coba yang lain.");
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name.trim(), username: uname } },
    });
    setLoading(false);
    if (error) return setError("Pendaftaran gagal. Coba lagi.");

    // Jika konfirmasi email dimatikan, user langsung login
    if (data.session) return navigate("/home");
    setInfo("Akun dibuat. Cek emailmu untuk konfirmasi, lalu masuk.");
  }

  return (
    <AuthForm
      title="Daftar"
      subtitle="Buat akun untuk mulai membeli dan menjual."
      side={{
        title: "Mulai dari satu akun.",
        points: ["Gratis, tanpa biaya pendaftaran", "Beli dan jual dari akun yang sama", "Data hanya bisa diubah oleh pemiliknya"],
      }}
      onSubmit={submit}
      loading={loading}
      error={error}
      info={info}
      footer={<>Sudah punya akun? <Link to="/login">Masuk</Link></>}
    >
      <div className="field">
        <label htmlFor="name">Nama</label>
        <input id="name" className="input" autoComplete="name" maxLength={60}
          value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="username">Username</label>
        <input id="username" className="input" autoCapitalize="none" autoComplete="username" maxLength={20}
          value={username} onChange={(e) => setUsername(e.target.value)} />
        <span className="hint">Huruf kecil, angka, titik, atau underscore.</span>
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" className="input" type="email" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <PasswordInput id="password" autoComplete="new-password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <span className="hint">Minimal 10 karakter.</span>
      </div>
      <div className="field">
        <label htmlFor="confirm">Ulangi password</label>
        <PasswordInput id="confirm" autoComplete="new-password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
    </AuthForm>
  );
}
