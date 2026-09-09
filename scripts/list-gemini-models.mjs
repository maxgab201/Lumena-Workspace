// Lists available Gemini models for the configured API key.
// Reads the key from Supabase secrets env file passed as argv[2].
import fs from 'fs';

const envFile = process.argv[2];
if (!envFile) {
  console.error('usage: node scripts/list-gemini-models.mjs <env-file>');
  process.exit(1);
}
const key = fs.readFileSync(envFile, 'utf8').match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!key) throw new Error('no key in file');

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200`);
const json = await res.json();
if (json.error) {
  console.log('ERR', json.error.code, json.error.message?.slice(0, 150));
} else {
  for (const m of json.models ?? []) {
    const methods = (m.supportedGenerationMethods ?? []).join(',');
    if (methods.includes('generateContent') || m.name.includes('embedding')) {
      console.log(m.name, '|', methods, '| in:', m.inputTokenLimit);
    }
  }
}
