/**
 * Compares BEFORE vs AFTER selection quality by calling the deployed
 * ai-highlight function with the same Spanish/English sentences.
 * Reports metrics: highlight count, avg length, coverage, dedup.
 */
const SUPABASE_URL = 'https://nsjetmjtwbhellqasggw.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zamV0bWp0d2JoZWxscWFzZ2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3ODA5NDYsImV4cCI6MjA5OTM1Njk0Nn0.ueBlzTVAaNMezBqsVIczcO6-ogiJyML340pGwwpPN1s';

// Real sentence inventory of quality-spanish.pdf page 1 (from the PDF text layer)
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

const englishSentences = [
  { sentence_key: 'p1-S0', text: 'Photosynthesis and Energy' },
  { sentence_key: 'p1-S1', text: 'Photosynthesis is the biochemical process by which green plants, algae' },
  { sentence_key: 'p1-S2', text: 'and cyanobacteria convert light energy into chemical energy stored in' },
  { sentence_key: 'p1-S3', text: 'glucose, using water and carbon dioxide while releasing oxygen.' },
  { sentence_key: 'p1-S4', text: 'The light-dependent reactions occur in the thylakoid membranes, where' },
  { sentence_key: 'p1-S5', text: 'chlorophyll absorbs photons and splits water molecules. The Calvin' },
  { sentence_key: 'p1-S6', text: 'cycle, discovered by Melvin Calvin in 1950, fixes carbon dioxide into' },
  { sentence_key: 'p1-S7', text: 'three-carbon sugars using the ATP and NADPH produced earlier.' },
  { sentence_key: 'p1-S8', text: 'Photosynthesis produces approximately 100 billion tons of biomass' },
  { sentence_key: 'p1-S9', text: 'every year, sustaining nearly all life on Earth.' },
];

async function login() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'lumena-staging-e2e-test@example.com', password: 'test123456' }),
  });
  const data = await res.json();
  return data.access_token;
}

async function analyze(token, sentences, density) {
  // document_id/workspace_id must pass validation; use the QA user's workspace
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-highlight`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      document_id: '9c95cbe6-9e4b-45e8-a9ca-e6b1508d1a6a',
      workspace_id: '7e80d862-e553-44ab-b710-1a2d972f9007',
      page_number: 1,
      sentences,
      density,
    }),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function report(name, sentences, result) {
  const total = sentences.reduce((s, x) => s + x.text.length, 0);
  const sels = result.data.selections ?? [];
  const quoted = sels.reduce((s, x) => s + (x.quote?.length ?? 0), 0);
  console.log(`\n=== ${name} (${result.status}) ===`);
  for (const s of sels) {
    console.log(`  [${s.category}] (${Math.round((s.quote?.length ?? 0))}ch) "${s.quote}"`);
  }
  console.log(`  coverage: ${total ? Math.round(quoted / total * 100) : 0}% of ${total} chars · ${sels.length} highlights · avg ${sels.length ? Math.round(quoted / sels.length) : 0}ch`);
}

const token = await login();
if (!token) { console.error('login failed'); process.exit(1); }

for (const density of ['low', 'normal', 'high']) {
  const es = await analyze(token, spanishSentences, density);
  report(`ESPAÑOL — densidad ${density}`, spanishSentences, es);
  const en = await analyze(token, englishSentences, density);
  report(`ENGLISH — density ${density}`, englishSentences, en);
}
