import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://vcmsdtighsmmwssyuese.supabase.co"
// Publishable keys are the recommended client-side key. The legacy anon JWT
// also works for the Data API but is rejected by Storage for writes.
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_B84qLihcB3A0ziAcqg2zfA_4Z82GlNa"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
