/**
 * Seed data constants from the live database.
 * These represent known-good records used for E2E test assertions.
 */

/**
 * Reads a required environment variable and throws a clear error if missing.
 * Never logs the value to prevent credential leakage.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.e2e.example to .env.e2e and populate all values.`
    );
  }
  return value;
}

// Supabase connection - always loaded from environment
export const SUPABASE_URL = requireEnv('SUPABASE_URL');
export const SUPABASE_ANON_KEY = requireEnv('SUPABASE_ANON_KEY');

// User IDs
export const DESIGNER_USER_ID = '7703d1f5-7297-47f7-ad72-23612138dc80';
export const CONSULTANT_USER_ID = '230d0b25-41e4-49ab-bb72-4158c4eaea13';
export const ADMIN_USER_ID = 'c699e333-886b-4af1-b828-7fcf5dca306a';

// Templates
export const ACTIVE_TEMPLATE_1 = {
  id: '0b8007da-dfe5-46db-b5da-63f4b8387372',
  name: 'Modern Oak TV Wall',
};

export const ACTIVE_TEMPLATE_2 = {
  id: 'e11e6459-15e2-4f37-8781-d515e64d3e9c',
  name: 'Geometric Bedroom L-Corner',
};

// Rule sets
export const RULE_SET_ID = '0d58e18b-8f83-485a-83af-a90883420573';
