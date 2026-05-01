// Archivo: src/utils/common.js
// Propósito: centralizar datos demo, localStorage, fechas, folios y exportación a Excel.

// Claves usadas para sesión local
export const STORAGE_KEYS = {
  auth: 'pegasoAuth',
  user: 'pegasoUser',
  token: 'pegasoToken',
  role: 'pegasoRole',
  records: 'pegasoMovimientosRecords',
};

export const DEFAULT_RECORDS = [
  {
    id: 1,
    tipo: 'ingreso',
    fecha: '2026-01-08',
    folio: '26010801',
    nombre: 'Ingreso semana 2',
    descripcion: 'Entrada por compra inicial',
    cantidad: 540.0,
    moneda: 'Pesos',
  },
  {
    id: 2,
    tipo: 'ingreso',
    fecha: '2026-02-03',
    folio: '26020301',
    nombre: 'Ingreso semana 6',
    descripcion: 'Ingreso por recepción parcial',
    cantidad: 220.0,
    moneda: 'Dólares',
  },
  {
    id: 3,
    tipo: 'ingreso',
    fecha: '2026-03-16',
    folio: '26031601',
    nombre: 'Ingreso semana 12',
    descripcion: 'Entrada por compra semanal',
    cantidad: 1200.0,
    moneda: 'Pesos',
  },
  {
    id: 4,
    tipo: 'ingreso',
    fecha: '2026-03-23',
    folio: '26032301',
    nombre: 'Ingreso semana 13',
    descripcion: 'Compra directa de materiales',
    cantidad: 980.0,
    moneda: 'Pesos',
  },
  {
    id: 5,
    tipo: 'ingreso',
    fecha: '2026-03-31',
    folio: '26033101',
    nombre: 'Ingreso semana 14',
    descripcion: 'Regularización de almacén',
    cantidad: 610.0,
    moneda: 'Pesos',
  },
  {
    id: 6,
    tipo: 'ingreso',
    fecha: '2026-04-08',
    folio: '26040801',
    nombre: 'Ingreso semana 15',
    descripcion: 'Entrada por recepción',
    cantidad: 215.0,
    moneda: 'Dólares',
  },
  {
    id: 7,
    tipo: 'ingreso',
    fecha: '2026-04-13',
    folio: '26041301',
    nombre: 'Ingreso semana actual',
    descripcion: 'Entrada inicial de la semana actual',
    cantidad: 1800.0,
    moneda: 'Pesos',
  },
  {
    id: 8,
    tipo: 'ingreso',
    fecha: '2026-04-15',
    folio: '26041501',
    nombre: 'Ingreso complementario',
    descripcion: 'Ajuste positivo semanal',
    cantidad: 320.0,
    moneda: 'Dólares',
  },
  {
    id: 9,
    tipo: 'egreso',
    fecha: '2026-01-15',
    folio: '26011501',
    nombre: 'Egreso semana 3',
    descripcion: 'Salida por operación',
    cantidad: 150.0,
    moneda: 'Pesos',
  },
  {
    id: 10,
    tipo: 'egreso',
    fecha: '2026-03-24',
    folio: '26032401',
    nombre: 'Egreso semana 13',
    descripcion: 'Entrega a producción',
    cantidad: 290.0,
    moneda: 'Dólares',
  },
  {
    id: 11,
    tipo: 'egreso',
    fecha: '2026-04-01',
    folio: '26040101',
    nombre: 'Egreso semana 14',
    descripcion: 'Salida controlada de almacén',
    cantidad: 475.0,
    moneda: 'Pesos',
  },
  {
    id: 12,
    tipo: 'egreso',
    fecha: '2026-04-09',
    folio: '26040901',
    nombre: 'Egreso semana 15',
    descripcion: 'Salida por ajuste',
    cantidad: 125.0,
    moneda: 'Pesos',
  },
  {
    id: 13,
    tipo: 'egreso',
    fecha: '2026-04-14',
    folio: '26041401',
    nombre: 'Egreso semana actual',
    descripcion: 'Salida de inventario actual',
    cantidad: 220.0,
    moneda: 'Pesos',
  },
  {
    id: 14,
    tipo: 'egreso',
    fecha: '2026-04-18',
    folio: '26041801',
    nombre: 'Egreso complementario',
    descripcion: 'Salida por merma controlada',
    cantidad: 95.0,
    moneda: 'Dólares',
  },
  {
    id: 15,
    tipo: 'ingreso',
    fecha: '2025-11-10',
    folio: '25111001',
    nombre: 'Ingreso histórico',
    descripcion: 'Entrada de noviembre 2025',
    cantidad: 700.0,
    moneda: 'Pesos',
  },
  {
    id: 16,
    tipo: 'egreso',
    fecha: '2025-11-12',
    folio: '25111201',
    nombre: 'Egreso histórico',
    descripcion: 'Salida de noviembre 2025',
    cantidad: 340.0,
    moneda: 'Dólares',
  },
];

