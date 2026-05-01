// Archivo: src/pages/Dashboard.jsx
// Propósito: vista principal de movimientos conectada con Express/PostgreSQL.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';

import {
  exportRowsToExcelXml,
  formatAmount,
  generateAutoFolio,
  getCurrentISOWeek,
  getISOWeekInfo,
  getMaxAllowedWeekForYear,
  getTodayISO,
  getWeekLabel,
  isAuthenticated,
} from '../utils/common.js';

import {
  createMovement,
  getMovements
} from '../services/movementsApi.js';

const modeConfig = {
  ingreso: {
    bodyClass: 'modo-ingreso',
    pillText: 'Ingresos',
    bannerTitle: 'Movimientos de ingreso',
    bannerText: 'Mostrando movimientos de ingreso de la semana seleccionada.',
    previewText: 'Movimiento de ingreso',
    footerText: 'Registro de ingreso',
    icon: 'south_west',
    excelHeaderColor: '#86DFE6'
  },
  egreso: {
    bodyClass: 'modo-egreso',
    pillText: 'Egresos',
    bannerTitle: 'Movimientos de egreso',
    bannerText: 'Mostrando movimientos de egreso de la semana seleccionada.',
    previewText: 'Movimiento de egreso',
    footerText: 'Registro de egreso',
    icon: 'north_east',
    excelHeaderColor: '#F0DC84'
  }
};

