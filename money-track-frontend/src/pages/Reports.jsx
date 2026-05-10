// Archivo: src/pages/Reports.jsx
// Propósito: vista reutilizable para reportes de ingresos, egresos o cancelados con edición, cancelación lógica e historial de ajustes.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Header from '../components/Header.jsx';
import {
  deleteMovement,
  getMovementEditHistory,
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

// Propósito: normalizar el nombre de moneda para comparar pesos y dólares sin depender de acentos.
function normalizeCurrencyName(currency) {
  return String(currency || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Propósito: revisar si una opción de moneda debe mostrarse marcada.
function isCurrencySelected(currentCurrency, optionCurrency) {
  return normalizeCurrencyName(currentCurrency) === normalizeCurrencyName(optionCurrency);
}

// Propósito: dar formato a los importes usando el símbolo correcto según la moneda seleccionada.
function formatMoneyByCurrency(amount, currency) {
  const normalizedCurrency = normalizeCurrencyName(currency);
  const symbol = normalizedCurrency.includes('dolar') || normalizedCurrency.includes('usd') ? 'US$' : '$';

  return `${symbol}${formatAmount(amount || 0)}`;
}

// Propósito: identificar si el movimiento pertenece a pesos o dólares para separarlo en columnas.
function isDollarCurrency(currency) {
  const normalizedCurrency = normalizeCurrencyName(currency);
  return normalizedCurrency.includes('dolar') || normalizedCurrency.includes('usd');
}

// Propósito: mostrar el monto solo en la columna de la moneda correspondiente.
function getAmountForCurrencyColumn(record, targetCurrency) {
  const shouldShowAmount =
    targetCurrency === 'Dólares'
      ? isDollarCurrency(record.moneda)
      : !isDollarCurrency(record.moneda);

  return shouldShowAmount ? formatMoneyByCurrency(record.cantidad, targetCurrency) : '—';
}

// Propósito: convertir una fecha YYYY-MM-DD a formato corto, ejemplo 04/may.
function formatShortDate(dateValue) {
  if (!dateValue) return '';

  // Propósito: separar manualmente la fecha para evitar desfases por zona horaria.
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
    '12': 'dic',
  };

  if (!year || !month || !day || !monthNames[month]) {
    return dateValue;
  }

  return `${day}/${monthNames[month]}`;
}

// Propósito: revisar si el movimiento tiene una edición guardada en movement_edits.
function hasAmountAdjustment(record) {
  return Boolean(record.ultimo_ajuste_id && record.fecha_ultima_edicion);
}

// Propósito: calcular la diferencia del último ajuste registrado.
function getAdjustmentDifference(record) {
  if (!hasAmountAdjustment(record)) {
    return '—';
  }

  const currentAmount = Number(record.cantidad_nueva || 0);
  const previousAmount = Number(record.cantidad_anterior || 0);
  const difference = currentAmount - previousAmount;
  const sign = difference >= 0 ? '+' : '-';

  return `${sign}${formatMoneyByCurrency(Math.abs(difference), record.moneda_nueva)}`;
}

// Propósito: normalizar valores para comparar si un campo cambió.
function normalizeAdjustmentValue(value) {
  return String(value ?? '').trim();
}

// Propósito: mostrar etiquetas legibles para tipo de movimiento.
function getTypeLabel(type) {
  if (type === 'egreso') return 'Egreso';
  if (type === 'cancelado') return 'Cancelado';
  return 'Ingreso';
}

// Propósito: obtener el valor anterior guardado para un campo del último ajuste.
function getPreviousFieldValue(record, fieldName) {
  return record?.[`${fieldName}_anterior`] ?? '';
}

// Propósito: obtener el valor nuevo guardado para un campo del último ajuste.
function getNewFieldValue(record, fieldName) {
  return record?.[`${fieldName}_nuevo`] ?? record?.[fieldName] ?? '';
}

// Propósito: identificar si un campo específico cambió en el último ajuste.
function fieldChangedInLastAdjustment(record, fieldName) {
  if (!hasAmountAdjustment(record)) return false;

  const previousValue = getPreviousFieldValue(record, fieldName);
  const newValue = getNewFieldValue(record, fieldName);

  if (previousValue === '' || newValue === '') return false;

  return normalizeAdjustmentValue(previousValue) !== normalizeAdjustmentValue(newValue);
}

// Propósito: identificar si el monto o la moneda cambió en el último ajuste.
function moneyChangedInLastAdjustment(record) {
  if (!hasAmountAdjustment(record)) return false;

  const previousAmount = Number(record.cantidad_anterior || 0);
  const newAmount = Number(record.cantidad_nueva || 0);
  const previousCurrency = normalizeCurrencyName(record.moneda_anterior);
  const newCurrency = normalizeCurrencyName(record.moneda_nueva);

  return previousAmount !== newAmount || previousCurrency !== newCurrency;
}


// Propósito: calcular la diferencia de una fila del historial completo de ajustes.
function getHistoryAdjustmentDifference(editRow) {
  const currentAmount = Number(editRow.cantidad_nueva || 0);
  const previousAmount = Number(editRow.cantidad_anterior || 0);
  const difference = currentAmount - previousAmount;
  const sign = difference >= 0 ? '+' : '-';

  return `${sign}${formatMoneyByCurrency(Math.abs(difference), editRow.moneda_nueva)}`;
}

// Propósito: formatear fecha y hora de edición para mostrarla en el historial.
function formatEditDateTime(dateValue) {
  if (!dateValue) return 'Sin fecha';

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }

  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function Reports({ reportType = 'ingreso' }) {
  const navigate = useNavigate();

  // Propósito: tipo de reporte que viene desde la ruta.
  const activeReportType = getSafeReportType(reportType);

  // Propósito: registros principales cargados desde PostgreSQL.
  const [records, setRecords] = useState([]);

  // Propósito: estados de carga, errores y notificaciones.
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [apiError, setApiError] = useState('');
  const [toast, setToast] = useState(null);

  // Propósito: estado del modal de edición.
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

  // Propósito: estado del modal que muestra el último ajuste de monto.
  const [selectedAdjustmentRecord, setSelectedAdjustmentRecord] = useState(null);

  // Propósito: historial completo de ajustes, visible en Reportes > Cancelados.
  const [editHistoryRows, setEditHistoryRows] = useState([]);
  const [isEditHistoryLoading, setIsEditHistoryLoading] = useState(false);
  const [editHistoryError, setEditHistoryError] = useState('');

  // Propósito: filtros de reportes.
  const [period, setPeriod] = useState(String(getCurrentISOWeek().year));
  const [week, setWeek] = useState('todas');
  const [date, setDate] = useState('');
  const [folio, setFolio] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('todos');
  const [amount, setAmount] = useState('');

  // Propósito: filtros aplicados al presionar Buscar.
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
  const isCanceledReport = activeReportType === 'cancelado';

  // Propósito: periodos visibles: año actual y anterior.
  const years = useMemo(() => {
    const currentYear = getCurrentISOWeek().year;
    return [currentYear - 1, currentYear];
  }, []);

  // Propósito: semanas visibles para el periodo seleccionado.
  const weeks = useMemo(() => {
    const maxWeek = getMaxAllowedWeekForYear(Number(period), records);
    return Array.from({ length: maxWeek }, (_, index) => maxWeek - index);
  }, [period, records]);

  // Propósito: semana válida sin usar setState dentro de useEffect.
  const selectedReportWeek =
    week === 'todas' || weeks.includes(Number(week))
      ? week
      : 'todas';

  // Propósito: registros visibles en la tabla según sección activa y filtros aplicados.
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

      // Propósito: conservar visible una fila recién cancelada dentro del apartado donde estaba hasta recargar.
      const tipoParaFiltrar =
        record.tipo === 'cancelado' && record.tipoVistaOriginal
          ? record.tipoVistaOriginal
          : record.tipo;

      // Propósito: en reportes de cancelados mostrar únicamente cancelados.
      if (activeReportType === 'cancelado' && record.tipo !== 'cancelado') {
        return false;
      }

      // Propósito: en ingresos/egresos respetar el apartado activo.
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

      if (
        filterCurrency !== 'todos' &&
        normalizeCurrencyName(record.moneda) !== normalizeCurrencyName(filterCurrency)
      ) {
        return false;
      }

      if (filterAmount !== '' && Number(record.cantidad) !== Number(filterAmount)) {
        return false;
      }

      return true;
    });
  }, [records, appliedFilters, activeReportType]);

  // Propósito: proteger la vista y cargar reportes desde la API.
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
  }, [navigate, activeReportType]);

  // Propósito: cargar el historial completo de ajustes cuando se abre Reportes > Cancelados.
  useEffect(() => {
    if (!isAuthenticated()) return;

    if (!isCanceledReport) {
      return;
    }

    async function loadCanceledEditHistory() {
      try {
        setIsEditHistoryLoading(true);
        setEditHistoryError('');

        // Propósito: mostrar en este apartado todo el historial de ediciones existente,
        // no solo el de movimientos que ya fueron cancelados.
        const data = await getMovementEditHistory();
        setEditHistoryRows(data);
      } catch (error) {
        setEditHistoryRows([]);
        setEditHistoryError(error.message);
      } finally {
        setIsEditHistoryLoading(false);
      }
    }

    loadCanceledEditHistory();
  }, [isCanceledReport]);

  // Propósito: aplicar clases generales del body y cambiar color base según sección activa.
  useEffect(() => {
    document.body.classList.remove('login-page', 'modo-ingreso', 'modo-egreso', 'modo-cancelado');
    document.body.classList.add(
      'pagina-dashboard',
      'pagina-reportes',
      activeReportType === 'egreso'
        ? 'modo-egreso'
        : activeReportType === 'cancelado'
          ? 'modo-cancelado'
          : 'modo-ingreso'
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

  // Propósito: ocultar el toast automáticamente.
  useEffect(() => {
    if (!toast) return undefined;

    const timeoutId = setTimeout(() => {
      setToast(null);
    }, 2600);

    return () => clearTimeout(timeoutId);
  }, [toast]);

  // Propósito: actualizar un campo del formulario de edición.
  const updateEditForm = (field, value) => {
    setEditForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  // Propósito: abrir el modal cargando los datos del movimiento seleccionado.
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

  // Propósito: cerrar el modal de edición sin modificar el registro.
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

  // Propósito: abrir el modal con el detalle del último ajuste.
  const openAdjustmentModal = (record) => {
    setSelectedAdjustmentRecord(record);
  };

  // Propósito: cerrar el modal de detalle del ajuste.
  const closeAdjustmentModal = () => {
    setSelectedAdjustmentRecord(null);
  };

  // Propósito: guardar la edición del movimiento seleccionado.
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

      // Propósito: reemplazar en pantalla el registro actualizado con su último ajuste.
      setRecords((currentRecords) =>
        currentRecords.map((record) =>
          record.id === updatedRecord.id ? updatedRecord : record
        )
      );

      setToast({
        title: 'Movimiento actualizado',
        text: hasAmountAdjustment(updatedRecord)
          ? 'Los cambios se guardaron y el ajuste de monto quedó registrado.'
          : 'Los cambios se guardaron correctamente.',
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

  // Propósito: cancelar el movimiento seleccionado después de confirmar con el usuario.
  const removeMovement = async (record) => {
    const confirmed = window.confirm(
      `¿Seguro que deseas cancelar el movimiento con folio ${record.folio}? Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(record.id);

      const canceledRecord = await deleteMovement(record.id);

      // Propósito: actualizar el registro sin borrarlo de PostgreSQL y conservarlo visible hasta recargar.
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
        text: 'El registro se marcó como cancelado y se conserva para visibilidad.',
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

  // Propósito: aplicar los filtros actuales al listado.
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

  // Propósito: limpiar los filtros y volver a los valores base sin cambiar de apartado.
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

  // Propósito: exportar el reporte filtrado actual de la sección activa.
  const exportReportTable = () => {
    if (!filteredRows.length) {
      setToast({
        title: 'Error',
        text: `No hay registros de ${activeSection.plural.toLowerCase()} para exportar con los filtros actuales.`,
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
      sheetName: activeSection.sheetName,
      fileName: activeSection.fileName,
      headers: ['Sem', 'Folio', 'Fecha', 'Nombre', 'Concepto', 'Dólares', 'Pesos'],
      headerColor: activeSection.headerColor
    });

    setToast({
      title: 'Exportación completada',
      text: `El reporte de ${activeSection.plural.toLowerCase()} se exportó correctamente.`,
      type: 'success'
    });
  };

  // Propósito: cantidad de columnas visibles en la tabla principal.
  const mainTableColSpan = 8;

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
              <label htmlFor="reportDescripcion">Concepto</label>
              <input
                type="text"
                id="reportDescripcion"
                className="filter-control"
                placeholder="Buscar concepto"
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
                    <td colSpan={mainTableColSpan} style={{ textAlign: 'center', padding: '18px' }}>
                      Cargando reporte de {activeSection.plural.toLowerCase()} desde PostgreSQL...
                    </td>
                  </tr>
                ) : apiError ? (
                  <tr>
                    <td colSpan={mainTableColSpan} style={{ textAlign: 'center', padding: '18px' }}>
                      {apiError}
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={mainTableColSpan} style={{ textAlign: 'center', padding: '18px' }}>
                      No se encontraron registros de {activeSection.plural.toLowerCase()} para los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((record) => {
                    const info = getISOWeekInfo(record.fecha);
                    const isDeletingCurrentRow = deletingId === record.id;
                    const isCanceledRow = record.tipo === 'cancelado';
                    const rowClassName = [
                      isCanceledRow ? 'report-row-cancelado' : '',
                      hasAmountAdjustment(record) ? 'report-row-edited' : ''
                    ].filter(Boolean).join(' ');

                    return (
                      <tr key={record.id} className={rowClassName}>
                        <td>{info.week}</td>
                        <td>{record.folio}</td>
                        <td>{formatShortDate(record.fecha)}</td>
                        <td>{record.nombre}</td>
                        <td>{record.descripcion}</td>
                        <td className="money-cell">{getAmountForCurrencyColumn(record, 'Dólares')}</td>
                        <td className="money-cell">{getAmountForCurrencyColumn(record, 'Pesos')}</td>
                        <td>
                          <div className="report-row-actions">
                            {hasAmountAdjustment(record) && (
                              <button
                                type="button"
                                className="btn-icon-action btn-adjustment-row"
                                onClick={() => openAdjustmentModal(record)}
                                title="Ver último ajuste"
                              >
                                <span className="material-icons-outlined">visibility</span>
                                Ver ajuste
                              </button>
                            )}

                            {!isCanceledReport && (
                              <>
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
                              </>
                            )}

                            {isCanceledReport && !hasAmountAdjustment(record) && (
                              <span className="empty-adjustment-cell">—</span>
                            )}
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

        {isCanceledReport && (
          <section className="card reports-card edit-history-card">
            <div className="card-header reports-header-row">
              <div>
                <h2>Historial de ediciones</h2>
                <p className="report-section-description">
                  Ediciones registradas en el sistema. Se muestran los cambios guardados para revisión.
                </p>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="history-table report-table edit-history-table">
                <thead>
                  <tr>
                    <th>Sem</th>
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Nombre</th>
                    <th>Concepto</th>
                    <th>Monto anterior</th>
                    <th>Monto nuevo</th>
                    <th>Diferencia</th>
                    <th>Fecha ajuste</th>
                  </tr>
                </thead>

                <tbody>
                  {isEditHistoryLoading ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '18px' }}>
                        Cargando historial de ajustes...
                      </td>
                    </tr>
                  ) : editHistoryError ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '18px' }}>
                        {editHistoryError}
                      </td>
                    </tr>
                  ) : editHistoryRows.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '18px' }}>
                        No hay historial de ediciones registrado todavía.
                      </td>
                    </tr>
                  ) : (
                    editHistoryRows.map((editRow) => {
                      const info = getISOWeekInfo(editRow.fecha);

                      return (
                        <tr key={editRow.edit_id}>
                          <td>{info.week}</td>
                          <td>{editRow.folio}</td>
                          <td>{formatShortDate(editRow.fecha)}</td>
                          <td>{editRow.nombre}</td>
                          <td>{editRow.descripcion}</td>
                          <td className="money-cell">
                            {formatMoneyByCurrency(editRow.cantidad_anterior, editRow.moneda_anterior)}
                          </td>
                          <td className="money-cell">
                            {formatMoneyByCurrency(editRow.cantidad_nueva, editRow.moneda_nueva)}
                          </td>
                          <td className="money-cell edit-history-difference">
                            {getHistoryAdjustmentDifference(editRow)}
                          </td>
                          <td>{formatEditDateTime(editRow.edited_at)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
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
                  {CURRENCY_OPTIONS.map((currencyOption) => (
                    <button
                      key={currencyOption.value}
                      type="button"
                      className={`currency-choice ${isCurrencySelected(editForm.moneda, currencyOption.value) ? 'selected' : ''}`}
                      onClick={() => updateEditForm('moneda', currencyOption.value)}
                      aria-pressed={isCurrencySelected(editForm.moneda, currencyOption.value)}
                    >
                      <span className="currency-choice-symbol">{currencyOption.symbol}</span>
                      <span className="currency-choice-text">
                        <strong>{currencyOption.label}</strong>
                        <small>{currencyOption.helper}</small>
                      </span>
                      <span className="material-icons-outlined currency-choice-check">check_circle</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-box report-modal-wide">
                <label htmlFor="editDescripcion">Concepto</label>
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

      {selectedAdjustmentRecord && (
        <div className="report-modal-backdrop" role="presentation">
          <section className="report-modal-card adjustment-modal-card">
            <div className="report-modal-header">
              <div>
                <h2>Detalle del ajuste</h2>
                <p>Folio {selectedAdjustmentRecord.folio}</p>
              </div>

              <button
                type="button"
                className="report-modal-close"
                onClick={closeAdjustmentModal}
                aria-label="Cerrar detalle del ajuste"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <div className="adjustment-detail-grid">
              <div className={`adjustment-detail-box ${fieldChangedInLastAdjustment(selectedAdjustmentRecord, 'nombre') ? 'adjustment-detail-changed' : ''}`}>
                <span>Nombre</span>
                <strong>{getNewFieldValue(selectedAdjustmentRecord, 'nombre')}</strong>
                {fieldChangedInLastAdjustment(selectedAdjustmentRecord, 'nombre') && (
                  <small className="adjustment-field-before">Antes: {getPreviousFieldValue(selectedAdjustmentRecord, 'nombre')}</small>
                )}
              </div>

              <div className={`adjustment-detail-box ${fieldChangedInLastAdjustment(selectedAdjustmentRecord, 'descripcion') ? 'adjustment-detail-changed' : ''}`}>
                <span>Concepto</span>
                <strong>{getNewFieldValue(selectedAdjustmentRecord, 'descripcion')}</strong>
                {fieldChangedInLastAdjustment(selectedAdjustmentRecord, 'descripcion') && (
                  <small className="adjustment-field-before">Antes: {getPreviousFieldValue(selectedAdjustmentRecord, 'descripcion')}</small>
                )}
              </div>

              <div className={`adjustment-detail-box ${fieldChangedInLastAdjustment(selectedAdjustmentRecord, 'folio') ? 'adjustment-detail-changed' : ''}`}>
                <span>Folio</span>
                <strong>{getNewFieldValue(selectedAdjustmentRecord, 'folio')}</strong>
                {fieldChangedInLastAdjustment(selectedAdjustmentRecord, 'folio') && (
                  <small className="adjustment-field-before">Antes: {getPreviousFieldValue(selectedAdjustmentRecord, 'folio')}</small>
                )}
              </div>

              <div className={`adjustment-detail-box ${fieldChangedInLastAdjustment(selectedAdjustmentRecord, 'fecha') ? 'adjustment-detail-changed' : ''}`}>
                <span>Fecha</span>
                <strong>{formatShortDate(getNewFieldValue(selectedAdjustmentRecord, 'fecha'))}</strong>
                {fieldChangedInLastAdjustment(selectedAdjustmentRecord, 'fecha') && (
                  <small className="adjustment-field-before">Antes: {formatShortDate(getPreviousFieldValue(selectedAdjustmentRecord, 'fecha'))}</small>
                )}
              </div>

              <div className={`adjustment-detail-box ${fieldChangedInLastAdjustment(selectedAdjustmentRecord, 'tipo') ? 'adjustment-detail-changed' : ''}`}>
                <span>Tipo</span>
                <strong>{getTypeLabel(getNewFieldValue(selectedAdjustmentRecord, 'tipo'))}</strong>
                {fieldChangedInLastAdjustment(selectedAdjustmentRecord, 'tipo') && (
                  <small className="adjustment-field-before">Antes: {getTypeLabel(getPreviousFieldValue(selectedAdjustmentRecord, 'tipo'))}</small>
                )}
              </div>

              <div className={`adjustment-detail-box ${moneyChangedInLastAdjustment(selectedAdjustmentRecord) ? 'adjustment-detail-changed' : ''}`}>
                <span>Monto actual</span>
                <strong>
                  {formatMoneyByCurrency(
                    selectedAdjustmentRecord.cantidad_nueva,
                    selectedAdjustmentRecord.moneda_nueva
                  )}
                </strong>
                {moneyChangedInLastAdjustment(selectedAdjustmentRecord) && (
                  <small className="adjustment-field-before">
                    Antes: {formatMoneyByCurrency(
                      selectedAdjustmentRecord.cantidad_anterior,
                      selectedAdjustmentRecord.moneda_anterior
                    )}
                  </small>
                )}
              </div>

              <div className="adjustment-detail-box">
                <span>Última edición</span>
                <strong>{formatShortDate(selectedAdjustmentRecord.fecha_ultima_edicion)}</strong>
              </div>

              <div className="adjustment-detail-box adjustment-detail-difference">
                <span>Diferencia</span>
                <strong>{getAdjustmentDifference(selectedAdjustmentRecord)}</strong>
              </div>
            </div>

            <div className="adjustment-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeAdjustmentModal}
              >
                Cerrar
              </button>
            </div>
          </section>
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
