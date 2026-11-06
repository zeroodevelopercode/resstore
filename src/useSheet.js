import { useEffect } from "react";

// Kunci scroll halaman dan tutup lembar dengan tombol Esc
export default function useSheet(onClose) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
}
