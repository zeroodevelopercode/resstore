// Musik postingan diputar otomatis saat kartunya terlihat di layar.
// - Hanya SATU musik aktif: dari kartu yang paling terlihat.
// - Jeda manual diingat selama aplikasi terbuka (tetap jeda setelah pindah halaman,
//   keluar aplikasi, atau berganti tab lalu kembali).
// - Bisa ditahan sementara (misalnya saat cerita dibuka).
const byTarget = new Map(); // elemen kartu -> audio
const ratios = new Map();   // audio -> seberapa terlihat (0..1)
const held = new Set();     // kunci postingan yang dijeda manual oleh pengguna
let suspended = 0;
let io = null;
let armed = false;

// Browser bisa menolak putar otomatis sebelum ada sentuhan; coba lagi di sentuhan pertama
function armRetry() {
  if (armed) return;
  armed = true;
  window.addEventListener("pointerdown", () => { armed = false; pick(); }, { once: true });
}

function pick() {
  const diam = suspended > 0 || document.hidden;
  let best = null;
  let top = 0.5;
  if (!diam) ratios.forEach((v, a) => { if (v >= top) { best = a; top = v; } });

  ratios.forEach((v, a) => {
    if (a === best) {
      if (!held.has(a._key) && a.paused) a.play().catch(armRetry);
    } else if (!a.paused) {
      a.pause();
    }
  });
}

document.addEventListener("visibilitychange", pick);

function observer() {
  if (!io) {
    io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const a = byTarget.get(e.target);
          if (!a) return;
          const tinggi = Math.min(e.boundingClientRect.height, e.rootBounds?.height || Infinity);
          ratios.set(a, e.isIntersecting && tinggi ? e.intersectionRect.height / tinggi : 0);
        });
        pick();
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "-56px 0px -56px 0px" }
    );
  }
  return io;
}

export function registerAudio(audio, target, key) {
  audio._key = key;
  byTarget.set(target, audio);
  ratios.set(audio, 0);
  observer().observe(target);
  return () => {
    observer().unobserve(target);
    byTarget.delete(target);
    ratios.delete(audio);
    audio.pause();
    pick();
  };
}

export function toggleAudio(audio) {
  if (!audio) return;
  if (audio.paused) {
    held.delete(audio._key);
    audio.play().catch(() => {});
  } else {
    held.add(audio._key);
    audio.pause();
  }
}

export function suspendAudio() { suspended += 1; pick(); }
export function resumeAudio() { suspended = Math.max(0, suspended - 1); pick(); }
