// Tipos del build de navegador de ExcelJS (doc 43, sección 8.4). El paquete
// solo publica tipos para su entrypoint de Node (`exceljs`, `main: excel.js`);
// este archivo los reexporta para `exceljs/dist/exceljs.min.js`, el bundle
// UMD que sí resuelve con esbuild. El objeto UMD (`window.ExcelJS` en tiempo
// de ejecución) expone los mismos símbolos que el namespace de `exceljs`.
declare module 'exceljs/dist/exceljs.min.js' {
  import * as ExcelJS from 'exceljs';
  const value: typeof ExcelJS;
  export default value;
}
