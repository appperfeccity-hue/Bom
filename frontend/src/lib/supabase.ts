import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not set. ' +
      'The client will not be able to connect.',
  );
}

/**
 * Singleton Supabase client configured with Vite environment variables.
 * Uses the perfecity schema by default.
 */
export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
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
 * Helper to query a table in the perfecity schema.
 */
export function fromTable(table: string) {
  return supabase.from(table);
}
