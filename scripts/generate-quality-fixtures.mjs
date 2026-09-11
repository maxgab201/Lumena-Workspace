/**
 * Quality-test fixtures (semantic rework): native PDFs with real
 * multi-sentence prose in Spanish and English — long enough sentences
 * that only part of each is worth highlighting.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';

const OUT = 'tests/fixtures';

async function makePdf(pages) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const { title, body } of pages) {
    const page = doc.addPage([612, 792]);
    page.drawText(title, { x: 72, y: 720, size: 20, font: bold, color: rgb(0.1, 0.1, 0.3) });
    let y = 680;
    for (const line of body) {
      page.drawText(line, { x: 72, y, size: 12, font, color: rgb(0.15, 0.15, 0.15) });
      y -= 20;
    }
  }
  return doc;
}

const spanishPage = {
  title: 'La Celula y la Mitosis',
  body: [
    'La mitosis es el proceso de division celular mediante el cual una',
    'cellula madre produce dos celulas hijas geneticamente identicas entre si,',
    'conservando el numero cromosomico original de la especie.',
    '',
    'Este proceso se desarrolla en cuatro fases principales: profase,',
    'metafase, anafase y telofase, cada una con eventos morfologicos',
    'caracteristicos que garantizan la correcta reparticion del material',
    'genetico. La mitosis fue descrita por Walther Flemming en 1882',
    'mediante observaciones de celulas de salamandra.',
    '',
    'En cambio, la meiosis reduce a la mitad el numero de cromosomas y',
    'genera cuatro celulas geneticamente distintas, base de la variabilidad',
    'genetica de las especies sexuales.',
  ],
};

const englishPage = {
  title: 'Photosynthesis and Energy',
  body: [
    'Photosynthesis is the biochemical process by which green plants, algae',
    'and cyanobacteria convert light energy into chemical energy stored in',
    'glucose, using water and carbon dioxide while releasing oxygen.',
    '',
    'The light-dependent reactions occur in the thylakoid membranes, where',
    'chlorophyll absorbs photons and splits water molecules. The Calvin',
    'cycle, discovered by Melvin Calvin in 1950, fixes carbon dioxide into',
    'three-carbon sugars using the ATP and NADPH produced earlier.',
    '',
    'Photosynthesis produces approximately 100 billion tons of biomass',
    'every year, sustaining nearly all life on Earth.',
  ],
};

(async () => {
  const es = await makePdf([spanishPage]);
  fs.writeFileSync(`${OUT}/quality-spanish.pdf`, await es.save());
  const en = await makePdf([englishPage]);
  fs.writeFileSync(`${OUT}/quality-english.pdf`, await en.save());
  console.log('Generated quality-spanish.pdf and quality-english.pdf');
})();
