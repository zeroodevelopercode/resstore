import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";
import AuthForm, { PasswordInput } from "./AuthForm.jsx";

// Ganti dengan kontak admin kamu
const ADMIN_EMAIL = "admin@resstore.example";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lupa, setLupa] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!supabase) return setError("Supabase belum dikonfigurasi (.env).");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Format email tidak valid.");
    if (!password) return setError("Password wajib diisi.");

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    // Pesan sengaja umum agar tidak membocorkan email yang terdaftar
    if (error) return setError("Email atau password salah.");
    navigate("/home");
  }

  return (
    <AuthForm
      title="Masuk"
      subtitle="Lanjutkan ke akun resstore kamu."
      side={{
        title: "Selamat datang kembali.",
        points: ["Lanjutkan belanja aplikasimu", "Kelola aplikasi yang kamu jual", "Semua tersimpan di satu akun"],
      }}
      onSubmit={submit}
      loading={loading}
      error={error}
      footer={<>Belum punya akun? <Link to="/register">Daftar</Link></>}
    >
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" className="input" type="email" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div className="field">
        <div className="label-row">
          <label htmlFor="password">Password</label>
          <button type="button" className="link-btn" onClick={() => setLupa(!lupa)}>
            Lupa password?
          </button>
        </div>
        <PasswordInput id="password" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        {lupa && (
          <p className="note">
            Reset password dilakukan oleh admin. Hubungi{" "}
            <a href={`mailto:${ADMIN_EMAIL}?subject=Reset password resstore`}>{ADMIN_EMAIL}</a>{" "}
            dan sebutkan email akunmu.
          </p>
        )}
      </div>
    </AuthForm>
  );
}
