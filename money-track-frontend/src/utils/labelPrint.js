// Archivo: src/utils/labelPrint.js
// Propósito: centralizar la impresión de etiquetas para que Movimientos y Reportes usen exactamente el mismo formato.

import { formatShortDate, getISOWeekInfo } from './dates.js';
import { getAmountForCurrencyColumn, isDollarCurrency } from './money.js';

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
  const dollarAmount = getAmountForCurrencyColumn(safeRecord, 'Dólares');
  const pesoAmount = getAmountForCurrencyColumn(safeRecord, 'Pesos');
  const isDollar = isDollarCurrency(safeRecord.moneda);

  return {
    folio: safeRecord.folio || '00000000',
    fecha: formatShortDate(safeRecord.fecha),
    semana: info.week,
    nombre: safeRecord.nombre || 'Movimiento de muestra',
    concepto: safeRecord.descripcion || 'Descripción breve del movimiento.',
    monto: isDollar ? dollarAmount : pesoAmount,
    moneda: isDollar ? 'Dólares' : 'Pesos',
    footerText: getFooterText(safeRecord),
  };
}

// Propósito: generar el HTML imprimible con un diseño de recibo limpio, compacto y con jerarquía visual clara.
function buildPrintableLabelHtml(record) {
  const data = buildLabelData(record);
  const logoUrl = `${window.location.origin}/snoopy-laptop-removebg-preview.png`;

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Movimiento ${escapeHtml(data.folio)}</title>
        <style>
          @page {
            size: auto;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            width: 100%;
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111111;
            font-family: Arial, Helvetica, sans-serif;
          }

          body {
            display: block;
          }

          .print-page {
            width: 100%;
            margin: 0;
            padding: 4mm 0 3mm;
            background: #ffffff;
            text-align: center;
          }

          .receipt {
            width: 80mm;
            max-width: 80mm;
            margin: 0 auto;
            padding: 4mm 4mm 3mm;
            background: #ffffff;
            color: #111111;
            text-align: left;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .receipt-card {
            width: 100%;
            border: 1px solid #222222;
            border-radius: 9px;
            padding: 4mm 4mm 3.5mm;
          }

          .receipt-header {
            padding-bottom: 7px;
            border-bottom: 1px solid #d4d4d4;
          }

          .brand-main {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 8px;
            min-height: 31px;
          }

          .brand-logo {
            width: 28px;
            height: 28px;
            object-fit: contain;
            display: block;
            flex: 0 0 auto;
          }

          .brand-copy {
            display: flex;
            min-width: 0;
            flex-direction: column;
            justify-content: center;
            line-height: 1.15;
          }

          .brand-name {
            display: block;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.01em;
          }

          .brand-subtitle {
            display: block;
            margin-top: 2px;
            font-size: 8px;
            font-weight: 400;
            letter-spacing: 0.03em;
          }

          .document-title {
            margin-top: 6px;
            padding: 4px 6px;
            border: 1px solid #d7d7d7;
            border-radius: 999px;
            background: #f7f7f7;
            text-align: center;
            font-size: 7.5px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .receipt-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            margin-top: 8px;
          }

          .meta-box {
            min-height: 34px;
            border: 1px solid #d2d2d2;
            border-radius: 8px;
            padding: 6px;
            text-align: center;
          }

          .meta-box small {
            display: block;
            margin-bottom: 3px;
            font-size: 7px;
            font-weight: 700;
            letter-spacing: 0.10em;
            text-transform: uppercase;
          }

          .meta-box span:last-child {
            display: block;
            font-size: 12px;
            font-weight: 400;
            line-height: 1.15;
            word-break: break-word;
          }

          .status {
            margin: 8px 0 7px;
            padding: 5px 8px;
            border-radius: 999px;
            border: 1px solid #d2d2d2;
            text-align: center;
            font-size: 8px;
            font-weight: 500;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .amount-box {
            margin: 0 0 8px;
            padding: 8px 8px 7px;
            border-radius: 10px;
            background: #f5f5f5;
            border: 1px solid #d2d2d2;
            text-align: center;
          }

          .amount-label {
            display: block;
            margin-bottom: 4px;
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 0.11em;
            text-transform: uppercase;
          }

          .amount-value {
            display: block;
            font-size: 19px;
            line-height: 1.05;
            font-weight: 400;
          }

          .amount-currency {
            display: block;
            margin-top: 3px;
            font-size: 9px;
            font-weight: 500;
          }

          .details {
            display: flex;
            flex-direction: column;
            gap: 5px;
          }

          .detail-row {
            border-bottom: 1px dotted #6b7280;
            padding-bottom: 5px;
            text-align: center;
          }

          .detail-row:last-child {
            border-bottom: none;
          }

          .detail-label {
            display: block;
            margin-bottom: 2px;
            font-size: 7px;
            font-weight: 700;
            letter-spacing: 0.10em;
            text-transform: uppercase;
          }

          .detail-value {
            display: block;
            font-size: 10px;
            line-height: 1.25;
            font-weight: 400;
            word-break: break-word;
          }

          .verification {
            margin-top: 8px;
            padding-top: 7px;
            border-top: 1px solid #d4d4d4;
            text-align: center;
          }

          .barcode {
            width: 100%;
            height: 22px;
            border: 1px solid #222222;
            border-radius: 5px;
            background: repeating-linear-gradient(
              90deg,
              #111111 0px,
              #111111 2px,
              #ffffff 2px,
              #ffffff 4px,
              #111111 4px,
              #111111 7px,
              #ffffff 7px,
              #ffffff 9px
            );
          }

          .barcode-number {
            display: block;
            margin-top: 4px;
            font-size: 8px;
            font-weight: 500;
            letter-spacing: 0.08em;
          }

          .signature {
            margin-top: 12px;
            text-align: center;
          }

          .signature-line {
            width: 68%;
            height: 1px;
            background: #222222;
            margin: 0 auto 5px;
          }

          .signature strong {
            display: block;
            font-size: 9px;
            font-weight: 600;
          }

          .signature span {
            display: block;
            margin-top: 2px;
            font-size: 7px;
          }

          .receipt-note {
            margin-top: 7px;
            text-align: center;
            font-size: 7px;
            font-weight: 400;
            letter-spacing: 0.03em;
          }

          @media print {
            html,
            body {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              background: #ffffff !important;
            }

            .print-page {
              width: 100% !important;
              margin: 0 !important;
              padding: 4mm 0 3mm !important;
              text-align: center !important;
            }

            .receipt {
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 auto !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        </style>
      </head>
      <body>
        <main class="print-page">
          <section class="receipt">
            <div class="receipt-card">
              <header class="receipt-header">
                <div class="brand-main">
                  <img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="Snoopy Project" />
                  <div class="brand-copy">
                    <span class="brand-name">Snoopy Project</span>
                    <span class="brand-subtitle">Control de ingresos y egresos</span>
                  </div>
                </div>

                <div class="document-title">Comprobante de movimiento</div>
              </header>

              <div class="receipt-meta">
                <div class="meta-box">
                  <small>Folio</small>
                  <span>${escapeHtml(data.folio)}</span>
                </div>

                <div class="meta-box">
                  <small>Semana</small>
                  <span>${escapeHtml(data.semana)}</span>
                </div>
              </div>

              <div class="status">${escapeHtml(data.footerText)}</div>

              <div class="amount-box">
                <span class="amount-label">Monto</span>
                <span class="amount-value">${escapeHtml(data.monto)}</span>
                <span class="amount-currency">${escapeHtml(data.moneda)}</span>
              </div>

              <div class="details">
                <div class="detail-row">
                  <span class="detail-label">Fecha</span>
                  <span class="detail-value">${escapeHtml(data.fecha)}</span>
                </div>

                <div class="detail-row">
                  <span class="detail-label">Nombre</span>
                  <span class="detail-value">${escapeHtml(data.nombre)}</span>
                </div>

                <div class="detail-row">
                  <span class="detail-label">Concepto</span>
                  <span class="detail-value">${escapeHtml(data.concepto)}</span>
                </div>
              </div>

              <div class="verification">
                <div class="barcode"></div>
                <span class="barcode-number">${escapeHtml(data.folio)}</span>
              </div>

              <div class="signature">
                <div class="signature-line"></div>
                <strong>Firma de recibido</strong>
                <span>Nombre y firma del responsable</span>
              </div>

              <div class="receipt-note">Documento generado por Snoopy Project</div>
            </div>
          </section>
        </main>
      </body>
    </html>
  `;
}

// Propósito: abrir una ventana limpia de impresión para evitar hojas extra al imprimir desde Movimientos o Reportes.
export function printMovementLabel(record, options = {}) {
  const printWindow = window.open('', '_blank', 'width=360,height=720');

  if (!printWindow) {
    options.onPopupBlocked?.();
    return false;
  }

  let finished = false;

  // Propósito: ejecutar una sola vez la acción posterior a imprimir.
  const finishPrint = () => {
    if (finished) return;
    finished = true;
    options.onAfterPrint?.();
    printWindow.close();
  };

  printWindow.document.open();
  printWindow.document.write(buildPrintableLabelHtml(record));
  printWindow.document.close();

  printWindow.onafterprint = finishPrint;

  // Propósito: esperar un momento para que cargue el logotipo antes de mandar la impresión.
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();

    // Propósito: cerrar la ventana aunque el navegador no dispare onafterprint.
    window.setTimeout(finishPrint, 700);
  }, 350);

  return true;
}
