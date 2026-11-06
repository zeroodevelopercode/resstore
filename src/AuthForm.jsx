import { useState } from "react";
import { Link } from "react-router-dom";

export function PasswordInput({ id, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw">
      <input
        id={id}
        className="input"
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
      />
      <button type="button" onClick={() => setShow(!show)}>
        {show ? "Sembunyikan" : "Lihat"}
      </button>
    </div>
  );
}

export default function AuthForm({
  title, subtitle, side, onSubmit, loading, error, info, children, footer,
}) {
  return (
    <main className="auth">
      <aside className="auth-side">
        <Link to="/" className="logo">resstore</Link>
        <div>
          <h2>{side.title}</h2>
          <ul>
            {side.points.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </div>
        <p className="muted">store you stock</p>
      </aside>

      <section className="auth-main">
        <form className="auth-box" onSubmit={onSubmit} noValidate>
          <Link to="/" className="logo auth-logo">resstore</Link>
          <div>
            <h1>{title}</h1>
            <p className="muted">{subtitle}</p>
          </div>
          {children}
          {error && <p className="error" role="alert">{error}</p>}
          {info && <p className="info" role="status">{info}</p>}
          <button className="btn full big" disabled={loading}>
            {loading ? "Memproses..." : title}
          </button>
          <p className="muted center">{footer}</p>
        </form>
        <Link to="/" className="back">Kembali ke beranda</Link>
      </section>
    </main>
  );
}
