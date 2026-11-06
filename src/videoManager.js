import { useSyncExternalStore } from "react";

// Mengatur video di feed: hanya SATU video yang diputar, yaitu yang paling terlihat.
const ratios = new Map();
const subs = new Set();
let sound = false;
let io = null;

let suspended = 0;

function pick() {
  // Saat ditahan (cerita dibuka) atau halaman tersembunyi: semua video berhenti
  if (suspended > 0 || document.hidden) {
    ratios.forEach((v, el) => { if (!el.paused) el.pause(); });
    return;
  }
  let best = null;
  let top = 0.5;
  ratios.forEach((v, el) => { if (v >= top) { best = el; top = v; } });
  ratios.forEach((v, el) => {
    if (el === best) {
      if (!el._held && el.paused) el.play().catch(() => {});
    } else {
      if (!el.paused) el.pause();
      if (v < 0.25) el._held = false; // jeda manual dilepas setelah video keluar layar
    }
  });
}

function observer() {
  if (!io) {
    io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const tinggi = Math.min(e.boundingClientRect.height, e.rootBounds?.height || Infinity);
          ratios.set(e.target, e.isIntersecting && tinggi ? e.intersectionRect.height / tinggi : 0);
        });
        pick();
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "-56px 0px -56px 0px" }
    );
  }
  return io;
}

export function registerVideo(el) {
  el.muted = !sound;
  ratios.set(el, 0);
  observer().observe(el);
  return () => {
    observer().unobserve(el);
    ratios.delete(el);
    el.pause();
    pick();
  };
}

export function setSound(on) {
  sound = on;
  ratios.forEach((_, el) => { el.muted = !on; });
  subs.forEach((f) => f());
}

export function useSound() {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => subs.delete(cb); },
    () => sound
  );
}

document.addEventListener("visibilitychange", pick);
export function suspendVideo() { suspended += 1; pick(); }
export function resumeVideo() { suspended = Math.max(0, suspended - 1); pick(); }
