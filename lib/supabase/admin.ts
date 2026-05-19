import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Admin client com service role key — bypassa RLS por completo.
 * Usar EXCLUSIVAMENTE em Server Components, Server Actions e route handlers.
 * NUNCA importar em Client Components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para o admin client."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
