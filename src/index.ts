import dayjs from 'dayjs';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorker;

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

const INVALID_FILE_ERROR_MESSAGE = 'You seem to have uploaded an invalid file. Please try again.';
const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');

function showError(message: string) {
  const errorElement = document.createElement('p');
  errorElement.className = 'error';
  errorElement.textContent = message;
  document.querySelector('main')?.appendChild(errorElement);
}

function hideError() {
  document.querySelector('p.error')?.remove();
}

function clearTable() {
  const tbody = document.querySelector('tbody');

  if (tbody) {
    tbody.textContent = '';
  }
}

function readFileAsync(file: File): Promise<string | ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onload = () => resolve(fileReader.result);
    fileReader.onerror = reject;
    fileReader.readAsArrayBuffer(file);
  });
}

fileInput?.addEventListener('change', async () => {
  try {
    hideError();
    clearTable();

    const file = fileInput.files?.[0];
    if (!file) {
      throw new Error(INVALID_FILE_ERROR_MESSAGE);
    }

    const arrayBuffer = await readFileAsync(file);
    const typedArray = new Uint8Array(arrayBuffer as ArrayBuffer);

    const pdf = await getDocument({
      data: new Uint8Array(typedArray),
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

    if (holdings.size === 0) {
      throw new Error(INVALID_FILE_ERROR_MESSAGE);
    }

    const tableBody = document.querySelector('tbody');

    for (const holding of holdings.values()) {
      const tableRow = document.createElement('tr');

      const folioNumberCell = document.createElement('td');
      folioNumberCell.textContent = holding.folio;
      tableRow.append(folioNumberCell);

      const isinCell = document.createElement('td');
      isinCell.textContent = holding.isin;
      tableRow.append(isinCell);

      const navDateCell = document.createElement('td');
      navDateCell.textContent = holding.navDate;
      tableRow.append(navDateCell);

      const navCell = document.createElement('td');
      navCell.textContent = holding.nav.toString();
      tableRow.append(navCell);

      const units = document.createElement('td');
      units.textContent = holding.units.toString();
      tableRow.append(units);

      const costPriceCell = document.createElement('td');
      costPriceCell.textContent = holding.costValue.toString();
      tableRow.append(costPriceCell);

      const marketPriceCell = document.createElement('td');
      marketPriceCell.textContent = holding.marketValue.toString();
      tableRow.append(marketPriceCell);

      tableBody?.appendChild(tableRow);
    }
  } catch (error) {
    if (error instanceof Error) {
      showError(error.message);
    }
  }
});
