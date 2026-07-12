import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

async function generatePdf(pageCount: number, filename: string) {
  const pdfDoc = await PDFDocument.create();
  
  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.addPage([600, 400]);
    page.drawText(`Page ${i + 1} of ${pageCount}`, {
      x: 50,
      y: 350,
      size: 30,
      color: rgb(0, 0, 0),
    });
  }

  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(path.join(process.cwd(), filename), pdfBytes);
  console.log(`Generated ${filename} (${(pdfBytes.byteLength / 1024 / 1024).toFixed(2)} MB)`);
}

async function main() {
  await generatePdf(100, 'dummy-100.pdf');
  await generatePdf(500, 'dummy-500.pdf');
  await generatePdf(1000, 'dummy-1000.pdf');
}

main().catch(console.error);
