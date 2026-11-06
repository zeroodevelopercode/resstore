// Saat pengunjung pertama kali menyentuh layar, browser masuk mode layar penuh
// (address bar hilang). Browser mewajibkan ada interaksi pengguna dulu.
// Catatan: iOS Safari tidak mendukung ini, dan mode terpasang (PWA) sudah penuh.
export function autoFullscreen() {
  const terpasang =
    window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches ||
    window.navigator.standalone;
  const el = document.documentElement;
  if (terpasang || !el.requestFullscreen) return;

  window.addEventListener(
    "click",
    () => {
      if (!document.fullscreenElement) {
        el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
      }
    },
    { once: true }
  );
}
