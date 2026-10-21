// Excel (.xlsx) con ExcelJS — doc 43, sección 8.4. Carga perezosa
// obligatoria: ExcelJS solo se importa al exportar, nunca en el bundle
// inicial. Se importa el build de navegador (`dist/exceljs.min.js`, UMD)
// en vez del entrypoint de Node (`main`), que usa `fs`/`stream` y no
// resuelve con esbuild — ver `exceljs-browser.d.ts` para sus tipos.
import type { CellValue } from 'exceljs';
import { ExportColumn, ExportTable } from './export.models';
import {
  columnScreenText,
  isEmptyZero,
  isoDateParts,
  rawColumnValue,
  toFiniteNumber,
} from './export-values';

const HEADER_FILL = 'FFEFEFEF';
const SUBTITLE_FONT_COLOR = 'FF5F6672';
const MAX_SHEET_NAME = 31;

function numFmtFor(type: ExportColumn<unknown>['type']): string | undefined {
  switch (type) {
    case 'money':
      return '#,##0.00';
    case 'weight':
      return '#,##0.0';
    case 'quantity':
      return '#,##0.###';
    case 'integer':
      return '0';
    case 'date':
      return 'dd/mm/yyyy';
    case 'datetime':
      return 'dd/mm/yyyy hh:mm';
    case 'time':
      return 'hh:mm';
    case 'code':
    case 'text':
      return '@';
  }
}

function isNumericType(type: ExportColumn<unknown>['type']): boolean {
  return type === 'integer' || type === 'money' || type === 'quantity' || type === 'weight';
}

function isDateType(type: ExportColumn<unknown>['type']): boolean {
  return type === 'date' || type === 'datetime' || type === 'time';
}

/** Celda lista para ExcelJS: valor tipado + numFmt, nunca una fórmula. */
function cellValueFor<T>(column: ExportColumn<T>, raw: unknown): CellValue {
  if (raw == null || raw === '' || isEmptyZero(column, raw)) return null;
  if (isNumericType(column.type)) return toFiniteNumber(raw) ?? null;
  if (isDateType(column.type)) {
    const p = isoDateParts(raw);
    // Fecha local real, construida de las partes — nunca parseada como UTC.
    return p ? new Date(p.y, p.m - 1, p.d, p.hh, p.mm) : null;
  }
  return String(raw);
}

function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, '').trim();
  return (cleaned || 'Hoja1').slice(0, MAX_SHEET_NAME);
}

function columnWidth<T>(column: ExportColumn<T>, screenTexts: string[]): number {
  if (column.width) return column.width;
  const longest = Math.max(column.header.length, ...screenTexts.map((t) => t.length), 0);
  return Math.min(50, Math.max(8, longest + 2));
}

export async function buildXlsx<T>(table: ExportTable<T>): Promise<Blob> {
  let ExcelJS: typeof import('exceljs');
  try {
    ExcelJS = (await import('exceljs/dist/exceljs.min.js')).default;
  } catch {
    throw new Error('EXCELJS_LOAD_FAILED');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(safeSheetName(table.sheetName ?? table.title));

  let rowNumber = 0;
  const addPlainRow = (
    text: string,
    opts: { bold?: boolean; size?: number; color?: string } = {},
  ) => {
    rowNumber++;
    const row = sheet.getRow(rowNumber);
    row.getCell(1).value = text;
    row.getCell(1).font = {
      bold: !!opts.bold,
      size: opts.size ?? 11,
      color: opts.color ? { argb: opts.color } : undefined,
    };
    return row;
  };

  addPlainRow(table.title, { bold: true, size: 14 });
  if (table.subtitle) addPlainRow(table.subtitle, { bold: true, size: 12 });
  if (table.filters.length > 0) {
    addPlainRow(table.filters.map((f) => `${f.label}: ${f.value}`).join(' · '));
  }
  addPlainRow(`Generado el ${screenNow()}`, { size: 9, color: SUBTITLE_FONT_COLOR });
  rowNumber++; // fila vacía

  rowNumber++;
  const headerRowNumber = rowNumber;
  const headerRow = sheet.getRow(headerRowNumber);
  table.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header.toLocaleUpperCase('es-PE');
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = { bottom: { style: 'thin' } };
    cell.alignment = { horizontal: col.type === 'text' || col.type === 'code' ? 'left' : 'right' };
  });

  const screenTextsByColumn = table.columns.map(() => [] as string[]);
  table.rows.forEach((row, index) => {
    rowNumber++;
    const sheetRow = sheet.getRow(rowNumber);
    table.columns.forEach((col, i) => {
      const raw = rawColumnValue(col, row, index);
      const cell = sheetRow.getCell(i + 1);
      cell.value = cellValueFor(col, raw);
      const fmt = numFmtFor(col.type);
      if (fmt) cell.numFmt = fmt;
      cell.alignment = {
        horizontal: col.type === 'text' || col.type === 'code' ? 'left' : 'right',
      };
      if (col.bold) cell.font = { bold: true };
      screenTextsByColumn[i].push(columnScreenText(col, row, index));
    });
  });

  const dataEndRow = rowNumber;

  if (table.totals) {
    rowNumber++;
    const totalsRow = sheet.getRow(rowNumber);
    table.columns.forEach((col, i) => {
      const cell = totalsRow.getCell(i + 1);
      cell.font = { bold: true };
      cell.alignment = {
        horizontal: col.type === 'text' || col.type === 'code' ? 'left' : 'right',
      };
      if (i === 0) {
        cell.value = table.totalsLabel ?? 'Sumas';
        return;
      }
      if (table.totals && Object.prototype.hasOwnProperty.call(table.totals, col.key)) {
        const raw = table.totals[col.key];
        cell.value = cellValueFor(col, raw);
        const fmt = numFmtFor(col.type);
        if (fmt) cell.numFmt = fmt;
      }
    });
  }

  if (table.footnote) {
    rowNumber++;
    addPlainRow(table.footnote, { size: 9, color: SUBTITLE_FONT_COLOR });
  }

  sheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
  sheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: dataEndRow, column: table.columns.length },
  };
  sheet.columns = table.columns.map((col, i) => ({
    width: columnWidth(col, screenTextsByColumn[i]),
  }));

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function screenNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
