import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// WIP
async function main() {
  const validPdfBuffer = await readFile(join(__dirname, '..', 'sample.pdf'));

  const pdf = await getDocument({
    data: new Uint8Array(validPdfBuffer),
    useSystemFonts: true,
  }).promise;

  let textContent = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.filter((item) => 'str' in item).map((item) => item.str);
    textContent += `${pageText.join(' ')}\n`;
  }

  console.log(textContent.split('\n'));
}

main();
