export const supabaseUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL || "https://example.supabase.co";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY || "example-anon-key";
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL && process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY,
);
