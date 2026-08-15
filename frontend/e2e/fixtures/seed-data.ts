/**
 * Seed data constants from the live database.
 * These represent known-good records used for E2E test assertions.
 */

// Supabase connection
export const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://fbiemsbykrmrbqcsobvh.supabase.co';
export const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiaWVtc2J5a3JtcmJxY3NvYnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MjY0NDEsImV4cCI6MjEwMDMwMjQ0MX0.wVthrn8-pRfoBgIjowocD5ApAbiDMx61d5vs1RNlXQA';

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
