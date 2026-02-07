/**
 * This file is a prototype to parse the excel file downloaded from groww app.
 * It reads the excel file, converts it to csv, and then parses the csv to extract the summary and holdings data. The extracted data is then logged to the console.
 *
 * The code uses the `xlsx` library to read the excel file and convert it to csv, and the `papaparse` library to parse the csv data. It also uses some helper functions to find the relevant rows and columns in the data based on the headings.
 *
 * Note: This is a prototype and may not cover all edge cases or variations in the excel file format. It is intended to be a starting point for further development and refinement.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// xlsx to csv
const workbook = XLSX.readFile(join(__dirname, '../sample.xlsx'));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const csvData = XLSX.utils.sheet_to_csv(worksheet);

// parse csv
const { data } = Papa.parse<string[]>(csvData);
const filteredData = data.map((row) => row.filter((cell) => !!cell)).filter((row) => !!row.length);

const headingMap = {
  amc: ['amc'],
  xirr: ['xirr'],
  units: ['units'],
  category: ['category'],
  scheme_name: ['scheme name'],
  summary: ['holding summary'],
  holdings: ['holdings as on'],
  sub_category: ['sub-category'],
  returns: ['profit/loss', 'returns'],
  returns_percentage: ['profit/loss %'],
  invested: ['total investments', 'invested value'],
  current: ['current portfolio value', 'current value'],
} as const;

function matchesPattern(patterns: readonly string[], text: string) {
  return patterns.some((pattern) => new RegExp(pattern, 'i').test(text));
}

function findRowIndex(data: string[][], patterns: readonly string[]) {
  return data.findIndex((row) => row.some((cell) => matchesPattern(patterns, cell)));
}

const summaryHeadingRowIndex = findRowIndex(filteredData, headingMap.summary);
if (summaryHeadingRowIndex === -1) {
  throw new Error('Summary heading row not found');
}
const summaryHeadingRow = filteredData[summaryHeadingRowIndex + 1];
const summaryDataRow = filteredData[summaryHeadingRowIndex + 2];

const holdingsHeadingRowIndex = findRowIndex(filteredData, headingMap.holdings);
if (holdingsHeadingRowIndex === -1) {
  throw new Error('Holdings heading row not found');
}
const holdingsHeadingRow = filteredData[holdingsHeadingRowIndex + 1];
const holdingsDataRows = filteredData.slice(holdingsHeadingRowIndex + 2);

const summaryColumnIndexMap = Object.fromEntries(
  Object.entries({
    current: headingMap.current,
    invested: headingMap.invested,
    returns: headingMap.returns,
    returns_percentage: headingMap.returns_percentage,
    xirr: headingMap.xirr,
  }).map(([key, patterns]) => {
    const columnIndex = summaryHeadingRow.findIndex((heading) => matchesPattern(patterns, heading));

    if (columnIndex === -1) {
      throw new Error(`Column for ${key} not found in summary`);
    }

    return [key, columnIndex];
  }),
);

const holdingsColumnIndexMap = Object.fromEntries(
  Object.entries({
    scheme_name: headingMap.scheme_name,
    amc: headingMap.amc,
    category: headingMap.category,
    sub_category: headingMap.sub_category,
    units: headingMap.units,
    invested: headingMap.invested,
    current: headingMap.current,
    returns: headingMap.returns,
    xirr: headingMap.xirr,
  }).map(([key, patterns]) => {
    const columnIndex = holdingsHeadingRow.findIndex((heading) =>
      matchesPattern(patterns, heading),
    );

    if (columnIndex === -1) {
      throw new Error(`Column for ${key} not found in holdings`);
    }

    return [key, columnIndex];
  }),
);

const summary = {
  current: Number.parseFloat(summaryDataRow[summaryColumnIndexMap.current]) || 0,
  invested: Number.parseFloat(summaryDataRow[summaryColumnIndexMap.invested]) || 0,
  returns: Number.parseFloat(summaryDataRow[summaryColumnIndexMap.returns]) || 0,
  returns_percentage:
    Number.parseFloat(summaryDataRow[summaryColumnIndexMap.returns_percentage]) || 0,
  xirr: Number.parseFloat(summaryDataRow[summaryColumnIndexMap.xirr]) || 0,
};

const holdings = holdingsDataRows.map((row) => ({
  scheme_name: row[holdingsColumnIndexMap.scheme_name] || '',
  amc: row[holdingsColumnIndexMap.amc] || '',
  category: row[holdingsColumnIndexMap.category] || '',
  sub_category: row[holdingsColumnIndexMap.sub_category] || '',
  units: Number.parseFloat(row[holdingsColumnIndexMap.units]) || 0,
  invested: Number.parseFloat(row[holdingsColumnIndexMap.invested]) || 0,
  current: Number.parseFloat(row[holdingsColumnIndexMap.current]) || 0,
  returns: Number.parseFloat(row[holdingsColumnIndexMap.returns]) || 0,
  xirr: Number.parseFloat(row[holdingsColumnIndexMap.xirr]) || 0,
}));

console.log('summary', summary);
console.log('holdings', holdings);
