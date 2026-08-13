import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not set. ' +
      'The client will not be able to connect.',
  );
}

/**
 * Singleton Supabase client configured with Vite environment variables.
 * Note: The perfecity schema is accessed via the schema option on individual
 * queries since PostgREST may not expose custom schemas by default.
 * If env vars are missing, the client is created with placeholder values
 * and all queries will fail gracefully.
 */
export const supabase = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'placeholder-key',
  {
    db: {
      schema: 'perfecity',
    },
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  },
);

/**
 * Whether the Supabase client is properly configured with valid env vars.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Helper to query a table in the perfecity schema.
 * The global client is already configured with db.schema = 'perfecity',
 * so this is a convenience wrapper.
 * Returns the query builder. Callers should handle errors from results.
 */
export function fromTable(table: string) {
  return supabase.from(table);
}
