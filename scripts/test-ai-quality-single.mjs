// One-call quality check to avoid burning the per-minute quota
const SUPABASE_URL = 'https://nsjetmjtwbhellqasggw.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zamV0bWp0d2JoZWxscWFzZ2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3ODA5NDYsImV4cCI6MjA5OTM1Njk0Nn0.ueBlzTVAaNMezBqsVIczcO6-ogiJyML340pGwwpPN1s';

const spanishSentences = [
  { sentence_key: 'p1-S0', text: 'La Celula y la Mitosis' },
  { sentence_key: 'p1-S1', text: 'La mitosis es el proceso de division celular mediante el cual una' },
  { sentence_key: 'p1-S2', text: 'cellula madre produce dos celulas hijas geneticamente identicas entre si,' },
  { sentence_key: 'p1-S3', text: 'conservando el numero cromosomico original de la especie.' },
  { sentence_key: 'p1-S4', text: 'Este proceso se desarrolla en cuatro fases principales: profase,' },
  { sentence_key: 'p1-S5', text: 'metafase, anafase y telofase, cada una con eventos morfologicos' },
  { sentence_key: 'p1-S6', text: 'caracteristicos que garantizan la correcta reparticion del material' },
  { sentence_key: 'p1-S7', text: 'genetico. La mitosis fue descrita por Walther Flemming en 1882' },
  { sentence_key: 'p1-S8', text: 'mediante observaciones de celulas de salamandra.' },
  { sentence_key: 'p1-S9', text: 'En cambio, la meiosis reduce a la mitad el numero de cromosomas y' },
  { sentence_key: 'p1-S10', text: 'genera cuatro celulas geneticamente distintas, base de la variabilidad' },
  { sentence_key: 'p1-S11', text: 'genetica de las especies sexuales.' },
];

const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'lumena-staging-e2e-test@example.com', password: 'test123456' }),
});
const { access_token } = await res.json();

const r = await fetch(`${SUPABASE_URL}/functions/v1/ai-highlight`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
  body: JSON.stringify({
    document_id: '9c95cbe6-9e4b-45e8-a9ca-e6b1508d1a6a',
    workspace_id: '7e80d862-e553-44ab-b710-1a2d972f9007',
    page_number: 1, sentences: spanishSentences, density: 'normal',
  }),
});
const data = await r.json().catch(() => ({}));
console.log('HTTP', r.status);
const total = spanishSentences.reduce((s, x) => s + x.text.length, 0);
const sels = data.selections ?? [];
const quoted = sels.reduce((s, x) => s + (x.quote?.length ?? 0), 0);
for (const s of sels) console.log(`  [${s.category}] "${s.quote}"`);
console.log(`coverage ${Math.round(quoted / total * 100)}% · ${sels.length} highlights`);
