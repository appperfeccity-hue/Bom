import { test as base, APIRequestContext } from '@playwright/test';
import fs from 'fs';
import {
  DESIGNER_AUTH_PATH,
  CONSULTANT_AUTH_PATH,
  ADMIN_AUTH_PATH,
} from '../global-setup';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './seed-data';

interface AuthState {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Loads a persisted auth session from disk.
 *
 * Limitation: tokens are minted once in global-setup and reused for the entire
 * test run with no expiry check or refresh. Supabase default JWT lifetime is
 * 3600s. If the suite ever exceeds that duration, tests will fail with 401.
 * Acceptable for now while the suite is small; revisit with a token-refresh
 * mechanism when the run time approaches the token lifetime.
 */
function loadAuthState(filePath: string): AuthState {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export interface AuthenticatedContext {
  request: APIRequestContext;
  token: string;
  userId: string;
}

export const test = base.extend<{
  designerPage: AuthenticatedContext;
  consultantPage: AuthenticatedContext;
  adminPage: AuthenticatedContext;
}>({
  designerPage: async ({ playwright }, use) => {
    const state = loadAuthState(DESIGNER_AUTH_PATH);
    const request = await playwright.request.newContext({
      baseURL: SUPABASE_URL,
      extraHTTPHeaders: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${state.access_token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        'Accept-Profile': 'perfecity',
      },
    });
    await use({ request, token: state.access_token, userId: state.user.id });
    await request.dispose();
  },

  consultantPage: async ({ playwright }, use) => {
    const state = loadAuthState(CONSULTANT_AUTH_PATH);
    const request = await playwright.request.newContext({
      baseURL: SUPABASE_URL,
      extraHTTPHeaders: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${state.access_token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        'Accept-Profile': 'perfecity',
      },
    });
    await use({
      request,
      token: state.access_token,
      userId: state.user.id,
    });
    await request.dispose();
  },

  adminPage: async ({ playwright }, use) => {
    const state = loadAuthState(ADMIN_AUTH_PATH);
    const request = await playwright.request.newContext({
      baseURL: SUPABASE_URL,
      extraHTTPHeaders: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${state.access_token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        'Accept-Profile': 'perfecity',
      },
    });
    await use({ request, token: state.access_token, userId: state.user.id });
    await request.dispose();
  },
});

export { expect } from '@playwright/test';
