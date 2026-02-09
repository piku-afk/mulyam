/**
 * This file is a prototype to parse the CAS pdf file downloaded from CAMS online.
 * It reads the pdf file, extract the summary and holdings data. The extracted data is then logged to the console.
 *
 * The code uses the `pdf-parse` library to read the pdf file and extract the text content. It then uses regular expressions to find the relevant lines in the text content and extract the required data.
 *
 * Note: This is a prototype and may not cover all edge cases or variations in the pdf file format. It is intended to be a starting point for further development and refinement.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dayjs from 'dayjs';
import { PDFParse } from 'pdf-parse';

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

async function main() {
  const validPdfBuffer = await readFile(join(__dirname, '..', 'sample.pdf'));
  const parser = new PDFParse(new Uint8Array(validPdfBuffer));
  const content = await parser.getText();

  const holdings = new Map<string, Holding>();
  const lines = content.text.split('\n');
  let currentHolding: Holding = { ...defaultHolding };

  const folioRegex = /\b(?:[1-9]\d{7}|[1-9]\d{10,11})\b/g;
  const isinRegex = /INF[A-Z0-9]+/g;

  for (const line of lines) {
    const trimmed = line.trim();

    const folioMatch = trimmed.match(folioRegex);
    const isinMatch = trimmed.match(isinRegex);

    if (folioMatch) {
      const schemeParts = trimmed.split('\t');

      if (schemeParts.length >= 3) {
        const [folioNumber] = schemeParts[0].split('/');
        const marketValue = +schemeParts[1].replace(/,/g, '');

        currentHolding.folio = folioNumber.trim();
        currentHolding.marketValue = marketValue;
      }
    } else if (isinMatch) {
      const schemeParts = trimmed.split('\t').map((part) => part.trim());
      const [units, dateString] = schemeParts[0].split(' ');

      currentHolding.isin = schemeParts[schemeParts.length - 2];
      currentHolding.navDate = dayjs(dateString).format('YYYY-MM-DD');
      currentHolding.nav = +schemeParts[1].replace(/,/g, '');
      currentHolding.units = +units.replace(/,/g, '');
      currentHolding.costValue = +schemeParts[schemeParts.length - 1].replace(/,/g, '');
    }

    if (currentHolding.isin && currentHolding.marketValue) {
      holdings.set(currentHolding.isin, currentHolding);
      currentHolding = { ...defaultHolding };
    }
  }

  console.log(Array.from(holdings.values()));
}

main();
