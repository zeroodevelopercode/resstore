export default function Soon({ title, desc }) {
  return (
    <section className="soon">
      <h2>{title}</h2>
      <p className="muted">{desc}</p>
    </section>
  );
}
