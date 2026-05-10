// Archivo: src/pages/Reports.jsx
// Propósito: vista reutilizable para reportes de ingresos, egresos o cancelados.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Header from '../components/Header.jsx';
import {
  deleteMovement,
  getMovements,
  updateMovement,
} from '../services/movementsApi.js';

import {
  exportRowsToExcelXml,
  formatAmount,
  getCurrentISOWeek,
  getISOWeekInfo,
  getMaxAllowedWeekForYear,
  getWeekLabel,
  isAuthenticated
} from '../utils/common.js';


const CURRENCY_OPTIONS = [
  {
    value: 'Pesos',
    label: 'Pesos',
    symbol: '$',
    helper: 'MXN'
  },
  {
    value: 'Dolares',
    label: 'Dólares',
    symbol: 'US$',
    helper: 'USD'
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

// Da formato a los importes usando el símbolo correcto según la moneda seleccionada.
function formatMoneyByCurrency(amount, currency) {
  const normalizedCurrency = normalizeCurrencyName(currency);

  const symbol = normalizedCurrency.includes('dolar') || normalizedCurrency.includes('usd') ? 'US$' : '$';
  return `${symbol}${formatAmount(amount || 0)}`;
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

  return shouldShowAmount ? formatMoneyByCurrency(record.cantidad, targetCurrency) : '—';
}

const REPORT_SECTIONS = {
  ingreso: {
    title: 'Reporte de Ingresos',
    plural: 'Ingresos',
    singular: 'ingreso',
    description: 'Consulta, modifica, cancela y exporta únicamente los movimientos de ingreso.',
    icon: 'south_west',
    headerColor: '#86DFE6',
    fileName: 'reporte_ingresos',
    sheetName: 'Ingresos'
  },
  egreso: {
    title: 'Reporte de Egresos',
    plural: 'Egresos',
    singular: 'egreso',
    description: 'Consulta, modifica, cancela y exporta únicamente los movimientos de egreso.',
    icon: 'north_east',
    headerColor: '#F0DC84',
    fileName: 'reporte_egresos',
    sheetName: 'Egresos'
  },
  cancelado: {
    title: 'Reporte de Cancelados',
    plural: 'Cancelados',
    singular: 'cancelado',
    description: 'Consulta los movimientos cancelados. Se conservan para visibilidad, pero no cuentan en saldos.',
    icon: 'block',
    headerColor: '#FCA5A5',
    fileName: 'reporte_cancelados',
    sheetName: 'Cancelados'
  }
};

function getSafeReportType(value) {
  if (value === 'egreso' || value === 'cancelado') return value;
  return 'ingreso';
}

// Propósito: convertir una fecha YYYY-MM-DD a formato corto día/mes, por ejemplo 04/may.
const formatShortDate = (dateValue) => {
  if (!dateValue) return '';

  // Propósito: separar la fecha manualmente para evitar desfases por zona horaria.
  const [year, month, day] = String(dateValue).split('-');

  // Propósito: nombres cortos de los meses en español.
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
    '12': 'dic',
  };

  // Propósito: si la fecha no viene en formato correcto, regresar el valor original.
  if (!year || !month || !day || !monthNames[month]) {
    return dateValue;
  }

  return `${day}/${monthNames[month]}`;
};

function Reports({ reportType = 'ingreso' }) {
  const navigate = useNavigate();

  // Tipo de reporte que viene desde la ruta: /reports/ingresos o /reports/egresos.
  const activeReportType = getSafeReportType(reportType);

  // Registros principales cargados desde PostgreSQL.
  const [records, setRecords] = useState([]);

  // Estados de carga, errores y notificaciones.
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [apiError, setApiError] = useState('');
  const [toast, setToast] = useState(null);

  // Estado del modal de edición.
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    tipo: 'ingreso',
    fecha: '',
    folio: '',
    nombre: '',
    descripcion: '',
    cantidad: '',
    moneda: ''
  });

  // Filtros de reportes.
  const [period, setPeriod] = useState(String(getCurrentISOWeek().year));
  const [week, setWeek] = useState('todas');
  const [date, setDate] = useState('');
  const [folio, setFolio] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('todos');
  const [amount, setAmount] = useState('');

  // Filtros aplicados al presionar Buscar.
  const [appliedFilters, setAppliedFilters] = useState({
    period: String(getCurrentISOWeek().year),
    week: 'todas',
    date: '',
    folio: '',
    name: '',
    description: '',
    currency: 'todos',
    amount: ''
  });

  const activeSection = REPORT_SECTIONS[activeReportType];


  // Periodos visibles: año actual y anterior.
  const years = useMemo(() => {
    const currentYear = getCurrentISOWeek().year;
    return [currentYear - 1, currentYear];
  }, []);

  // Semanas visibles para el periodo seleccionado.
  const weeks = useMemo(() => {
    const maxWeek = getMaxAllowedWeekForYear(Number(period), records);
    return Array.from({ length: maxWeek }, (_, index) => maxWeek - index);
  }, [period, records]);

  // Semana válida sin usar setState dentro de useEffect.
  const selectedReportWeek =
    week === 'todas' || weeks.includes(Number(week))
      ? week
      : 'todas';

  // Registros visibles en la tabla según sección activa y filtros aplicados.
  const filteredRows = useMemo(() => {
    return records.filter((record) => {
      const info = getISOWeekInfo(record.fecha);
      const filterYear = Number(appliedFilters.period);
      const filterWeek = appliedFilters.week;
      const filterDate = appliedFilters.date.trim();
      const filterFolio = appliedFilters.folio.trim().toLowerCase();
      const filterName = appliedFilters.name.trim().toLowerCase();
      const filterDescription = appliedFilters.description.trim().toLowerCase();
      const filterCurrency = appliedFilters.currency;
      const filterAmount = appliedFilters.amount.trim();

      // Propósito: conservar visible una fila recién cancelada dentro del apartado donde estaba.
      const tipoParaFiltrar =
        record.tipo === 'cancelado' && record.tipoVistaOriginal
          ? record.tipoVistaOriginal
          : record.tipo;

      // Propósito: en reportes de cancelados, mostrar solo cancelados.
      if (activeReportType === 'cancelado' && record.tipo !== 'cancelado') {
        return false;
      }

      // Propósito: en reportes de ingresos/egresos, permitir que una fila cancelada siga visible si nació en ese apartado.
      if (activeReportType !== 'cancelado' && tipoParaFiltrar !== activeReportType) {
        return false;
      }
      if (info.year !== filterYear) return false;

      if (filterWeek !== 'todas' && info.week !== Number(filterWeek)) {
        return false;
      }

      if (filterDate !== '' && record.fecha !== filterDate) return false;

      if (
        filterFolio !== '' &&
        !String(record.folio).toLowerCase().includes(filterFolio)
      ) {
        return false;
      }

      if (
        filterName !== '' &&
        !String(record.nombre).toLowerCase().includes(filterName)
      ) {
        return false;
      }

      if (
        filterDescription !== '' &&
        !String(record.descripcion).toLowerCase().includes(filterDescription)
      ) {
        return false;
      }

      if (filterCurrency !== 'todos' && normalizeCurrencyName(record.moneda) !== normalizeCurrencyName(filterCurrency)) {
        return false;
      }

      if (filterAmount !== '' && Number(record.cantidad) !== Number(filterAmount)) {
        return false;
      }

      return true;
    });
  }, [records, appliedFilters, activeReportType]);

  // Protege la vista y carga los reportes desde la API.
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }

    async function loadReportsFromApi() {
      try {
        setIsLoading(true);
        setApiError('');

        const data = await getMovements();
        setRecords(data);
      } catch (error) {
        setApiError(error.message);
        setToast({
          title: 'Error',
          text: 'No se pudieron cargar los reportes desde PostgreSQL.',
          type: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadReportsFromApi();
  }, [navigate]);

  // Aplica clases generales del body y cambia el color base según la sección activa.
  useEffect(() => {
    document.body.classList.remove('login-page', 'modo-ingreso', 'modo-egreso', 'modo-cancelado');
    document.body.classList.add(
      'pagina-dashboard',
      'pagina-reportes',
      activeReportType === 'egreso' ? 'modo-egreso' : activeReportType === 'cancelado' ? 'modo-cancelado' : 'modo-ingreso'
    );

    return () => {
      document.body.classList.remove(
        'pagina-dashboard',
        'pagina-reportes',
        'modo-ingreso',
        'modo-egreso',
        'modo-cancelado'
      );
    };
  }, [activeReportType]);

  // Oculta el toast automáticamente.
  useEffect(() => {
    if (!toast) return undefined;

    const timeoutId = setTimeout(() => {
      setToast(null);
    }, 2600);

    return () => clearTimeout(timeoutId);
  }, [toast]);


  // Actualiza un campo del formulario de edición.
  const updateEditForm = (field, value) => {
    setEditForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  // Abre el modal cargando los datos del movimiento seleccionado.
  const openEditModal = (record) => {
    setEditingRecord(record);
    setEditForm({
      tipo: record.tipo,
      fecha: record.fecha,
      folio: record.folio,
      nombre: record.nombre,
      descripcion: record.descripcion,
      cantidad: String(record.cantidad),
      moneda: record.moneda
    });
  };

  // Cierra el modal de edición sin modificar el registro.
  const closeEditModal = () => {
    if (isUpdating) return;

    setEditingRecord(null);
    setEditForm({
      tipo: 'ingreso',
      fecha: '',
      folio: '',
      nombre: '',
      descripcion: '',
      cantidad: '',
      moneda: ''
    });
  };

  // Guarda la edición del movimiento seleccionado.
  const saveEditedMovement = async (event) => {
    event.preventDefault();

    if (
      !editForm.tipo ||
      !editForm.fecha ||
      !editForm.folio.trim() ||
      !editForm.nombre.trim() ||
      !editForm.descripcion.trim() ||
      Number(editForm.cantidad) <= 0 ||
      !editForm.moneda
    ) {
      setToast({
        title: 'Error',
        text: 'Completa todos los campos antes de guardar la modificación.',
        type: 'error'
      });
      return;
    }

    if (!editingRecord) return;

    const updatedPayload = {
      tipo: editForm.tipo,
      fecha: editForm.fecha,
      folio: editForm.folio.trim(),
      nombre: editForm.nombre.trim(),
      descripcion: editForm.descripcion.trim(),
      cantidad: Number(editForm.cantidad),
      moneda: editForm.moneda
    };

    try {
      setIsUpdating(true);

      const updatedRecord = await updateMovement(editingRecord.id, updatedPayload);

      // Reemplaza en pantalla el registro actualizado sin recargar toda la página.
      setRecords((currentRecords) =>
        currentRecords.map((record) =>
          record.id === updatedRecord.id ? updatedRecord : record
        )
      );

      setToast({
        title: 'Movimiento actualizado',
        text: 'Los cambios se guardaron correctamente. Si cambiaste el tipo, aparecerá en su apartado correspondiente.',
        type: 'success'
      });

      closeEditModal();
    } catch (error) {
      setToast({
        title: 'Error',
        text: error.message,
        type: 'error'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Propósito: cancelar el movimiento seleccionado sin eliminarlo visualmente de la tabla actual.
  const removeMovement = async (record) => {
    const confirmed = window.confirm(
      `¿Seguro que deseas cancelar el movimiento con folio ${record.folio}? Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    try {
      // Propósito: bloquear únicamente el botón de la fila actual.
      setDeletingId(record.id);

      // Propósito: mandar al backend la cancelación lógica del movimiento.
      const canceledRecord = await deleteMovement(record.id);

      // Propósito: actualizar la fila como cancelada, pero conservar el apartado original en pantalla.
      setRecords((currentRecords) =>
        currentRecords.map((currentRecord) =>
          currentRecord.id === record.id
            ? {
              ...currentRecord,
              ...canceledRecord,
              tipo: 'cancelado',
              tipoVistaOriginal: currentRecord.tipo,
            }
            : currentRecord
        )
      );

      setToast({
        title: 'Movimiento cancelado',
        text: 'El registro se marcó como cancelado y permanece visible en la tabla.',
        type: 'success'
      });
    } catch (error) {
      setToast({
        title: 'Error',
        text: error.message,
        type: 'error'
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Aplica los filtros actuales al listado.
  const applyFilters = () => {
    setAppliedFilters({
      period,
      week: selectedReportWeek,
      date,
      folio,
      name,
      description,
      currency,
      amount
    });
  };

  // Limpia los filtros y vuelve a los valores base sin cambiar de apartado.
  const clearFilters = () => {
    const currentYear = String(getCurrentISOWeek().year);

    setPeriod(currentYear);
    setWeek('todas');
    setDate('');
    setFolio('');
    setName('');
    setDescription('');
    setCurrency('todos');
    setAmount('');

    setAppliedFilters({
      period: currentYear,
      week: 'todas',
      date: '',
      folio: '',
      name: '',
      description: '',
      currency: 'todos',
      amount: ''
    });
  };

  // Exporta el reporte filtrado actual de la sección activa.
  const exportReportTable = () => {
    if (!filteredRows.length) {
      setToast({
        title: 'Error',
        text: `No hay registros de ${activeSection.plural.toLowerCase()} para exportar con los filtros actuales.`,
        type: 'error'
      });
      return;
    }

    // Propósito: preparar las filas para exportar el reporte actual a Excel con el nuevo orden de columnas.
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
      sheetName: activeSection.sheetName,
      fileName: activeSection.fileName,
      // Propósito: encabezados del Excel con nombres más cortos y entendibles.
      headers: [
        'Sem',
        'Folio',
        'Fecha',
        'Nombre',
        'Concepto',
        'Dólares',
        'Pesos'
      ],
      headerColor: activeSection.headerColor
    });

    setToast({
      title: 'Exportación completada',
      text: `El reporte de ${activeSection.plural.toLowerCase()} se exportó correctamente.`,
      type: 'success'
    });
  };

  return (
    <>
      <Header activePage="reportes" reportType={activeReportType} />

      <main className="page-wrapper">
        <section className="page-header screenshot-style-header">
          <div>
            <h1>{activeSection.title}</h1>
            <p>{activeSection.description}</p>
          </div>
        </section>

        <section className="card reports-card">
          <div className="card-header reports-header-row">
            <div>
              <h2>Detalle de {activeSection.plural}</h2>
              <p className="report-section-description">Solo se muestran movimientos de tipo {activeSection.singular}.</p>
            </div>

            <div className="reports-header-actions">
              <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                <span className="material-icons-outlined">refresh</span>
                Limpiar
              </button>

              <button type="button" className="btn btn-export" onClick={exportReportTable}>
                <span className="material-icons-outlined">download</span>
                Exportar
              </button>
            </div>
          </div>

          <div className="reports-filters-strip reports-filters-separated">
            <div className="filter-box">
              <label htmlFor="reportPeriodo">Periodo</label>
              <select
                id="reportPeriodo"
                className="filter-control"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-box">
              <label htmlFor="reportSemana">Semana</label>
              <select
                id="reportSemana"
                className="filter-control"
                value={selectedReportWeek}
                onChange={(event) => setWeek(event.target.value)}
              >
                <option value="todas">Todas</option>

                {weeks.map((itemWeek) => (
                  <option key={itemWeek} value={String(itemWeek)}>
                    {getWeekLabel(Number(period), itemWeek)}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-box">
              <label htmlFor="reportFecha">Fecha</label>
              <input
                type="date"
                id="reportFecha"
                className="filter-control"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>

            <div className="filter-box">
              <label htmlFor="reportFolio">Folio</label>
              <input
                type="text"
                id="reportFolio"
                className="filter-control"
                placeholder="Ej. 26041301"
                value={folio}
                onChange={(event) => setFolio(event.target.value)}
              />
            </div>

            <div className="filter-box">
              <label htmlFor="reportNombre">Nombre</label>
              <input
                type="text"
                id="reportNombre"
                className="filter-control"
                placeholder="Buscar nombre"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="filter-box filter-wide">
              <label htmlFor="reportDescripcion">Descripción</label>
              <input
                type="text"
                id="reportDescripcion"
                className="filter-control"
                placeholder="Buscar descripción"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="filter-box">
              <label htmlFor="reportMoneda">Moneda</label>
              <select
                id="reportMoneda"
                className="filter-control"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                <option value="todos">Todas</option>
                <option value="Pesos">Pesos</option>
                <option value="Dolares">Dólares</option>
              </select>
            </div>

            <div className="filter-box">
              <label htmlFor="reportCantidad">Cantidad</label>
              <input
                type="number"
                id="reportCantidad"
                className="filter-control"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>

            <div className="filter-box report-filter-button-box">
              <label>&nbsp;</label>
              <button type="button" className="btn btn-dark" onClick={applyFilters}>
                <span className="material-icons-outlined">search</span>
                Buscar
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="history-table report-table">
              <thead>
                <tr>
                  <th>Sem</th>
                  <th>Folio</th>
                  <th>Fecha</th>
                  <th>Nombre</th>
                  <th>Concepto</th>
                  <th>Dólares</th>
                  <th>Pesos</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '18px' }}>
                      Cargando reporte de {activeSection.plural.toLowerCase()} desde PostgreSQL...
                    </td>
                  </tr>
                ) : apiError ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '18px' }}>
                      {apiError}
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '18px' }}>
                      No se encontraron registros de {activeSection.plural.toLowerCase()} para los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((record) => {
                    const info = getISOWeekInfo(record.fecha);
                    const isDeletingCurrentRow = deletingId === record.id;

                    const isCanceledRow = record.tipo === 'cancelado';

                    return (
                      <tr key={record.id} className={isCanceledRow ? 'report-row-cancelado' : ''}>
                        {/* Propósito: mostrar solo el número de semana, no el rango de fechas. */}
                        <td>{info.week}</td>

                        {/* Propósito: conservar folio después de la semana. */}
                        <td>{record.folio}</td>

                        {/* Propósito: mostrar la fecha después del folio. */}
                        <td>{formatShortDate(record.fecha)}</td>

                        {/* Propósito: mostrar el nombre relacionado con el movimiento. */}
                        <td>{record.nombre}</td>

                        {/* Propósito: mostrar la descripción como concepto. */}
                        <td>{record.descripcion}</td>

                        {/* Propósito: mostrar montos en dólares antes que pesos. */}
                        <td className="money-cell">{getAmountForCurrencyColumn(record, 'Dólares')}</td>

                        {/* Propósito: mostrar montos en pesos después de dólares. */}
                        <td className="money-cell">{getAmountForCurrencyColumn(record, 'Pesos')}</td>

                        <td>
                          <div className="report-row-actions">
                            <button
                              type="button"
                              className="btn-icon-action btn-edit-row"
                              onClick={() => openEditModal(record)}
                              disabled={Boolean(deletingId) || record.tipo === 'cancelado'}
                              title="Modificar movimiento"
                            >
                              <span className="material-icons-outlined">edit</span>
                              Editar
                            </button>

                            <button
                              type="button"
                              className="btn-icon-action btn-delete-row"
                              onClick={() => removeMovement(record)}
                              disabled={Boolean(deletingId) || record.tipo === 'cancelado'}
                              title="Cancelar movimiento"
                            >
                              <span className="material-icons-outlined">
                                {isDeletingCurrentRow ? 'hourglass_top' : 'block'}
                              </span>
                              {record.tipo === 'cancelado' ? 'Cancelado' : isDeletingCurrentRow ? 'Cancelando' : 'Cancelar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {editingRecord && (
        <div className="report-modal-backdrop" role="presentation">
          <form className="report-modal-card" onSubmit={saveEditedMovement}>
            <div className="report-modal-header">
              <div>
                <h2>Modificar movimiento</h2>
                <p>Actualiza la información del folio {editingRecord.folio}.</p>
              </div>

              <button
                type="button"
                className="report-modal-close"
                onClick={closeEditModal}
                disabled={isUpdating}
                aria-label="Cerrar modal"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <div className="report-modal-grid">
              <div className="filter-box">
                <label htmlFor="editTipo">Tipo</label>
                <select
                  id="editTipo"
                  className="filter-control"
                  value={editForm.tipo}
                  onChange={(event) => updateEditForm('tipo', event.target.value)}
                >
                  <option value="ingreso">Ingresos</option>
                  <option value="egreso">Egresos</option>
                </select>
              </div>

              <div className="filter-box">
                <label htmlFor="editFecha">Fecha</label>
                <input
                  type="date"
                  id="editFecha"
                  className="filter-control"
                  value={editForm.fecha}
                  onChange={(event) => updateEditForm('fecha', event.target.value)}
                />
              </div>

              <div className="filter-box">
                <label htmlFor="editFolio">Folio</label>
                <input
                  type="text"
                  id="editFolio"
                  className="filter-control"
                  value={editForm.folio}
                  onChange={(event) => updateEditForm('folio', event.target.value)}
                />
              </div>

              <div className="filter-box">
                <label htmlFor="editNombre">Nombre</label>
                <input
                  type="text"
                  id="editNombre"
                  className="filter-control"
                  value={editForm.nombre}
                  onChange={(event) => updateEditForm('nombre', event.target.value)}
                />
              </div>

              <div className="filter-box">
                <label htmlFor="editCantidad">Cantidad</label>
                <input
                  type="number"
                  id="editCantidad"
                  className="filter-control"
                  min="0"
                  step="0.01"
                  value={editForm.cantidad}
                  onChange={(event) => updateEditForm('cantidad', event.target.value)}
                />
              </div>

              <div className="filter-box">
                <label>Moneda *</label>

                <div className="currency-choice-group" role="radiogroup" aria-label="Seleccionar moneda">
                  {CURRENCY_OPTIONS.map((currency) => (
                    <button
                      key={currency.value}
                      type="button"
                      className={`currency-choice ${isCurrencySelected(editForm.moneda, currency.value) ? 'selected' : ''}`}
                      onClick={() => updateEditForm('moneda', currency.value)}
                      aria-pressed={isCurrencySelected(editForm.moneda, currency.value)}
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

              <div className="filter-box report-modal-wide">
                <label htmlFor="editDescripcion">Descripción</label>
                <textarea
                  id="editDescripcion"
                  className="filter-control report-modal-textarea"
                  value={editForm.descripcion}
                  onChange={(event) => updateEditForm('descripcion', event.target.value)}
                />
              </div>
            </div>

            <div className="report-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeEditModal}
                disabled={isUpdating}
              >
                Cancelar
              </button>

              <button type="submit" className="btn btn-dark" disabled={isUpdating}>
                <span className="material-icons-outlined">
                  {isUpdating ? 'hourglass_top' : 'save'}
                </span>
                {isUpdating ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      )}

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

export default Reports;