function Dashboard() {
  const navigate = useNavigate();
  const labelSheetRef = useRef(null);

  // Registros principales cargados desde PostgreSQL.
  const [records, setRecords] = useState([]);

  // Estados visuales y de operación.
  const [type, setType] = useState('ingreso');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  // Filtros del historial.
  const [period, setPeriod] = useState(String(getCurrentISOWeek().year));
  const [week, setWeek] = useState(String(getCurrentISOWeek().week));
  const [folioSearch, setFolioSearch] = useState('');
  const [appliedFolioSearch, setAppliedFolioSearch] = useState('');

  // Notificación y resaltado de registros nuevos.
  const [toast, setToast] = useState(null);
  const [lastCreatedId, setLastCreatedId] = useState(null);

  // Formulario de registro.
  const [form, setForm] = useState({
    fecha: getTodayISO(),
    nombre: '',
    descripcion: '',
    cantidad: '',
    moneda: ''
  });

  const config = modeConfig[type];
  const previewInfo = getISOWeekInfo(form.fecha || getTodayISO());

  // Folio automático calculado con los movimientos existentes en PostgreSQL.
  const folio = useMemo(() => {
    return generateAutoFolio(form.fecha, records);
  }, [form.fecha, records]);

  // Periodos visibles: año actual y anterior, igual que el proyecto original.
  const years = useMemo(() => {
    const currentYear = getCurrentISOWeek().year;
    return [currentYear - 1, currentYear];
  }, []);

  // Semanas visibles sin mostrar semanas futuras.
  // Semanas visibles sin mostrar semanas futuras.
  // Se calculan según el periodo seleccionado y los registros cargados desde PostgreSQL.
  const weeks = useMemo(() => {
    const maxWeek = getMaxAllowedWeekForYear(Number(period), records);

    return Array.from({ length: maxWeek }, (_, index) => maxWeek - index);
  }, [period, records]);

  // Semana seleccionada segura.
  // No usamos useEffect ni setWeek aquí para evitar errores de React Hooks.
  // Si la semana actual ya no existe en el arreglo, usamos la primera disponible.
  const numericSelectedWeek = Number(week);

  const selectedWeek =
    weeks.includes(numericSelectedWeek)
      ? String(numericSelectedWeek)
      : weeks.length > 0
        ? String(weeks[0])
        : '';

  // Registros visibles en la tabla de historial.
  // Filtra por tipo, periodo, semana seleccionada y búsqueda por folio.
  const filteredRows = useMemo(() => {
    return records.filter((record) => {
      const info = getISOWeekInfo(record.fecha);

      const matchBase =
        record.tipo === type &&
        info.year === Number(period) &&
        info.week === Number(selectedWeek);

      const matchFolio =
        appliedFolioSearch === '' ||
        String(record.folio).toLowerCase().includes(appliedFolioSearch);

      return matchBase && matchFolio;
    });
  }, [records, type, period, selectedWeek, appliedFolioSearch]);

  // Protege la vista y carga movimientos desde la API.
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }

    async function loadMovementsFromApi() {
      try {
        setIsLoading(true);
        setApiError('');

        const data = await getMovements();
        setRecords(data);
      } catch (error) {
        setApiError(error.message);
        setToast({
          title: 'Error',
          text: 'No se pudieron cargar los movimientos desde PostgreSQL.',
          type: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadMovementsFromApi();
  }, [navigate]);

  // Aplica las clases del body para respetar los colores de ingreso/egreso.
  useEffect(() => {
    document.body.classList.remove('modo-ingreso', 'modo-egreso', 'login-page', 'pagina-reportes');
    document.body.classList.add('pagina-dashboard', config.bodyClass);

    return () => {
      document.body.classList.remove('pagina-dashboard', config.bodyClass);
    };
  }, [config.bodyClass]);

  // Oculta el toast automáticamente.
  useEffect(() => {
    if (!toast) return undefined;

    const timeoutId = setTimeout(() => {
      setToast(null);
    }, 2600);

    return () => clearTimeout(timeoutId);
  }, [toast]);

  // Limpia el resaltado de fila después de unos segundos.
  useEffect(() => {
    if (!lastCreatedId) return undefined;

    const timeoutId = setTimeout(() => {
      setLastCreatedId(null);
    }, 1600);

    return () => clearTimeout(timeoutId);
  }, [lastCreatedId]);

  // Actualiza un campo del formulario.
  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  // Limpia el formulario y deja valores base.
  const clearForm = () => {
    setForm({
      fecha: getTodayISO(),
      nombre: '',
      descripcion: '',
      cantidad: '',
      moneda: ''
    });
  };

  // Cambia entre ingresos y egresos desde el menú superior.
  const selectMovementType = (nextType) => {
    setType(nextType);
  };

  // Guarda un movimiento usando el backend Express/PostgreSQL.
  const saveMovement = async () => {
    if (
      !form.fecha ||
      !folio ||
      !form.nombre.trim() ||
      !form.descripcion.trim() ||
      Number(form.cantidad) <= 0 ||
      !form.moneda
    ) {
      setToast({
        title: 'Error',
        text: 'Completa todos los campos y selecciona una moneda.',
        type: 'error'
      });
      return;
    }

    const newRecord = {
      tipo: type,
      fecha: form.fecha,
      folio,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      cantidad: Number(form.cantidad),
      moneda: form.moneda
    };

    try {
      setIsSaving(true);

      const savedRecord = await createMovement(newRecord);

      setRecords((currentRecords) => [savedRecord, ...currentRecords]);
      setLastCreatedId(savedRecord.id);

      const info = getISOWeekInfo(savedRecord.fecha);
      setPeriod(String(info.year));
      setWeek(String(info.week));
      setFolioSearch('');
      setAppliedFolioSearch('');

      setToast({
        title: `${type === 'ingreso' ? 'Ingreso' : 'Egreso'} guardado exitosamente`,
        text: 'El movimiento se guardó correctamente en PostgreSQL.',
        type: 'success'
      });

      clearForm();
    } catch (error) {
      setToast({
        title: 'Error',
        text: error.message,
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Exporta los registros visibles de la semana seleccionada.
  const exportVisibleWeekToExcel = () => {
    if (!filteredRows.length) {
      setToast({
        title: 'Error',
        text: 'No hay registros para exportar en la semana seleccionada.',
        type: 'error'
      });
      return;
    }

    const excelRows = filteredRows.map((record) => {
      const info = getISOWeekInfo(record.fecha);

      return [
        record.fecha,
        getWeekLabel(info.year, info.week),
        record.folio,
        record.nombre,
        record.descripcion,
        formatAmount(record.cantidad),
        record.moneda
      ];
    });

    exportRowsToExcelXml({
      rows: excelRows,
      sheetName: `Semana_${selectedWeek}`,
      fileName: `movimientos_${config.pillText.toLowerCase()}_${period}_semana_${selectedWeek}`,
      headers: ['Fecha', 'Semana', 'Folio', 'Nombre', 'Descripción', 'Cantidad', 'Moneda'],
      headerColor: config.excelHeaderColor
    });

    setToast({
      title: 'Exportación completada',
      text: 'La tabla visible se exportó correctamente.',
      type: 'success'
    });
  };

  // Imprime la vista previa del movimiento.
  // Imprime la vista previa del movimiento con estilos propios.
  // Esto evita que en Vercel se pierda el formato por no encontrar /src/styles/pegaso.css.
  const printMovementPreview = () => {
    if (!labelSheetRef.current) {
      setToast({
        title: 'Error',
        text: 'No se encontró la vista previa para imprimir.',
        type: 'error'
      });
      return;
    }

    // Clona únicamente el ticket visible en pantalla.
    const clone = labelSheetRef.current.cloneNode(true);

    // Usa el logo desde la carpeta public para que funcione en local y producción.
    const logoUrl = new URL('/logo-sinFondo.png', window.location.origin).href;

    // Asegura que las imágenes del ticket usen una ruta válida en producción.
    clone.querySelectorAll('img').forEach((img) => {
      img.setAttribute('src', logoUrl);
    });

    // Abre una ventana nueva para imprimir solo el ticket.
    const printWindow = window.open('', '_blank', 'width=900,height=700');

    if (!printWindow) {
      setToast({
        title: 'Error',
        text: 'El navegador bloqueó la ventana de impresión.',
        type: 'error'
      });
      return;
    }

    // Estilos internos del ticket.
    // Se colocan aquí para que no dependa del CSS compilado por Vite.
    const ticketStyles = `
    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: "Roboto", "Segoe UI", Arial, sans-serif;
      color: #111827;
    }

    body {
      padding: 20px;
    }

    @page {
      size: auto;
      margin: 12mm;
    }

    .label-sheet {
      width: 100%;
      max-width: 760px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #dfdfdf;
      border-radius: 14px;
      min-height: auto;
      padding: 16px;
      box-shadow: none;
    }

    .label-top {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      border-bottom: 1px solid #e7e7e7;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }

    .label-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .label-brand img {
      width: 48px;
      height: 48px;
      object-fit: contain;
    }

    .label-brand h3 {
      font-size: 1rem;
      font-weight: 700;
      color: #111111;
      margin: 0 0 2px 0;
    }

    .label-brand p {
      font-size: 0.9rem;
      color: #666666;
      font-weight: 400;
      margin: 0;
    }

    .label-code-box {
      min-width: 160px;
      background: #111111;
      color: #ffffff;
      border-radius: 12px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .label-mini-title {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.74);
      margin-bottom: 4px;
      font-weight: 400;
    }

    .label-code-box strong {
      font-size: 0.98rem;
      font-weight: 700;
      letter-spacing: 0.4px;
    }

    .label-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .label-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .label-field {
      border: 1px solid #dddddd;
      border-radius: 10px;
      padding: 12px;
      background: #fafafa;
      min-height: 66px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
    }

    .label-field.full {
      grid-column: 1 / -1;
    }

    .field-title {
      font-size: 0.78rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #8b8b8b;
    }

    .label-field span:last-child {
      font-size: 0.95rem;
      font-weight: 500;
      color: #202020;
      word-break: break-word;
    }

    .label-footer {
      margin-top: 16px;
      border-top: 1px solid #e8e8e8;
      padding-top: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .barcode-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .barcode {
      width: 100%;
      max-width: 300px;
      height: 58px;
      border-radius: 4px;
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
      border: 1px solid #d8d8d8;
    }

    .barcode-box span {
      font-size: 0.9rem;
      font-weight: 500;
      letter-spacing: 0.4px;
    }

    .signature-area {
      width: 100%;
      margin-top: 30px;
      padding-top: 22px;
      text-align: center;
    }

    .signature-line {
      width: 72%;
      height: 1px;
      background: #111827;
      margin: 0 auto 8px;
    }

    .signature-label {
      font-size: 12px;
      font-weight: 700;
      color: #111827;
    }

    .signature-note {
      margin-top: 3px;
      font-size: 10px;
      color: #6b7280;
    }

    .print-note {
      text-align: center;
      font-size: 0.82rem;
      color: #777777;
    }

    @media print {
      body {
        padding: 0;
      }

      .label-sheet {
        border-radius: 10px;
      }
    }
  `;

    // Escribe el documento final de impresión.
    printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Impresión de Movimiento</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap" rel="stylesheet" />
        <style>${ticketStyles}</style>
      </head>
      <body>
        ${clone.outerHTML}
      </body>
    </html>
  `);

    printWindow.document.close();

    // Espera a que cargue la ventana y lanza la impresión.
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    };
  };

  return (
    <>
      <Header
        activePage="movimientos"
        movementType={type}
        onMovementTypeChange={selectMovementType}
      />

      <main className="page-wrapper">
        <section className="page-header screenshot-style-header">
          <div>
            <h1>Movimientos</h1>
            <p>Consulta y registra movimientos por semana.</p>
          </div>
        </section>

        <section className="mode-banner">
          <div className="mode-banner-icon">
            <span className="material-icons-outlined">{config.icon}</span>
          </div>

          <div className="mode-banner-content">
            <strong>{config.bannerTitle}</strong>
            <p>{config.bannerText}</p>
          </div>
        </section>

        <section className="main-grid">
          <div className="card form-card">
            <div className="card-header">
              <h2>Formulario de movimiento</h2>
              <span className="mode-pill">{config.pillText}</span>
            </div>

            <form className="label-form" autoComplete="off">
              <div className="form-grid one-column">
                <div className="form-group">
                  <label htmlFor="fechaMovimiento">Fecha</label>
                  <input
                    type="date"
                    id="fechaMovimiento"
                    value={form.fecha}
                    max={getTodayISO()}
                    onChange={(event) => updateForm('fecha', event.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="folio">Folio</label>
                  <input type="text" id="folio" value={folio} readOnly />
                </div>

                <div className="form-group">
                  <label htmlFor="nombre">Nombre</label>
                  <input
                    type="text"
                    id="nombre"
                    placeholder="Nombre del movimiento"
                    value={form.nombre}
                    onChange={(event) => updateForm('nombre', event.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="descripcion">Descripción</label>
                  <textarea
                    id="descripcion"
                    rows="4"
                    placeholder="Describe el movimiento"
                    value={form.descripcion}
                    onChange={(event) => updateForm('descripcion', event.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="cantidad">Cantidad</label>
                  <input
                    type="number"
                    id="cantidad"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.cantidad}
                    onChange={(event) => updateForm('cantidad', event.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="moneda">Moneda *</label>
                  <select
                    id="moneda"
                    required
                    value={form.moneda}
                    onChange={(event) => updateForm('moneda', event.target.value)}
                  >
                    <option value="" disabled>Selecciona una moneda</option>
                    <option value="Pesos">Pesos</option>
                    <option value="Dólares">Dólares</option>
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={clearForm}>
                  <span className="material-icons-outlined">refresh</span>
                  Limpiar
                </button>

                <button
                  type="button"
                  className="btn btn-dark"
                  onClick={saveMovement}
                  disabled={isSaving}
                >
                  <span className="material-icons-outlined">save</span>
                  {isSaving ? 'Guardando...' : 'Guardar'}
                </button>

                <button type="button" className="btn btn-gold" onClick={printMovementPreview}>
                  <span className="material-icons-outlined">print</span>
                  Imprimir
                </button>
              </div>
            </form>
          </div>

          <div className="card preview-card">
            <div className="card-header">
              <h2>Vista previa del movimiento</h2>
              <span className="mode-pill">{config.pillText}</span>
            </div>

            <div className="preview-canvas">
              <div className="label-sheet" ref={labelSheetRef}>
                <div className="label-top">
                  <div className="label-brand">
                    <img src="/logo-fondo.png" alt="alt" />
                    <div>
                      <h3>MoneyTrack</h3>
                      <p>{config.previewText}</p>
                    </div>
                  </div>

                  <div className="label-code-box">
                    <span className="label-mini-title">Folio</span>
                    <strong>{folio || '00000000'}</strong>
                  </div>
                </div>

                <div className="label-body">
                  <div className="label-row">
                    <div className="label-field">
                      <span className="field-title">Fecha</span>
                      <span>{form.fecha || getTodayISO()}</span>
                    </div>

                    <div className="label-field">
                      <span className="field-title">Semana</span>
                      <span>{getWeekLabel(previewInfo.year, previewInfo.week)}</span>
                    </div>
                  </div>

                  <div className="label-row">
                    <div className="label-field full">
                      <span className="field-title">Nombre</span>
                      <span>{form.nombre.trim() || 'Movimiento de muestra'}</span>
                    </div>
                  </div>

                  <div className="label-row">
                    <div className="label-field full">
                      <span className="field-title">Descripción</span>
                      <span>{form.descripcion.trim() || 'Descripción breve del movimiento.'}</span>
                    </div>
                  </div>

                  <div className="label-row">
                    <div className="label-field">
                      <span className="field-title">Cantidad</span>
                      <span>{formatAmount(form.cantidad || 0)}</span>
                    </div>

                    <div className="label-field">
                      <span className="field-title">Moneda</span>
                      <span>{form.moneda || 'Sin seleccionar'}</span>
                    </div>
                  </div>
                </div>

                {/* Pie del ticket con código, firma y nota final */}
                <div className="label-footer">
                  <div className="barcode-box">
                    <div className="barcode"></div>
                    <span>{folio || '00000000'}</span>
                  </div>

                  {/* Espacio físico para firma del responsable */}
                  <div className="signature-area">
                    <div className="signature-line"></div>
                    <div className="signature-label">Firma de recibido</div>
                    <div className="signature-note">Nombre y firma del responsable</div>
                  </div>

                  <div className="print-note">
                    {config.footerText}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="card history-card">
          <div className="card-header">
            <h2>Registros de la semana {selectedWeek}</h2>
            <span className="mode-pill">{config.pillText}</span>
          </div>

          <div className="history-toolbar">
            <div className="history-filter-grid">
              <div className="filter-box filter-small">
                <label htmlFor="periodoSelect">Periodo</label>
                <select
                  id="periodoSelect"
                  className="filter-control"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                >
                  {years.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div className="filter-box filter-large">
                <label htmlFor="semanaSelect">A la semana</label>
                {/* Selector de semana del historial */}
                <select
                  id="semanaSelect"
                  className="filter-control"
                  value={selectedWeek}
                  onChange={(event) => setWeek(event.target.value)}
                >
                  {weeks.map((itemWeek) => (
                    <option key={itemWeek} value={itemWeek}>
                      {getWeekLabel(Number(period), itemWeek)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-box filter-search">
                <label htmlFor="searchFolio">Buscar folio</label>
                <div className="search-inline">
                  <input
                    type="text"
                    id="searchFolio"
                    className="filter-control search-control"
                    placeholder="Buscar folio y Enter"
                    value={folioSearch}
                    onChange={(event) => setFolioSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        setAppliedFolioSearch(folioSearch.trim().toLowerCase());
                      }
                    }}
                  />

                  <button
                    type="button"
                    className="clear-search-btn"
                    aria-label="Limpiar búsqueda"
                    onClick={() => {
                      setFolioSearch('');
                      setAppliedFolioSearch('');
                    }}
                  >
                    <span className="material-icons-outlined">close</span>
                  </button>
                </div>
              </div>

              <div className="filter-box filter-export">
                <label>&nbsp;</label>
                <button type="button" className="btn btn-export" onClick={exportVisibleWeekToExcel}>
                  <span className="material-icons-outlined">download</span>
                  Exportar
                </button>
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Semana</th>
                  <th>Folio</th>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Cantidad</th>
                  <th>Moneda</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '18px' }}>
                      Cargando movimientos desde PostgreSQL...
                    </td>
                  </tr>
                ) : apiError ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '18px' }}>
                      {apiError}
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '18px' }}>
                      No se encontraron registros para los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((record) => {
                    const info = getISOWeekInfo(record.fecha);

                    return (
                      <tr
                        key={record.id}
                        className={record.id === lastCreatedId ? 'row-highlight' : ''}
                      >
                        <td>{record.fecha}</td>
                        <td>{getWeekLabel(info.year, info.week)}</td>
                        <td>{record.folio}</td>
                        <td>{record.nombre}</td>
                        <td>{record.descripcion}</td>
                        <td>{formatAmount(record.cantidad)}</td>
                        <td>{record.moneda}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {toast && (
        <div className={`toast-message ${toast.type} show`}>
          <div className="toast-icon">
            <span className="material-icons-outlined">
              {toast.type === 'success' ? 'check_circle' : 'error'}
            </span>
          </div>

          <div className="toast-content">
            <div className="toast-title">{toast.title}</div>
            <div className="toast-text">{toast.text}</div>
          </div>

          <button
            type="button"
            className="toast-close"
            onClick={() => setToast(null)}
            aria-label="Cerrar notificación"
          >
            <span className="material-icons-outlined">close</span>
          </button>

          <div className="toast-progress animate"></div>
        </div>
      )}
    </>
  );
}

export default Dashboard;
