import { Injectable } from '@angular/core';
import { ExportFormat, ExportTable } from './export.models';
import { downloadBlob } from './download';
import { buildCsv } from './export-csv';

/**
 * Punto de entrada único del exportador (doc 43, sección 8.9). Las páginas
 * nunca llaman a ExcelJS ni arman CSV directo: arman un `ExportTable` y
 * llaman a `export(table, format)`.
 */
@Injectable({ providedIn: 'root' })
export class TableExporter {
  async export<T>(table: ExportTable<T>, format: ExportFormat): Promise<void> {
    const blob = format === 'xlsx' ? await this.buildXlsxSafe(table) : buildCsv(table);
    const fileName = table.fileName.endsWith(`.${format}`)
      ? table.fileName
      : `${table.fileName}.${format}`;
    downloadBlob(blob, fileName);
  }

  private async buildXlsxSafe<T>(table: ExportTable<T>): Promise<Blob> {
    try {
      const { buildXlsx } = await import('./export-xlsx');
      return await buildXlsx(table);
    } catch (err) {
      if (err instanceof Error && err.message === 'EXCELJS_LOAD_FAILED') {
        throw new Error(
          'No se pudo preparar el archivo de Excel. Revisa tu conexión o exporta en CSV.',
        );
      }
      throw new Error('No se pudo generar el archivo. Intenta de nuevo.');
    }
  }
}
