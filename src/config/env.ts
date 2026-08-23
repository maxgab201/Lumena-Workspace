import { z } from 'zod';

const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_ANON_KEY: z.string().min(10, 'VITE_SUPABASE_ANON_KEY must not be empty'),
});

const parsed = EnvSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const errors = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
  throw new Error(`Invalid environment variables: ${errors}`);
}

export const env = {
  supabaseUrl: parsed.data.VITE_SUPABASE_URL,
  supabaseAnonKey: parsed.data.VITE_SUPABASE_ANON_KEY,
};