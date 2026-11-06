import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";

// Buka /logout kapan saja untuk keluar paksa (bersihkan sesi di perangkat ini)
export default function Logout() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      if (supabase) await supabase.auth.signOut({ scope: "local" });
      navigate("/", { replace: true });
    })();
  }, [navigate]);
  return <div className="boot">Keluar...</div>;
}
