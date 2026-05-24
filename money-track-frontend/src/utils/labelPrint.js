// Archivo: src/utils/labelPrint.js
// Propósito: centralizar la impresión de etiquetas para que Movimientos y Reportes usen exactamente el mismo formato.

import { formatShortDate, getISOWeekInfo } from './dates.js';
import { formatMoneyByCurrency, isDollarCurrency } from './money.js';

// Propósito: centralizar las medidas de impresión para la EC-PM-58110.
const THERMAL_PAGE_WIDTH_MM = 58;
const THERMAL_PAGE_HEIGHT_MM = 128;
const THERMAL_CONTENT_WIDTH_MM = 52;
const THERMAL_SAFE_TOP_MM = 2;
const THERMAL_SAFE_BOTTOM_MM = 4;

// Propósito: evitar que textos capturados por el usuario rompan el HTML de impresión.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Propósito: obtener el texto del pie según el tipo de movimiento.
function getFooterText(record) {
  if (record?.tipo === 'cancelado') return 'Registro cancelado';
  if (record?.tipo === 'egreso') return 'Registro de egreso';
  return 'Registro de ingreso';
}

// Propósito: construir los valores que se imprimirán en la etiqueta.
function buildLabelData(record) {
  const safeRecord = record || {};
  const info = getISOWeekInfo(safeRecord.fecha);
  const isDollar = isDollarCurrency(safeRecord.moneda);

  return {
    folio: safeRecord.folio || '00000000',
    fecha: formatShortDate(safeRecord.fecha),
    semana: info.week,
    nombre: String(safeRecord.nombre || '').trim() || 'Movimiento de muestra',
    concepto: String(safeRecord.descripcion || '').trim() || 'Descripción breve del movimiento.',
    monto: formatMoneyByCurrency(safeRecord.cantidad || 0, safeRecord.moneda),
    moneda: isDollar ? 'Dólares' : safeRecord.moneda || 'Sin seleccionar',
    footerText: getFooterText(safeRecord),
  };
}

