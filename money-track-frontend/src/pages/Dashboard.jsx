import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

const CURRENCY_OPTIONS = [
  {
    value: 'Dolares',
    label: 'Dólares',
    symbol: '$',
    helper: 'Dólares'
  },
  {
    value: 'Pesos',
    label: 'Pesos',
    symbol: '$',
    helper: 'Moneda nacional'
  }
];

// Normaliza el nombre de moneda para comparar pesos y dólares sin depender de acentos.
function normalizeCurrencyName(currency) {
  return String(currency || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Revisa si una opción de moneda debe mostrarse marcada.
function isCurrencySelected(currentCurrency, optionCurrency) {
  return normalizeCurrencyName(currentCurrency) === normalizeCurrencyName(optionCurrency);
}

// Da formato a los importes usando únicamente el símbolo $ para ambas monedas.
function formatMoneyByCurrency(amount) {
  return `$${formatAmount(amount || 0)}`;
}

// Identifica si el movimiento pertenece a pesos o dólares para separarlo en columnas.
function isDollarCurrency(currency) {
  const normalizedCurrency = normalizeCurrencyName(currency);
  return normalizedCurrency.includes('dolar') || normalizedCurrency.includes('usd');
}

// Muestra el monto solo en la columna de la moneda correspondiente.
function getAmountForCurrencyColumn(record, targetCurrency) {
  const shouldShowAmount =
    targetCurrency === 'Dólares'
      ? isDollarCurrency(record.moneda)
      : !isDollarCurrency(record.moneda);

  return shouldShowAmount && Number(record.cantidad || 0) > 0
    ? formatMoneyByCurrency(record.cantidad, targetCurrency)
    : '--';
}

// Convierte una fecha YYYY-MM-DD a formato corto, por ejemplo 04/may.
function formatShortDate(dateValue) {
  if (!dateValue) return '';

  const [year, month, day] = String(dateValue).split('-');

  const monthNames = {
    '01': 'ene',
    '02': 'feb',
    '03': 'mar',
    '04': 'abr',
    '05': 'may',
    '06': 'jun',
    '07': 'jul',
    '08': 'ago',
    '09': 'sep',
    '10': 'oct',
    '11': 'nov',
    '12': 'dic'
  };

  if (!year || !month || !day || !monthNames[month]) {
    return dateValue;
  }

  return `${day}/${monthNames[month]}`;
}

function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const labelSheetRef = useRef(null);

  // Registros principales cargados desde PostgreSQL.
  const [records, setRecords] = useState([]);

  // Estados visuales y de operación.
  const initialMovementType = searchParams.get('tipo') === 'egreso' ? 'egreso' : 'ingreso';
  const [type, setType] = useState(initialMovementType);
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

  // Calcula el total visible de la semana seleccionada, separado por dólares y pesos.
  const tableTotals = useMemo(() => {
    return filteredRows.reduce(
      (accumulator, record) => {
        const amount = Number(record.cantidad || 0);

        if (isDollarCurrency(record.moneda)) {
          accumulator.dolares += amount;
        } else {
          accumulator.pesos += amount;
        }

        return accumulator;
      },
      {
        dolares: 0,
        pesos: 0
      }
    );
  }, [filteredRows]);

  // Muestra importes de totales; si son cero, muestra --.
  const renderTotalAmount = (amount) => {
    return Number(amount || 0) > 0 ? formatMoneyByCurrency(amount) : '--';
  };

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
          title: 'Aviso',
          text: 'No se pudieron cargar los movimientos. Intenta nuevamente.',
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
        title: 'Aviso',
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
        text: 'Movimiento guardado.',
        type: 'success'
      });

      // Propósito: abrir la ventana de impresión automáticamente después de guardar.
      // Se limpia el formulario hasta que la impresión se haya enviado o cerrado.
      window.setTimeout(() => {
        window.print();
        clearForm();
      }, 250);
    } catch (error) {
      setToast({
        title: 'Aviso',
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
        title: 'Aviso',
        text: 'No hay movimientos para exportar en la semana seleccionada.',
        type: 'error'
      });
      return;
    }

    const excelRows = filteredRows.map((record) => {
      const info = getISOWeekInfo(record.fecha);

      return [
        info.week,
        record.folio,
        formatShortDate(record.fecha),
        record.nombre,
        record.descripcion,
        isDollarCurrency(record.moneda) ? formatMoneyByCurrency(record.cantidad, 'Dólares') : '',
        isDollarCurrency(record.moneda) ? '' : formatMoneyByCurrency(record.cantidad, 'Pesos')
      ];
    });

    exportRowsToExcelXml({
      rows: excelRows,
      sheetName: `Semana_${selectedWeek}`,
      fileName: `movimientos_${config.pillText.toLowerCase()}_${period}_semana_${selectedWeek}`,
      headers: ['Sem', 'Folio', 'Fecha', 'Nombre', 'Concepto', 'Dólares', 'Pesos'],
      headerColor: config.excelHeaderColor
    });

    setToast({
      title: 'Exportación completada',
      text: 'Tabla exportada.',
      type: 'success'
    });
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

                <div className="form-group currency-action-group">
                  <label>Moneda *</label>

                  <div className="currency-choice-group dashboard-currency-row" role="radiogroup" aria-label="Seleccionar moneda">
                    {CURRENCY_OPTIONS.map((currency) => (
                      <button
                        key={currency.value}
                        type="button"
                        className={`currency-choice compact ${isCurrencySelected(form.moneda, currency.value) ? 'selected' : ''}`}
                        onClick={() => updateForm('moneda', currency.value)}
                        aria-pressed={isCurrencySelected(form.moneda, currency.value)}
                      >
                        <span className="currency-choice-symbol">{currency.symbol}</span>
                        <span className="currency-choice-text">
                          <strong>{currency.label}</strong>
                          <small>{currency.helper}</small>
                        </span>
                        <span className="material-icons-outlined currency-choice-check">check_circle</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-actions dashboard-form-actions">
                  <button type="button" className="btn btn-light" onClick={clearForm}>
                    <span className="material-icons-outlined">cleaning_services</span>
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
                </div>
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
                    <img src="/snoopy-laptop-removebg-preview.png" alt="alt" />
                    <div>
                      <h3>MoneyTrack</h3>
                      <p>Comprobante de movimiento</p>
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
                      <span>{formatShortDate(form.fecha || getTodayISO())}</span>
                    </div>

                    <div className="label-field">
                      <span className="field-title">Semana</span>
                      <span>{previewInfo.week}</span>
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
                      <span className="field-title">Concepto</span>
                      <span>{form.descripcion.trim() || 'Descripción breve del movimiento.'}</span>
                    </div>
                  </div>

                  <div className="label-row">
                    <div className="label-field">
                      <span className="field-title">Monto</span>
                      <span>{formatMoneyByCurrency(form.cantidad || 0, form.moneda)}</span>
                    </div>

                    <div className="label-field">
                      <span className="field-title">Moneda</span>
                      <span>{isDollarCurrency(form.moneda) ? 'Dólares' : form.moneda || 'Sin seleccionar'}</span>
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
                  <th>Sem</th>
                  <th>Folio</th>
                  <th>Fecha</th>
                  <th>Nombre</th>
                  <th>Concepto</th>
                  <th>Dólares</th>
                  <th>Pesos</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '18px' }}>
                      Cargando movimientos...
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
                        <td>{info.week}</td>
                        <td>{record.folio}</td>
                        <td>{formatShortDate(record.fecha)}</td>
                        <td>{record.nombre}</td>
                        <td className="concept-cell">{record.descripcion}</td>
                        <td className="money-cell">{getAmountForCurrencyColumn(record, 'Dólares')}</td>
                        <td className="money-cell">{getAmountForCurrencyColumn(record, 'Pesos')}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {!isLoading && !apiError && filteredRows.length > 0 && (
                <tfoot>
                  <tr className="history-total-row">
                    <td colSpan="5" className="total-week-label">Total de la semana</td>
                    <td className="money-cell">{renderTotalAmount(tableTotals.dolares)}</td>
                    <td className="money-cell">{renderTotalAmount(tableTotals.pesos)}</td>
                  </tr>
                </tfoot>
              )}
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
