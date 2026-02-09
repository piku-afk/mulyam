/**
 * This file is a prototype to parse the CAS pdf file downloaded from CAMS online.
 * It reads the pdf file, extract the summary and holdings data. The extracted data is then logged to the console.
 *
 * The code uses the `pdfjs` library to read the pdf file and extract the text content. It then uses regular expressions to find the relevant lines in the text content and extract the required data.
 *
 * Note: This is a prototype and may not cover all edge cases or variations in the pdf file format. It is intended to be a starting point for further development and refinement.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dayjs from 'dayjs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Holding {
  folio: string;
  isin: string;
  navDate: string;
  nav: number;
  units: number;
  costValue: number;
  marketValue: number;
}

const defaultHolding: Readonly<Holding> = {
  folio: '',
  isin: '',
  navDate: '',
  nav: 0,
  units: 0,
  costValue: 0,
  marketValue: 0,
};

const folioRegex = /\b(?:[1-9]\d{7}|[1-9]\d{10,11})\b/g;
const isinRegex = /INF[A-Z0-9]+/;
const ignoredLines: RegExp[] = [/Version:(V\d+\.\d+)\s+(Live-\d+)/];

// WIP
async function main() {
  const validPdfBuffer = await readFile(join(__dirname, '..', 'sample.pdf'));

  const pdf = await getDocument({
    data: new Uint8Array(validPdfBuffer),
    useSystemFonts: true,
  }).promise;

  const pageContent: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const textContent: string[] = [];
    let lastX: number | undefined;
    let lastY: number | undefined;
    let lineHeight: number = 0;
    const lineThreshold = 4.6;
    const cellThreshold = 7;
    const cellSeparator = '\t';

    for (const item of content.items) {
      if (!('str' in item)) continue;

      const transformationMatrix = item.transform;
      const [x, y] = viewport.convertToViewportPoint(
        transformationMatrix[4],
        transformationMatrix[5],
      );

      textContent.push(item.str);
      lastX = x + item.width;
      lastY = y;
      lineHeight = Math.max(lineHeight, item.height);

      if (lastY !== undefined && Math.abs(lastY - y) > lineThreshold) {
        const lastItem = textContent.length ? textContent[textContent.length - 1] : undefined;
        const isCurrentItemHasNewLine =
          item.str.startsWith('\n') || (item.str.trim() === '' && item.hasEOL);

        if (lastItem?.endsWith('\n') === false && !isCurrentItemHasNewLine) {
          const yDiff = Math.abs(lastY - y);

          if (yDiff - 1 > lineHeight) {
            textContent.push('\n');
            lineHeight = 0;
          }
        }
      }

      if (lastY !== undefined && Math.abs(lastY - y) < lineThreshold) {
        if (lastX !== undefined && Math.abs(lastX - x) > cellThreshold) {
          item.str = `${cellSeparator}${item.str}`;
        }
      }

      if (item.hasEOL) {
        textContent.push('\n');
      }

      if (item.hasEOL || item.str.endsWith('\n')) {
        lineHeight = 0;
      }
    }

    pageContent.push(textContent.join(''));
    page.cleanup();
  }

  const holdings = new Map<string, Holding>();
  const lines = pageContent.join('\n').split('\n');
  let currentHolding: Holding = { ...defaultHolding };

  for (const line of lines) {
    const trimmed = line.trim();

    if (ignoredLines.some((pattern) => pattern.test(trimmed))) {
      continue;
    }

    const folioMatch = trimmed.match(folioRegex);
    const isinMatch = trimmed.match(isinRegex);

    if (folioMatch) {
      const schemeParts = trimmed.split(' ');

      if (schemeParts.length >= 2) {
        const [folioNumber] = schemeParts[0].split('/');
        const decimalValue = Number(schemeParts[1].replace(/,/g, '').match(/\d+(\.\d{2})?/)?.[0]);

        if (!folioMatch || !decimalValue) continue;

        currentHolding.folio = folioNumber.trim();
        currentHolding.marketValue = decimalValue;
      }
    } else if (isinMatch) {
      const schemeParts = trimmed.split(' ').map((part) => part.trim());

      currentHolding.units = +schemeParts[0].replace(/,/g, '');
      currentHolding.navDate = dayjs(schemeParts[1]).format('YYYY-MM-DD');
      currentHolding.nav = +schemeParts[2].replace(/,/g, '');
      currentHolding.isin = isinMatch[0];
      currentHolding.costValue = +schemeParts[4].replace(/,/g, '');
    }

    if (currentHolding.isin && currentHolding.marketValue) {
      holdings.set(currentHolding.isin, currentHolding);
      currentHolding = { ...defaultHolding };
    }
  }

  console.log(Array.from(holdings.values()));
}

main();
