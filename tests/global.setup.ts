import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page, request }) => {
  const email = 'test@lumena.app';
  const password = 'password123';
  
  console.log(`Setting up test user: ${email}`);

  // Try to sign in first
  let session = null;
  
  let signInRes = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    data: { email, password }
  });
  let signInData = await signInRes.json().catch(() => ({}));

  if (signInRes.ok() && signInData.access_token) {
    console.log('Successfully signed in test user.');
    session = { access_token: signInData.access_token, refresh_token: signInData.refresh_token, user: signInData.user };
  } else {
    console.log('Sign in failed, attempting to sign up test user...', signInData);
    let signUpRes = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      data: { email, password }
    });
    let signUpData = await signUpRes.json().catch(() => ({}));
    
    if (signUpRes.ok() && signUpData.access_token) {
      console.log('Successfully signed up test user.');
      session = { access_token: signUpData.access_token, refresh_token: signUpData.refresh_token, user: signUpData.user };
    } else {
      throw new Error(`Failed to sign up or sign in test user: ${JSON.stringify(signUpData)} / ${JSON.stringify(signInData)}`);
    }
  }

  if (!session || !session.access_token) {
    throw new Error('Failed to get session for test user');
  }

  // Ensure test workspace exists for this user
  const authClient = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } }
  });
  
  const { data: workspaces } = await authClient.from('workspaces').select('id').limit(1);
  if (!workspaces || workspaces.length === 0) {
    console.log('Creating default test workspace...');
    await authClient.from('workspaces').insert({
      name: 'Test Workspace'
    });
  }

  // Go to the app to get the right origin
  await page.goto('/');

  // Find the supabase storage key dynamically based on URL project ref
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  // Inject session directly into local storage so that Supabase client inside the app picks it up
  await page.evaluate(({ key, sessionStr }) => {
    localStorage.setItem(key, sessionStr);
  }, { key: storageKey, sessionStr: JSON.stringify(session) });

  // Ensure directory exists
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  // Save state
  await page.context().storageState({ path: authFile });
});
