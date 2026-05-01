// Archivo: src/pages/Reports.jsx
// Propósito: vista de reportes conectada con Express/PostgreSQL.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Header from '../components/Header.jsx';
import { getMovements } from '../services/movementsApi.js';

import {
  exportRowsToExcelXml,
  formatAmount,
  getCurrentISOWeek,
  getISOWeekInfo,
  getMaxAllowedWeekForYear,
  getWeekLabel,
  isAuthenticated
} from '../utils/common.js';

function Reports() {
  const navigate = useNavigate();

  // Registros principales cargados desde PostgreSQL.
  const [records, setRecords] = useState([]);

  // Estados de carga, errores y notificaciones.
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [toast, setToast] = useState(null);

  // Filtros de reportes.
  const [period, setPeriod] = useState(String(getCurrentISOWeek().year));
  const [week, setWeek] = useState('todas');
  const [type, setType] = useState('todos');
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
    type: 'todos',
    date: '',
    folio: '',
    name: '',
    description: '',
    currency: 'todos',
    amount: ''
  });

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

  // Registros visibles en la tabla según filtros aplicados.
  const filteredRows = useMemo(() => {
    return records.filter((record) => {
      const info = getISOWeekInfo(record.fecha);
      const filterYear = Number(appliedFilters.period);
      const filterWeek = appliedFilters.week;
      const filterType = appliedFilters.type;
      const filterDate = appliedFilters.date.trim();
      const filterFolio = appliedFilters.folio.trim().toLowerCase();
      const filterName = appliedFilters.name.trim().toLowerCase();
      const filterDescription = appliedFilters.description.trim().toLowerCase();
      const filterCurrency = appliedFilters.currency;
      const filterAmount = appliedFilters.amount.trim();

      if (info.year !== filterYear) return false;

      if (filterWeek !== 'todas' && info.week !== Number(filterWeek)) {
        return false;
      }

      if (filterType !== 'todos' && record.tipo !== filterType) return false;
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

      if (filterCurrency !== 'todos' && record.moneda !== filterCurrency) {
        return false;
      }

      if (filterAmount !== '' && Number(record.cantidad) !== Number(filterAmount)) {
        return false;
      }

      return true;
    });
  }, [records, appliedFilters]);

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

  // Aplica clases generales del body.
  useEffect(() => {
    document.body.classList.remove('login-page', 'modo-egreso');
    document.body.classList.add('pagina-dashboard', 'pagina-reportes', 'modo-ingreso');

    return () => {
      document.body.classList.remove(
        'pagina-dashboard',
        'pagina-reportes',
        'modo-ingreso'
      );
    };
  }, []);

  // Oculta el toast automáticamente.
  useEffect(() => {
    if (!toast) return undefined;

    const timeoutId = setTimeout(() => {
      setToast(null);
    }, 2600);

    return () => clearTimeout(timeoutId);
  }, [toast]);

  // Aplica los filtros actuales al listado.
  const applyFilters = () => {
    setAppliedFilters({
      period,
      week: selectedReportWeek,
      type,
      date,
      folio,
      name,
      description,
      currency,
      amount
    });
  };

  // Limpia los filtros y vuelve a los valores base.
  const clearFilters = () => {
    const currentYear = String(getCurrentISOWeek().year);

    setPeriod(currentYear);
    setWeek('todas');
    setType('todos');
    setDate('');
    setFolio('');
    setName('');
    setDescription('');
    setCurrency('todos');
    setAmount('');

    setAppliedFilters({
      period: currentYear,
      week: 'todas',
      type: 'todos',
      date: '',
      folio: '',
      name: '',
      description: '',
      currency: 'todos',
      amount: ''
    });
  };

  // Exporta el reporte filtrado actual.
  const exportReportTable = () => {
    if (!filteredRows.length) {
      setToast({
        title: 'Error',
        text: 'No hay registros para exportar con los filtros actuales.',
        type: 'error'
      });
      return;
    }

    const headerColor = appliedFilters.type === 'egreso' ? '#F0DC84' : '#86DFE6';

    const excelRows = filteredRows.map((record) => {
      const info = getISOWeekInfo(record.fecha);

      return [
        record.tipo === 'ingreso' ? 'Ingresos' : 'Egresos',
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
      sheetName: 'Reportes',
      fileName: 'reporte_movimientos',
      headers: [
        'Tipo',
        'Fecha',
        'Semana',
        'Folio',
        'Nombre',
        'Descripción',
        'Cantidad',
        'Moneda'
      ],
      headerColor
    });

    setToast({
      title: 'Exportación completada',
      text: 'El reporte se exportó correctamente.',
      type: 'success'
    });
  };

  return (
    <>
      <Header activePage="reportes" />

      <main className="page-wrapper">
        <section className="page-header screenshot-style-header">
          <div>
            <h1>Reportes de Movimientos</h1>
            <p>Filtra por semana, nombre, folio y cualquier campo visible en la tabla.</p>
          </div>
        </section>

        <section className="card reports-card">
          <div className="card-header reports-header-row">
            <h2>Tabla general de movimientos</h2>

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

          <div className="reports-filters-strip">
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
              <label htmlFor="reportTipo">Movimientos</label>
              <select
                id="reportTipo"
                className="filter-control"
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="ingreso">Ingresos</option>
                <option value="egreso">Egresos</option>
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
                <option value="Dólares">Dólares</option>
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
                  <th>Tipo</th>
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
                    <td colSpan="8" style={{ textAlign: 'center', padding: '18px' }}>
                      Cargando reportes desde PostgreSQL...
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
                      No se encontraron registros para los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((record) => {
                    const info = getISOWeekInfo(record.fecha);

                    return (
                      <tr key={record.id}>
                        <td>
                          <span className={`tipo-badge ${record.tipo}`}>
                            {record.tipo === 'ingreso' ? 'Ingresos' : 'Egresos'}
                          </span>
                        </td>
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

export default Reports;