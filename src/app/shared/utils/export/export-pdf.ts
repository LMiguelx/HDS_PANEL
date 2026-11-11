// PDF con jsPDF + jspdf-autotable — doc 63, sección 7.3. Carga perezosa
// obligatoria, igual que ExcelJS: ninguna de las dos librerías va en el
// bundle inicial.
import { format, parseISO } from 'date-fns';
import { ExportColumn, ExportTable } from './export.models';
import { columnScreenText, isEmptyZero, rawColumnValue } from './export-values';

const MARGIN = 10; // mm
const RED: [number, number, number] = [209, 59, 59];
const INK: [number, number, number] = [26, 26, 26];
const MUTED: [number, number, number] = [95, 102, 114];
const HAIRLINE: [number, number, number] = [222, 222, 222];
const PAGE_WIDTH = 210; // A4 vertical, mm
const PAGE_HEIGHT = 297;

function dateOnly(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy');
}

function dateTimeAmPm(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy hh:mm:ss a');
}

function screenNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Celda de texto para la tabla — misma regla de formato que pantalla/Excel (doc 43, sección 8.3). */
function cellText<T>(column: ExportColumn<T>, row: T, index: number): string {
  const raw = rawColumnValue(column, row, index);
  if ((column.type === 'text' || column.type === 'code') && !isEmptyZero(column, raw)) {
    return raw == null || raw === '' ? '—' : String(raw);
  }
  return columnScreenText(column, row, index);
}

function isRightAligned(type: ExportColumn<unknown>['type']): boolean {
  return type !== 'text' && type !== 'code';
}

export async function buildPdf<T>(table: ExportTable<T>): Promise<Blob> {
  let jsPDFCtor: typeof import('jspdf').jsPDF;
  let autoTable: typeof import('jspdf-autotable').default;
  try {
    const [jspdfMod, autotableMod] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    jsPDFCtor = jspdfMod.jsPDF;
    autoTable = autotableMod.default;
  } catch {
    throw new Error('JSPDF_LOAD_FAILED');
  }

  const doc = new jsPDFCtor({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal');

  let y = MARGIN;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  if (table.generatedAt) {
    doc.text('HDS Gestor de pedidos', MARGIN, y);
    y += 4;
    doc.text(`Fecha de consulta: ${dateOnly(table.generatedAt)}`, MARGIN, y);
    y += 5;
  } else {
    doc.text(`Generado el ${screenNow()}`, MARGIN, y);
    y += 5;
  }

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...INK);
  doc.text(table.title, PAGE_WIDTH / 2, y, { align: 'center' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  if (table.subtitle) {
    doc.text(table.subtitle, PAGE_WIDTH / 2, y, { align: 'center' });
    y += 5;
  }
  if (table.filters.length > 0) {
    doc.text(table.filters.map((f) => `${f.label}: ${f.value}`).join(' · '), PAGE_WIDTH / 2, y, {
      align: 'center',
    });
    y += 5;
  }
  y += 2;

  const head = [table.columns.map((c) => c.header.toLocaleUpperCase('es-PE'))];
  const body = table.rows.map((row, index) =>
    table.columns.map((col) => cellText(col, row, index)),
  );

  const columnStyles: Record<number, { halign: 'left' | 'right' }> = {};
  table.columns.forEach((col, i) => {
    columnStyles[i] = { halign: isRightAligned(col.type) ? 'right' : 'left' };
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      fontSize: 8,
      cellPadding: 1.8,
      lineColor: HAIRLINE,
      lineWidth: 0.1,
      textColor: INK,
    },
    headStyles: {
      fillColor: false,
      textColor: INK,
      fontStyle: 'bold',
      lineWidth: { bottom: 0.3, top: 0, left: 0, right: 0 },
    },
    columnStyles,
    didParseCell: (data) => {
      if (data.section === 'body') {
        const col = table.columns[data.column.index];
        if (col?.redText) data.cell.styles.textColor = RED;
        if (col?.bold) data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const lastTable = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  let finalY = (lastTable?.finalY ?? y) + 6;

  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  if (table.footnote) {
    doc.text(table.footnote, MARGIN, finalY);
    finalY += 5;
  }
  if (table.generatedAt) {
    doc.setFontSize(9);
    doc.text(
      `---- Fin del reporte ----  ${dateTimeAmPm(table.generatedAt)}`,
      PAGE_WIDTH / 2,
      finalY,
      { align: 'center' },
    );
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Página ${i} de ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, {
      align: 'right',
    });
  }

  return doc.output('blob');
}
