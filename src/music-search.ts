// Supabase Edge Function: music-search
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HOST = "spotify23.p.rapidapi.com";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Harus login" }, 401);

  let body: { q?: unknown; track?: unknown; offset?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Permintaan tidak valid" }, 400);
  }

  const headers = { "X-RapidAPI-Key": Deno.env.get("RAPIDAPI_KEY")!, "X-RapidAPI-Host": HOST };
  let url: string;

  if (body.track !== undefined) {
    const id = String(body.track);
    if (!/^[A-Za-z0-9]{10,30}$/.test(id)) return json({ error: "ID lagu tidak valid" }, 400);
    url = `https://${HOST}/tracks/?${new URLSearchParams({ ids: id })}`;
  } else {
    const q = String(body.q ?? "").trim().slice(0, 60);
    if (q.length < 2) return json({ tracks: { items: [] } });
    const offset = Math.min(Math.max(Number(body.offset) || 0, 0), 200);
    url = `https://${HOST}/search/?${new URLSearchParams({
      q, type: "tracks", offset: String(offset), limit: "20", numberOfTopResults: "5",
    })}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) return json({ error: `API musik membalas ${res.status}` }, 502);
  return json(await res.json());
});