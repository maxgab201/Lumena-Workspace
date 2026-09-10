/**
 * Generates test PDFs for Checkpoint 3:
 *   - native-small.pdf  : 1 page native text
 *   - native-multi.pdf  : 5 pages native text
 *   - scanned.pdf       : 2 pages rendered as images (no text layer)
 *   - mixed.pdf         : 2 native pages + 1 scanned page
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createCanvas } from 'canvas';
import fs from 'fs';

const OUT = 'tests/fixtures';

async function makeNativePdf(pages) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageTexts = [
    {
      title: 'Introduction to Machine Learning',
      body: [
        'Machine learning is a field of artificial intelligence that gives',
        'computers the ability to learn from data without being explicitly',
        'programmed. Supervised learning uses labeled examples to train',
        'models that predict outcomes for new inputs.',
        '',
        'On July 4, 1776, the founding fathers signed the Declaration of',
        'Independence, establishing the United States of America.',
      ],
    },
    {
      title: 'Photosynthesis in Plants',
      body: [
        'Photosynthesis is the process by which green plants convert sunlight',
        'into chemical energy. The chloroplast absorbs carbon dioxide and water,',
        'producing glucose and oxygen. The mitochondria is the powerhouse',
        'of the cell, generating adenosine triphosphate through respiration.',
        '',
        'The Pacific Ocean is the largest ocean on Earth, covering more than',
        'sixty million square miles of the planet surface.',
      ],
    },
    {
      title: 'World War II Overview',
      body: [
        'World War II began in September 1939 when Germany invaded Poland.',
        'The conflict involved most of the great powers organized into two',
        'alliances: the Allies and the Axis powers. The war ended in 1945',
        'after the surrender of Japan following the atomic bombings.',
        '',
        'The theory of general relativity was published by Albert Einstein',
        'in 1915, describing gravity as a curvature of spacetime.',
      ],
    },
    {
      title: 'The Water Cycle',
      body: [
        'Evaporation transforms liquid water into vapor as the sun heats',
        'oceans, lakes, and rivers. Condensation forms clouds when water',
        'vapor cools in the atmosphere. Precipitation returns water to the',
        'surface as rain or snow, completing the natural cycle.',
        '',
        'The Great Wall of China stretches over thirteen thousand miles,',
        'built across centuries to protect ancient Chinese states.',
      ],
    },
    {
      title: 'Economics Fundamentals',
      body: [
        'Supply and demand determine market prices in a free economy.',
        'Inflation erodes purchasing power when too much money chases too',
        'few goods. Gross domestic product measures the total value of',
        'goods and services produced within a nation during one year.',
        '',
        'The Renaissance began in Italy during the fourteenth century,',
        'reviving classical art, literature, and philosophy across Europe.',
      ],
    },
  ];

  for (let i = 0; i < pages && i < pageTexts.length; i++) {
    const { title, body } = pageTexts[i];
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

async function addScannedPage(doc, text) {
  // Render the text to a canvas, embed as JPEG, stretch to full page → no text layer
  const canvas = createCanvas(1240, 1600);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#222222';
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText(text.title, 90, 140);
  ctx.font = '30px sans-serif';
  let y = 230;
  for (const line of text.body) {
    ctx.fillText(line, 90, y);
    y += 50;
  }
  const jpeg = canvas.toBuffer('image/jpeg', 0.92);
  const image = await doc.embedJpg(jpeg);
  const page = doc.addPage([612, 792]);
  page.drawImage(image, { x: 0, y: 0, width: 612, height: 792 });
}

async function makeScannedPdf(pageTexts) {
  const doc = await PDFDocument.create();
  for (const t of pageTexts) {
    await addScannedPage(doc, t);
  }
  return doc;
}

async function makeMixedPdf() {
  const doc = await makeNativePdf(2);
  await addScannedPage(doc, {
    title: 'Scanned Chapter: Historical Notes',
    body: [
      'This page is a scanned image without any text layer.',
      'The Rosetta Stone was deciphered by Champollion in 1822.',
      'Pompeii was buried by the eruption of Mount Vesuvius in 79 AD.',
      'The printing press was invented by Gutenberg around 1440.',
    ],
  });
  return doc;
}

(async () => {
  const native1 = await makeNativePdf(1);
  fs.writeFileSync(`${OUT}/ai-native-small.pdf`, await native1.save());

  const native5 = await makeNativePdf(5);
  fs.writeFileSync(`${OUT}/ai-native-multi.pdf`, await native5.save());

  const scanned = await makeScannedPdf([
    {
      title: 'Scanned Page One: Chemistry',
      body: [
        'Water is composed of two hydrogen atoms and one oxygen atom.',
        'The pH scale measures acidity from zero to fourteen.',
        'Helium is the second lightest element in the universe.',
      ],
    },
    {
      title: 'Scanned Page Two: Astronomy',
      body: [
        'Mars has two small moons named Phobos and Deimos.',
        'The Sun contains ninety nine percent of the solar system mass.',
        'Light travels at approximately three hundred thousand km per second.',
      ],
    },
  ]);
  fs.writeFileSync(`${OUT}/ai-scanned.pdf`, await scanned.save());

  const mixed = await makeMixedPdf();
  fs.writeFileSync(`${OUT}/ai-mixed.pdf`, await mixed.save());

  console.log('Generated: ai-native-small.pdf, ai-native-multi.pdf, ai-scanned.pdf, ai-mixed.pdf');
})();
