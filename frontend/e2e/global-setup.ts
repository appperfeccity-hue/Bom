import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './fixtures/seed-data';

const AUTH_DIR = path.join(import.meta.dirname, '.auth');

export const DESIGNER_AUTH_PATH = path.join(AUTH_DIR, 'designer.json');
export const CONSULTANT_AUTH_PATH = path.join(AUTH_DIR, 'consultant.json');
export const ADMIN_AUTH_PATH = path.join(AUTH_DIR, 'admin.json');

interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

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

async function authenticate(
  email: string,
  password: string
): Promise<AuthSession> {
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Authentication failed for ${email}: ${response.status} ${error}`
    );
  }

  return response.json();
}

async function globalSetup(_config: FullConfig): Promise<void> {
  // Ensure .auth directory exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const users = [
    {
      email: requireEnv('E2E_DESIGNER_EMAIL'),
      password: requireEnv('E2E_DESIGNER_PASSWORD'),
      path: DESIGNER_AUTH_PATH,
      role: 'designer',
    },
    {
      email: requireEnv('E2E_CONSULTANT_EMAIL'),
      password: requireEnv('E2E_CONSULTANT_PASSWORD'),
      path: CONSULTANT_AUTH_PATH,
      role: 'consultant',
    },
    {
      email: requireEnv('E2E_ADMIN_EMAIL'),
      password: requireEnv('E2E_ADMIN_PASSWORD'),
      path: ADMIN_AUTH_PATH,
      role: 'admin',
    },
  ];

  for (const user of users) {
    console.log(`Authenticating ${user.role}...`);
    const session = await authenticate(user.email, user.password);
    fs.writeFileSync(user.path, JSON.stringify(session, null, 2));
    console.log(`Stored auth state for ${user.role}`);
  }
}

export default globalSetup;
