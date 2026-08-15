import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://fbiemsbykrmrbqcsobvh.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiaWVtc2J5a3JtcmJxY3NvYnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MjY0NDEsImV4cCI6MjEwMDMwMjQ0MX0.wVthrn8-pRfoBgIjowocD5ApAbiDMx61d5vs1RNlXQA';

const AUTH_DIR = path.join(__dirname, '.auth');

export const DESIGNER_AUTH_PATH = path.join(AUTH_DIR, 'designer.json');
export const CONSULTANT_AUTH_PATH = path.join(AUTH_DIR, 'consultant.json');
export const ADMIN_AUTH_PATH = path.join(AUTH_DIR, 'admin.json');

interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
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
      email: process.env.E2E_DESIGNER_EMAIL || 'designer@perfeccity.test',
      password: process.env.E2E_DESIGNER_PASSWORD || 'Designer@123',
      path: DESIGNER_AUTH_PATH,
      role: 'designer',
    },
    {
      email: process.env.E2E_CONSULTANT_EMAIL || 'consultant@perfeccity.test',
      password: process.env.E2E_CONSULTANT_PASSWORD || 'Consultant@123',
      path: CONSULTANT_AUTH_PATH,
      role: 'consultant',
    },
    {
      email: process.env.E2E_ADMIN_EMAIL || 'admin@perfeccity.test',
      password: process.env.E2E_ADMIN_PASSWORD || 'Admin@123',
      path: ADMIN_AUTH_PATH,
      role: 'admin',
    },
  ];

  for (const user of users) {
    console.log(`Authenticating ${user.role} (${user.email})...`);
    const session = await authenticate(user.email, user.password);
    fs.writeFileSync(user.path, JSON.stringify(session, null, 2));
    console.log(`Stored auth state for ${user.role}`);
  }
}

export default globalSetup;
