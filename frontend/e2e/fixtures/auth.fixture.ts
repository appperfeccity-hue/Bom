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
      },
    });
    await use({ request, token: state.access_token, userId: state.user.id });
    await request.dispose();
  },
});

export { expect } from '@playwright/test';
