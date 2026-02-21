import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Valores de respaldo para que el build en Vercel no falle cuando las env no están
// disponibles durante la generación estática. En runtime se usan las variables reales.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
