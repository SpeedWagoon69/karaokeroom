import { createClient } from '@supabase/supabase-js';

// Usamos unknown para evitar el error de 'any' en ESLint
const env = (import.meta as unknown as { env: Record<string, string> }).env;

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Faltan las variables de entorno de Supabase");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);