import { useEffect } from "react";

// Membuat elemen layar penuh mengikuti area yang benar-benar terlihat, sehingga
// kolom input menempel tepat di atas keyboard dan tidak tertutup.
export default function useViewportFit(ref, onFit) {
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    document.body.style.overflow = "hidden";
    if (!vv || !el) return () => { document.body.style.overflow = ""; };
    const fit = () => {
      el.style.height = vv.height + "px";
      el.style.top = vv.offsetTop + "px";
      onFit?.();
    };
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => {
      document.body.style.overflow = "";
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
    };
  }, []); // eslint-disable-line
}
