import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

async function generatePdf(pageCount: number, filename: string, isScanned: boolean = false) {
  const pdfDoc = await PDFDocument.create();
  
  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.addPage([600, 400]);
    
    if (isScanned) {
      // For a "scanned" PDF, we would ideally embed an image.
      // But for testing if a text layer exists, we just draw paths instead of text.
      page.drawRectangle({
        x: 50,
        y: 350,
        width: 100,
        height: 30,
        color: rgb(0.5, 0.5, 0.5),
      });
    } else {
      page.drawText(`Page ${i + 1} of ${pageCount}`, {
        x: 50,
        y: 350,
        size: 30,
        color: rgb(0, 0, 0),
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  const dir = path.join(process.cwd(), 'tests', 'fixtures');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), pdfBytes);
  console.log(`Generated ${filename} (${(pdfBytes.byteLength / 1024 / 1024).toFixed(2)} MB)`);
}

async function main() {
  await generatePdf(1, 'small-native.pdf');
  await generatePdf(100, 'medium-native.pdf');
  await generatePdf(1000, 'large-native.pdf');
  await generatePdf(5, 'scanned.pdf', true); // Scanned (no text)
}

main().catch(console.error);
