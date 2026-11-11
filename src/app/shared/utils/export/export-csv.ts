// CSV sin librería — doc 43, sección 8.5. Para cargar datos en otro
// sistema: solo encabezado y filas, sin título, filtros ni totales.
import { ExportColumn, ExportTable } from './export.models';
import {
  escapeFormulaInjection,
  isEmptyZero,
  isoDateParts,
  rawColumnValue,
  toFiniteNumber,
} from './export-values';

const BOM = '﻿';

function quoteText(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function csvCellValue<T>(column: ExportColumn<T>, row: T, index: number): string {
  const raw = rawColumnValue(column, row, index);
  if (raw == null || raw === '' || isEmptyZero(column, raw)) return '';

  switch (column.type) {
    case 'text':
    case 'code':
      return quoteText(escapeFormulaInjection(String(raw)));
    case 'integer': {
      const n = toFiniteNumber(raw);
      return n == null ? '' : String(Math.round(n));
    }
    case 'money': {
      const n = toFiniteNumber(raw);
      return n == null ? '' : n.toFixed(2);
    }
    case 'weight': {
      const n = toFiniteNumber(raw);
      return n == null ? '' : n.toFixed(1);
    }
    case 'quantity': {
      const n = toFiniteNumber(raw);
      return n == null ? '' : String(Math.round(n * 1000) / 1000);
    }
    case 'date': {
      const p = isoDateParts(raw);
      return p ? `${p.y}-${pad2(p.m)}-${pad2(p.d)}` : '';
    }
    case 'datetime': {
      const p = isoDateParts(raw);
      return p ? `${p.y}-${pad2(p.m)}-${pad2(p.d)} ${pad2(p.hh)}:${pad2(p.mm)}` : '';
    }
    case 'time': {
      const p = isoDateParts(raw);
      return p ? `${pad2(p.hh)}:${pad2(p.mm)}` : '';
    }
  }
}

export function buildCsv<T>(table: ExportTable<T>): Blob {
  const lines: string[] = [];
  lines.push(table.columns.map((c) => quoteText(c.header)).join(','));
  table.rows.forEach((row, index) => {
    lines.push(table.columns.map((c) => csvCellValue(c, row, index)).join(','));
  });
  const content = BOM + lines.join('\r\n') + '\r\n';
  return new Blob([content], { type: 'text/csv;charset=utf-8' });
}
