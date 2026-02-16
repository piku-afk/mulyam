/**
 * This file is a prototype to parse the groww Transaction and Holding Statement pdf file downloaded from email.
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
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

dayjs.extend(customParseFormat);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Holding {
  isin: string;
  rate: number;
  units: number;
  value: number;
}

const defaultHolding: Holding = {
  isin: '',
  rate: 0,
  units: 0,
  value: 0,
};

const holdingHeadings = ['holdings balance'];
const dateRegex = /\d{2}-\d{2}-\d{4}/;
const isinRegex = /^IN[EF]\d[A-Z0-9]+/;
const totalAmountRegex = /Total\s*([\d,]+\.?\d*)/;
const differenceTolerance = 0.05;

function isHoldingValid(holdings: Map<string, Holding>, totalAmount: number): boolean {
  const holdingsTotal = +Array.from(holdings.values())
    .reduce((result, holding) => result + holding.value, 0)
    .toFixed(2);

  return Math.abs(totalAmount - holdingsTotal) <= differenceTolerance;
}

async function main() {
  const validPdfBuffer = await readFile(join(__dirname, '..', '..', 'sample.groww.pdf'));
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

  const lines = pageContent.join('\n').split('\n');
  const strippedLines = lines.slice(
    lines.findIndex((line) =>
      holdingHeadings.some((heading) => new RegExp(heading, 'i').test(line)),
    ),
  );

  const holdings = new Map<string, Holding>();
  let holdingDate: string = '';
  let totalAmount = 0;
  let currentHolding: Holding = { ...defaultHolding };

  for (const line of strippedLines) {
    const trimmed = line.trim();
    const isinMatch = trimmed.match(isinRegex);
    const holdingDateMatch = trimmed.match(dateRegex);
    const totalAmountMatch = trimmed.match(totalAmountRegex);

    if (holdingDateMatch) {
      holdingDate = dayjs(holdingDateMatch[0], 'DD-MM-YYYY').format('YYYY-MM-DD');
    }

    if (totalAmountMatch) {
      totalAmount = +totalAmountMatch[1].replace(',', '');
    }

    currentHolding.isin = isinMatch?.[0] ?? currentHolding.isin;
    const schemeParts = trimmed.split(' ');
    currentHolding.units = +(schemeParts.find((item) => Number.isFinite(+item)) ?? 0);
    currentHolding.rate = +schemeParts[schemeParts.length - 2] || 0;
    currentHolding.value = +schemeParts[schemeParts.length - 1] || 0;

    if (
      currentHolding.isin &&
      currentHolding.rate &&
      currentHolding.units &&
      currentHolding.value
    ) {
      holdings.set(currentHolding.isin, { ...defaultHolding, ...currentHolding });
      currentHolding = { ...defaultHolding };
    }
  }

  console.log('Holdings are valid for', holdingDate, isHoldingValid(holdings, totalAmount));
}

main();