// Propósito: generar el HTML imprimible optimizado para ticket térmico de 58 mm con área útil real de 48 mm.
function buildPrintableLabelHtml(record) {
  const data = buildLabelData(record);

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title></title>
        <style>
          @page {
            size: ${THERMAL_PAGE_WIDTH_MM}mm ${THERMAL_PAGE_HEIGHT_MM}mm;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            width: ${THERMAL_PAGE_WIDTH_MM}mm;
            min-width: ${THERMAL_PAGE_WIDTH_MM}mm;
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            overflow: visible;
          }

          /* Propósito: definir el área de papel sin depender de la vista previa del navegador. */
          .print-page {
            width: ${THERMAL_PAGE_WIDTH_MM}mm;
            max-width: ${THERMAL_PAGE_WIDTH_MM}mm;
            margin: 0;
            padding: ${THERMAL_SAFE_TOP_MM}mm 0 ${THERMAL_SAFE_BOTTOM_MM}mm;
            background: #ffffff;
          }

          /* Propósito: mantener el mismo contenido que la vista previa de Movimientos en formato térmico. */
          .label-sheet {
            width: ${THERMAL_CONTENT_WIDTH_MM}mm;
            max-width: ${THERMAL_CONTENT_WIDTH_MM}mm;
            margin: 0 auto;
            padding: 0;
            background: #ffffff;
            color: #000000;
            border: none;
            border-radius: 0;
            box-shadow: none;
            page-break-inside: avoid;
            break-inside: avoid;
            text-align: center;
          }

          .label-top {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1mm;
            padding-bottom: 1.2mm;
            margin-bottom: 0.8mm;
            border-bottom: 1px solid #000000;
            text-align: center;
          }

          .label-brand {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.5mm;
            text-align: center;
          }

          .label-brand img {
            display: block;
            width: 10mm;
            height: 10mm;
            object-fit: contain;
            margin: 0 auto;
          }

          .label-brand h3 {
            margin: 0;
            font-size: 15px;
            line-height: 1.05;
            font-weight: 800;
            color: #000000;
          }

          .label-brand p {
            margin: 1px 0 0;
            font-size: 8.5px;
            line-height: 1.1;
            font-weight: 600;
            color: #000000;
          }

          .label-code-box {
            width: 100%;
            padding: 0.4mm 0 0;
            border: none;
            background: #ffffff;
            color: #000000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }

          .label-mini-title,
          .field-title {
            display: block;
            margin: 0 0 0.4mm;
            font-size: 7.2px;
            line-height: 1.05;
            font-weight: 800;
            letter-spacing: 0.06em;
            color: #000000;
            text-transform: uppercase;
          }

          .label-code-box strong {
            display: block;
            font-size: 12px;
            line-height: 1.1;
            font-weight: 800;
            letter-spacing: 0.04em;
            color: #000000;
            word-break: break-word;
          }

          .label-body {
            display: flex;
            flex-direction: column;
            gap: 0;
            text-align: center;
          }

          .label-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.2mm;
            padding: 0.8mm 0;
            border-bottom: 1px dashed #000000;
          }

          .label-field {
            min-height: 0;
            padding: 0;
            border: none;
            background: #ffffff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }

          .label-field.full {
            grid-column: 1 / -1;
          }

          .label-field span:last-child {
            display: block;
            font-size: 10.5px;
            line-height: 1.15;
            font-weight: 600;
            color: #000000;
            word-break: break-word;
            text-align: center;
          }

          .label-footer {
            margin-top: 1.4mm;
            padding-top: 1.4mm;
            border-top: 1px solid #000000;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1.5mm;
            text-align: center;
          }

          .barcode-box {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.8mm;
          }

          .barcode {
            width: 92%;
            height: 8mm;
            border: none;
            background: repeating-linear-gradient(
              90deg,
              #000000 0px,
              #000000 2px,
              #ffffff 2px,
              #ffffff 4px,
              #000000 4px,
              #000000 7px,
              #ffffff 7px,
              #ffffff 9px
            );
          }

          .barcode-box span {
            display: block;
            font-size: 10px;
            line-height: 1.1;
            font-weight: 800;
            letter-spacing: 0.04em;
            color: #000000;
            word-break: break-word;
          }

          .signature-area {
            width: 100%;
            margin-top: 0.8mm;
            padding-top: 1.8mm;
            text-align: center;
          }

          .signature-line {
            width: 78%;
            height: 1px;
            background: #000000;
            margin: 0 auto 1mm;
          }

          .signature-label {
            font-size: 10px;
            line-height: 1.1;
            font-weight: 800;
            color: #000000;
          }

          .signature-note,
          .print-note {
            margin-top: 0.5mm;
            font-size: 7.5px;
            line-height: 1.15;
            font-weight: 600;
            color: #000000;
          }

          .print-note {
            margin-top: 0;
            text-transform: none;
          }

          @media print {
            @page {
              size: ${THERMAL_PAGE_WIDTH_MM}mm ${THERMAL_PAGE_HEIGHT_MM}mm;
              margin: 0;
            }

            html,
            body {
              width: ${THERMAL_PAGE_WIDTH_MM}mm !important;
              min-width: ${THERMAL_PAGE_WIDTH_MM}mm !important;
              max-width: ${THERMAL_PAGE_WIDTH_MM}mm !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              background: #ffffff !important;
              position: static !important;
            }

            .print-page {
              width: ${THERMAL_PAGE_WIDTH_MM}mm !important;
              max-width: ${THERMAL_PAGE_WIDTH_MM}mm !important;
              margin: 0 !important;
              padding: ${THERMAL_SAFE_TOP_MM}mm 0 ${THERMAL_SAFE_BOTTOM_MM}mm !important;
              background: #ffffff !important;
            }

            .label-sheet {
              width: ${THERMAL_CONTENT_WIDTH_MM}mm !important;
              max-width: ${THERMAL_CONTENT_WIDTH_MM}mm !important;
              margin: 0 auto !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        </style>
      </head>
      <body>
        <main class="print-page">
          <section class="label-sheet">
            <div class="label-top">
              <div class="label-brand">
                <img src="/snoopy-laptop-removebg-preview.png" alt="Snoopy Project" />
                <div>
                  <h3>Snoopy Project</h3>
                  <p>Comprobante de movimiento</p>
                </div>
              </div>

              <div class="label-code-box">
                <span class="label-mini-title">Folio</span>
                <strong>${escapeHtml(data.folio)}</strong>
              </div>
            </div>

            <div class="label-body">
              <div class="label-row">
                <div class="label-field">
                  <span class="field-title">Fecha</span>
                  <span>${escapeHtml(data.fecha)}</span>
                </div>

                <div class="label-field">
                  <span class="field-title">Semana</span>
                  <span>${escapeHtml(data.semana)}</span>
                </div>
              </div>

              <div class="label-row">
                <div class="label-field full">
                  <span class="field-title">Nombre</span>
                  <span>${escapeHtml(data.nombre)}</span>
                </div>
              </div>

              <div class="label-row">
                <div class="label-field full">
                  <span class="field-title">Concepto</span>
                  <span>${escapeHtml(data.concepto)}</span>
                </div>
              </div>

              <div class="label-row">
                <div class="label-field">
                  <span class="field-title">Monto</span>
                  <span>${escapeHtml(data.monto)}</span>
                </div>

                <div class="label-field">
                  <span class="field-title">Moneda</span>
                  <span>${escapeHtml(data.moneda)}</span>
                </div>
              </div>
            </div>

            <div class="label-footer">
              <div class="barcode-box">
                <div class="barcode"></div>
                <span>${escapeHtml(data.folio)}</span>
              </div>

              <div class="signature-area">
                <div class="signature-line"></div>
                <div class="signature-label">Firma de recibido</div>
                <div class="signature-note">Nombre y firma del responsable</div>
              </div>

              <div class="print-note">${escapeHtml(data.footerText)}</div>
            </div>
          </section>
        </main>
      </body>
    </html>
  `;
}

// Propósito: esperar a que las imágenes del recibo carguen antes de mandar a imprimir.
function waitForPrintableAssets(printDocument) {
  const images = Array.from(printDocument.images || []);

  if (!images.length) {
    return Promise.resolve();
  }

  return Promise.all(
    images.map((image) => {
      if (image.complete) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        image.onload = resolve;
        image.onerror = resolve;
      });
    }),
  );
}

// Propósito: mostrar un botón manual si el navegador bloquea la impresión automática.
function showManualPrintFallback(printFrame, onAfterPrint) {
  const previousFallback = document.getElementById('snoopy-print-fallback');

  if (previousFallback) {
    previousFallback.remove();
  }

  const fallback = document.createElement('div');
  fallback.id = 'snoopy-print-fallback';
  fallback.style.position = 'fixed';
  fallback.style.right = '18px';
  fallback.style.bottom = '18px';
  fallback.style.zIndex = '999999';
  fallback.style.display = 'flex';
  fallback.style.alignItems = 'center';
  fallback.style.gap = '10px';
  fallback.style.padding = '12px 14px';
  fallback.style.border = '1px solid #cbd5e1';
  fallback.style.borderRadius = '14px';
  fallback.style.background = '#ffffff';
  fallback.style.boxShadow = '0 18px 45px rgba(15, 23, 42, 0.18)';
  fallback.style.fontFamily = 'Arial, Helvetica, sans-serif';

  fallback.innerHTML = `
    <span style="font-size:13px;color:#334155;">No se abrió la impresión automáticamente.</span>
    <button type="button" id="snoopy-print-fallback-button" style="border:0;border-radius:10px;background:#0f172a;color:white;padding:9px 12px;font-size:13px;font-weight:700;cursor:pointer;">
      Imprimir comprobante
    </button>
    <button type="button" id="snoopy-print-fallback-close" style="border:0;background:transparent;color:#64748b;font-size:18px;line-height:1;cursor:pointer;">
      ×
    </button>
  `;

  document.body.appendChild(fallback);

  const printButton = fallback.querySelector('#snoopy-print-fallback-button');
  const closeButton = fallback.querySelector('#snoopy-print-fallback-close');

  printButton?.addEventListener('click', () => {
    printFrame.contentWindow?.focus();
    printFrame.contentWindow?.print();
    fallback.remove();
    onAfterPrint?.();
  });

  closeButton?.addEventListener('click', () => {
    fallback.remove();
  });
}

// Propósito: imprimir desde un iframe oculto para evitar bloqueos de ventanas emergentes en Chrome/Windows.
export function printMovementLabel(record, options = {}) {
  const previousFrame = document.getElementById('snoopy-receipt-print-frame');

  if (previousFrame) {
    previousFrame.remove();
  }

  const printFrame = document.createElement('iframe');
  printFrame.id = 'snoopy-receipt-print-frame';
  printFrame.title = 'Impresión de comprobante Snoopy Project';
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '1px';
  printFrame.style.height = '1px';
  printFrame.style.border = '0';
  printFrame.style.opacity = '0';
  printFrame.style.pointerEvents = 'none';

  document.body.appendChild(printFrame);

  const printDocument = printFrame.contentDocument || printFrame.contentWindow?.document;

  if (!printDocument) {
    options.onPopupBlocked?.();
    return false;
  }

  let finished = false;

  // Propósito: limpiar recursos temporales sin cerrar ninguna ventana del navegador.
  const finishPrint = () => {
    if (finished) return;
    finished = true;
    options.onAfterPrint?.();

    window.setTimeout(() => {
      printFrame.remove();
    }, 1000);
  };

  printDocument.open();
  printDocument.write(buildPrintableLabelHtml(record));
  printDocument.close();

  if (printFrame.contentWindow) {
    printFrame.contentWindow.onafterprint = finishPrint;
  }

  // Propósito: esperar a que el DOM del iframe y el logotipo estén listos antes de imprimir.
  window.setTimeout(() => {
    waitForPrintableAssets(printDocument)
      .then(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();

        // Propósito: dejar un respaldo manual por si Chrome o el driver bloquean el disparo automático.
        window.setTimeout(() => {
          if (!finished && document.body.contains(printFrame)) {
            showManualPrintFallback(printFrame, finishPrint);
          }
        }, 1200);
      })
      .catch(() => {
        showManualPrintFallback(printFrame, finishPrint);
      });
  }, 250);

  return true;
}
