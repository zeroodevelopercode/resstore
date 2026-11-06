import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
// Mendukung key baru (publishable) maupun key lama (anon)
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

// Frontend hanya boleh memakai publishable/anon key.
// JANGAN PERNAH memakai secret key atau service_role di sini.
export const supabase = url && key ? createClient(url, key) : null;