// Verifica si hay sesión activa
export function isAuthenticated() {
  return (
    localStorage.getItem(STORAGE_KEYS.auth) === '1' &&
    Boolean(localStorage.getItem(STORAGE_KEYS.token))
  );
}

export function setLoginSession(user) {
  localStorage.setItem(STORAGE_KEYS.auth, '1');
  localStorage.setItem(STORAGE_KEYS.user, user);
}

// Obtiene usuario actual
export function getCurrentUser() {
  return localStorage.getItem(STORAGE_KEYS.user) || '';
}

// Cierra sesión
export function logoutSession() {
  localStorage.removeItem(STORAGE_KEYS.auth);
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.role);
}

export function loadRecords() {
  const raw = localStorage.getItem(STORAGE_KEYS.records);

  if (!raw) {
    saveRecords(DEFAULT_RECORDS);
    return structuredClone(DEFAULT_RECORDS);
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : structuredClone(DEFAULT_RECORDS);
  } catch {
    saveRecords(DEFAULT_RECORDS);
    return structuredClone(DEFAULT_RECORDS);
  }
}

export function saveRecords(records) {
  localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(records));
}

export function getNextRecordId(records) {
  if (!records.length) return 1;
  return Math.max(...records.map((item) => Number(item.id) || 0)) + 1;
}

export function getTodayISO() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getShortMonth(monthIndex) {
  const months = [
    'ene.',
    'feb.',
    'mar.',
    'abr.',
    'may.',
    'jun.',
    'jul.',
    'ago.',
    'sep.',
    'oct.',
    'nov.',
    'dic.',
  ];
  return months[monthIndex];
}

export function getISOWeekInfo(dateISO) {
  const date = new Date(`${dateISO}T00:00:00`);
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayOfWeek);
  const isoYear = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7);
  return { year: isoYear, week };
}

export function getCurrentISOWeek() {
  return getISOWeekInfo(getTodayISO());
}

export function getISOWeekStart(year, week) {
  const simple = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = simple.getUTCDay() || 7;
  simple.setUTCDate(simple.getUTCDate() - dayOfWeek + 1);
  const monday = new Date(simple);
  monday.setUTCDate(simple.getUTCDate() + (week - 1) * 7);
  return monday;
}

export function getWeekLabel(year, week) {
  const monday = getISOWeekStart(year, week);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const startDay = String(monday.getUTCDate()).padStart(2, '0');
  const endDay = String(sunday.getUTCDate()).padStart(2, '0');
  return `${week} (${startDay}-${getShortMonth(monday.getUTCMonth())} a ${endDay}-${getShortMonth(sunday.getUTCMonth())})`;
}

export function getMaxAllowedWeekForYear(year, records) {
  const currentWeek = getCurrentISOWeek();

  if (Number(year) === currentWeek.year) {
    return currentWeek.week;
  }

  const weeksWithData = records
    .map((record) => {
      const info = getISOWeekInfo(record.fecha);
      return info.year === Number(year) ? info.week : null;
    })
    .filter(Boolean);

  return weeksWithData.length > 0 ? Math.max(...weeksWithData) : 1;
}

export function formatAmount(value) {
  const number = Number(value || 0);
  return number.toFixed(2);
}

export function generateAutoFolio(dateISO, records) {
  if (!dateISO) return '';
  const [year, month, day] = dateISO.split('-');
  const prefix = `${year.slice(-2)}${month}${day}`;
  const recordsOfDay = records.filter(
    (record) => record.fecha === dateISO && String(record.folio).startsWith(prefix),
  );
  const maxSequence = recordsOfDay.reduce((max, record) => {
    const numeric = parseInt(String(record.folio).slice(prefix.length), 10);
    return !Number.isNaN(numeric) && numeric > max ? numeric : max;
  }, 0);
  return `${prefix}${String(maxSequence + 1).padStart(2, '0')}`;
}

function escapeXml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function exportRowsToExcelXml({ rows, sheetName, fileName, headers, headerColor }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const headerCells = headers
    .map(
      (title) =>
        `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${escapeXml(title)}</Data></Cell>`,
    )
    .join('');
  const bodyRows = safeRows
    .map(
      (row) =>
        `<Row>${row.map((cell) => `<Cell ss:StyleID="BodyStyle"><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join('')}</Row>`,
    )
    .join('');

  const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="HeaderStyle"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#111111"/><Interior ss:Color="${headerColor}" ss:Pattern="Solid"/></Style>
    <Style ss:ID="BodyStyle"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#222222"/></Style>
  </Styles>
  <Worksheet ss:Name="${escapeXml(sheetName)}"><Table>${headers.map(() => '<Column ss:AutoFitWidth="1" ss:Width="120"/>').join('')}<Row>${headerCells}</Row>${bodyRows}</Table></Worksheet>
</Workbook>`;

  const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
