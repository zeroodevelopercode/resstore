// Foto profil. Jika belum ada, tampil huruf pertama username.
export default function Avatar({ user, className = "" }) {
  const nama = user?.username || "?";
  const url = user?.avatar_url;
  return (
    <div className={("avatar " + className).trim()}>
      {typeof url === "string" && /^https:\/\//i.test(url)
        ? <img src={url} alt="" loading="lazy" draggable={false} />
        : nama[0].toUpperCase()}
    </div>
  );
}
