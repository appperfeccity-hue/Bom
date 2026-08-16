import { test as base, Page, BrowserContext } from '@playwright/test';
import fs from 'fs';
import {
  DESIGNER_AUTH_PATH,
  CONSULTANT_AUTH_PATH,
  ADMIN_AUTH_PATH,
} from '../global-setup';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './seed-data';

/**
 * Extracts the Supabase project ref from the SUPABASE_URL.
 * e.g. "https://fbiemsbykrmrbqcsobvh.supabase.co" -> "fbiemsbykrmrbqcsobvh"
 */
function getSupabaseRef(): string {
  const match = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) {
    throw new Error(
      `Cannot extract Supabase ref from URL: ${SUPABASE_URL}. ` +
        `Expected format: https://<ref>.supabase.co`
    );
  }
  return match[1];
}

interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Loads a persisted auth session from disk (written by global-setup.ts).
 */
function loadAuthSession(filePath: string): AuthSession {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Builds the localStorage value that the Supabase JS client expects at
 * the key `sb-<ref>-auth-token`.
 */
function buildSupabaseStorageValue(session: AuthSession): string {
  return JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: 3600,
    token_type: 'bearer',
    user: session.user,
  });
}

/**
 * Creates an authenticated browser Page by injecting the Supabase auth
 * session into localStorage before any navigation occurs.
 */
async function createAuthenticatedPage(
  context: BrowserContext,
  sessionPath: string,
  baseURL: string
): Promise<Page> {
  const session = loadAuthSession(sessionPath);
  const ref = getSupabaseRef();
  const storageKey = `sb-${ref}-auth-token`;
  const storageValue = buildSupabaseStorageValue(session);

  const page = await context.newPage();

  // Navigate to the base URL origin to establish the domain for localStorage
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });

  // Inject the auth session into localStorage
  await page.evaluate(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: storageKey, value: storageValue }
  );

  // Reload so the app re-reads auth state from localStorage on the fresh load
  await page.reload({ waitUntil: 'domcontentloaded' });

  return page;
}

/**
 * Browser auth fixture that provides authenticated Page instances for each role.
 * Unlike auth.fixture.ts (which provides APIRequestContext), this fixture
 * provides full browser Pages with Supabase auth pre-injected into localStorage.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/browser-auth.fixture';
 *   test('my test', async ({ designerBrowser }) => { ... });
 */
export const test = base.extend<{
  designerBrowser: Page;
  consultantBrowser: Page;
  adminBrowser: Page;
}>({
  designerBrowser: async ({ context }, use) => {
    const baseURL =
      process.env.PLAYWRIGHT_BASE_URL || 'https://bom-beryl.vercel.app';
    const page = await createAuthenticatedPage(
      context,
      DESIGNER_AUTH_PATH,
      baseURL
    );
    await use(page);
    await page.close();
  },

  consultantBrowser: async ({ context }, use) => {
    const baseURL =
      process.env.PLAYWRIGHT_BASE_URL || 'https://bom-beryl.vercel.app';
    const page = await createAuthenticatedPage(
      context,
      CONSULTANT_AUTH_PATH,
      baseURL
    );
    await use(page);
    await page.close();
  },

  adminBrowser: async ({ context }, use) => {
    const baseURL =
      process.env.PLAYWRIGHT_BASE_URL || 'https://bom-beryl.vercel.app';
    const page = await createAuthenticatedPage(
      context,
      ADMIN_AUTH_PATH,
      baseURL
    );
    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';
