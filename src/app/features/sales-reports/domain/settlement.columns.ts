// Columnas de la liquidación de vendedores — doc 43, secciones 5.5 y 8.3.
// Una sola definición: la usan la tabla (`ui-table`) y el exportador.
import { ExportColumn } from '../../../shared/utils/export/export.models';
import {
  SalespersonSettlementRow,
  SettlementGroupBy,
} from '../../../shared/models/sales-report.models';

export interface SettlementColumnsOptions {
  groupBy: SettlementGroupBy;
  origin: string | null; // 'FIELD' | 'TELESALES' | 'COUNTER' | null ("Todos")
  multiDay: boolean; // el rango tiene más de un día
}

/** Devuelve solo las columnas visibles, en orden — sección 5.5. */
export function settlementColumns(
  opts: SettlementColumnsOptions,
): ExportColumn<SalespersonSettlementRow>[] {
  const { groupBy, origin, multiDay } = opts;
  const showField = origin !== 'TELESALES' && origin !== 'COUNTER';
  const showTelesales = origin !== 'FIELD' && origin !== 'COUNTER';
  const showCounter = origin !== 'FIELD' && origin !== 'TELESALES';
  const showWeight = origin !== 'COUNTER';
  const showHours = groupBy === 'DAY' && origin !== 'COUNTER';
  const showWorkedDays = groupBy === 'SALESPERSON' && origin !== 'COUNTER';
  const showDate = groupBy === 'DAY' && multiDay;

  const columns: ExportColumn<SalespersonSettlementRow>[] = [
    { key: 'item', header: 'Ítem', type: 'integer', value: (_row, index) => index + 1 },
  ];
  if (showDate) {
    columns.push({ key: 'date', header: 'Fecha', type: 'date', value: (r) => r.date });
  }
  columns.push(
    { key: 'salespersonCode', header: 'Código', type: 'code', value: (r) => r.salespersonCode },
    { key: 'salespersonName', header: 'Vendedor', type: 'text', value: (r) => r.salespersonName },
  );
  if (showWorkedDays) {
    columns.push({
      key: 'workedDays',
      header: 'Días trab.',
      type: 'integer',
      value: (r) => r.workedDays,
    });
  }
  if (showField) {
    columns.push(
      {
        key: 'fieldOrderCount',
        header: 'Ped. campo',
        type: 'integer',
        value: (r) => r.fieldOrderCount,
      },
      {
        key: 'fieldNetAmount',
        header: 'Venta campo S/',
        type: 'money',
        value: (r) => r.fieldNetAmount,
      },
    );
  }
  if (showTelesales) {
    columns.push(
      {
        key: 'telesalesOrderCount',
        header: 'Ped. televentas',
        type: 'integer',
        emptyWhenZero: true,
        value: (r) => r.telesalesOrderCount,
      },
      {
        key: 'telesalesNetAmount',
        header: 'Venta televentas S/',
        type: 'money',
        emptyWhenZero: true,
        value: (r) => r.telesalesNetAmount,
      },
    );
  }
  if (showCounter) {
    columns.push(
      {
        key: 'counterOrderCount',
        header: 'Ped. mostrador',
        type: 'integer',
        emptyWhenZero: true,
        value: (r) => r.counterOrderCount,
      },
      {
        key: 'counterNetAmount',
        header: 'Venta mostrador S/',
        type: 'money',
        emptyWhenZero: true,
        value: (r) => r.counterNetAmount,
      },
    );
  }
  columns.push({
    key: 'netAmount',
    header: 'Venta total S/',
    type: 'money',
    bold: true,
    value: (r) => r.netAmount,
  });
  if (showWeight) {
    columns.push({ key: 'weightKg', header: 'Peso', type: 'weight', value: (r) => r.weightKg });
  }
  if (showHours) {
    columns.push(
      { key: 'firstOrderAt', header: 'Hora inicio', type: 'time', value: (r) => r.firstOrderAt },
      { key: 'lastOrderAt', header: 'Hora fin', type: 'time', value: (r) => r.lastOrderAt },
    );
  }
  return columns;
}
