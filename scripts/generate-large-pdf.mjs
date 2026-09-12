/**
 * Generates a large native PDF (configurable pages) with real prose per page
 * to reproduce the "big PDF never finishes processing" bug and to test the
 * incremental pipeline afterwards.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';

const PAGES = parseInt(process.argv[2] || '120', 10);
const OUT = process.argv[3] || 'tests/fixtures/large-120p.pdf';

const paragraphs = [
  'The cell is the basic structural and functional unit of all known living organisms. It is the smallest unit of life that can replicate independently, and cells are often called the building blocks of life. The study of cells is called cell biology.',
  'Photosynthesis converts light energy into chemical energy stored in glucose. Plants absorb water through their roots and carbon dioxide from the air, releasing oxygen as a byproduct of the light-dependent reactions.',
  'World War II was the deadliest conflict in human history, marked by mass deaths of civilians including the Holocaust and the strategic bombing of industrial centers. It began in September 1939 and ended in 1945.',
  'Supply and demand form the fundamental mechanism of a market economy. When demand increases while supply remains constant, prices rise; when supply increases with constant demand, prices fall until an equilibrium is reached.',
  'La mitosis es el proceso de division celular mediante el cual una celula madre produce dos celulas hijas geneticamente identicas entre si, conservando el numero cromosomico original de la especie.',
  'El ciclo del agua describe la evaporacion del agua desde océanos y rios, la condensacion en nubes y la precipitacion que devuelve el agua a la superficie terrestre completando el ciclo natural.',
];

(async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (let i = 1; i <= PAGES; i++) {
    const page = doc.addPage([612, 792]);
    const p1 = paragraphs[(i - 1) % paragraphs.length];
    const p2 = paragraphs[i % paragraphs.length];
    const title = `Section ${i}: ${p1.split(' ').slice(0, 4).join(' ')}`;
    page.drawText(title, { x: 72, y: 720, size: 18, font: bold, color: rgb(0.1, 0.1, 0.3) });
    page.drawText(p1, { x: 72, y: 680, size: 12, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(p1.substring(0, 80), { x: 72, y: 656, size: 12, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(p2, { x: 72, y: 620, size: 12, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(p2.substring(0, 80), { x: 72, y: 596, size: 12, font, color: rgb(0.15, 0.15, 0.15) });
  }
  fs.writeFileSync(OUT, await doc.save());
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`Generated ${OUT}: ${PAGES} pages, ${kb} KB`);
})();
