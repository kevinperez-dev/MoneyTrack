// Archivo: src/pages/Home.jsx
// Propósito: vista inicial tipo Excel para control semanal de caja chica

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Header from '../components/Header.jsx';
import { getMovements } from '../services/movementsApi.js';

import {
    formatAmount,
    getCurrentISOWeek,
    getISOWeekInfo,
    getMaxAllowedWeekForYear,
    getWeekLabel,
    isAuthenticated
} from '../utils/common.js';

function Home() {
    const navigate = useNavigate();

    // Movimientos cargados desde PostgreSQL
    const [records, setRecords] = useState([]);

    // Estados generales de carga
    const [isLoading, setIsLoading] = useState(true);
    const [apiError, setApiError] = useState('');

    // Semana seleccionada
    const currentWeek = getCurrentISOWeek();
    const [period, setPeriod] = useState(String(currentWeek.year));
    const [week, setWeek] = useState(String(currentWeek.week));

    // Saldo inicial temporal por semana
    // Después lo podemos guardar en PostgreSQL con una tabla weekly_balances
    const storageKey = `pegasoSaldoInicial_${period}_${week}`;
    const [startingBalance, setStartingBalance] = useState(() => {
        return localStorage.getItem(storageKey) || '0';
    });

    // Años visibles
    const years = useMemo(() => {
        return [currentWeek.year - 1, currentWeek.year];
    }, [currentWeek.year]);

    // Semanas visibles según el periodo
    const weeks = useMemo(() => {
        const maxWeek = getMaxAllowedWeekForYear(Number(period), records);
        return Array.from({ length: maxWeek }, (_, index) => maxWeek - index);
    }, [period, records]);

    // Semana segura para evitar seleccionar una semana inexistente
    const selectedWeek = weeks.includes(Number(week))
        ? String(week)
        : weeks.length > 0
            ? String(weeks[0])
            : String(currentWeek.week);

    // Movimientos de la semana seleccionada
    const weeklyRecords = useMemo(() => {
        return records
            .filter((record) => {
                const info = getISOWeekInfo(record.fecha);

                return (
                    info.year === Number(period) &&
                    info.week === Number(selectedWeek)
                );
            })
            .sort((a, b) => {
                const dateA = new Date(`${a.fecha}T00:00:00`);
                const dateB = new Date(`${b.fecha}T00:00:00`);

                if (dateA.getTime() !== dateB.getTime()) {
                    return dateA - dateB;
                }

                return Number(a.id) - Number(b.id);
            });
    }, [records, period, selectedWeek]);
    // Tabla tipo Excel con saldo acumulado
    const cashRows = useMemo(() => {
        const initialBalance = Number(startingBalance || 0);

        // Fila inicial de la semana
        const initialRow = {
            id: 'saldo-inicial',
            fecha: '',
            folio: '',
            descripcion: 'Quedó de semana anterior',
            cargo: null,
            abono: initialBalance,
            saldo: initialBalance,
            rowType: 'initial'
        };

        // Se generan las filas sin mutar variables externas
        const { rows } = weeklyRecords.reduce(
            (accumulator, record) => {
                const isIncome = record.tipo === 'ingreso';
                const cargo = isIncome ? null : Number(record.cantidad || 0);
                const abono = isIncome ? Number(record.cantidad || 0) : null;

                const nextBalance =
                    accumulator.balance + Number(abono || 0) - Number(cargo || 0);

                const row = {
                    id: record.id,
                    fecha: record.fecha,
                    folio: record.folio,
                    descripcion: record.descripcion || record.nombre,
                    cargo,
                    abono,
                    saldo: nextBalance,
                    rowType: record.tipo
                };

                return {
                    balance: nextBalance,
                    rows: [...accumulator.rows, row]
                };
            },
            {
                balance: initialBalance,
                rows: []
            }
        );

        return [initialRow, ...rows];
    }, [weeklyRecords, startingBalance]);

    // Totales de la semana
    const totals = useMemo(() => {
        const totalAbonos = weeklyRecords
            .filter((record) => record.tipo === 'ingreso')
            .reduce((sum, record) => sum + Number(record.cantidad || 0), 0);

        const totalCargos = weeklyRecords
            .filter((record) => record.tipo === 'egreso')
            .reduce((sum, record) => sum + Number(record.cantidad || 0), 0);

        const finalBalance = Number(startingBalance || 0) + totalAbonos - totalCargos;

        return {
            totalAbonos,
            totalCargos,
            finalBalance
        };
    }, [weeklyRecords, startingBalance]);

    // Carga movimientos desde API
    useEffect(() => {
        if (!isAuthenticated()) {
            navigate('/login', { replace: true });
            return;
        }

        async function loadHomeData() {
            try {
                setIsLoading(true);
                setApiError('');

                const data = await getMovements();
                setRecords(data);
            } catch (error) {
                setApiError(error.message || 'No se pudieron cargar los movimientos.');
            } finally {
                setIsLoading(false);
            }
        }

        loadHomeData();
    }, [navigate]);

    // Estilos globales para esta vista
    useEffect(() => {
        document.body.classList.remove('login-page', 'pagina-reportes', 'modo-egreso');
        document.body.classList.add('pagina-dashboard', 'modo-ingreso');

        return () => {
            document.body.classList.remove('pagina-dashboard', 'modo-ingreso');
        };
    }, []);

    // Guarda saldo inicial localmente por semana
    useEffect(() => {
        localStorage.setItem(storageKey, startingBalance || '0');
    }, [storageKey, startingBalance]);

    return (
        <>
            <Header activePage="inicio" />

            <main className="page-wrapper">
                <section className="page-header screenshot-style-header">
                    <div>
                        <h1>Inicio</h1>
                        <p>Control semanal tipo Excel de caja chica, cargos, abonos y saldo acumulado.</p>
                    </div>
                </section>

                <section className="home-summary-grid">
                    <div className="home-summary-card">
                        <span>Saldo inicial</span>
                        <strong>${formatAmount(startingBalance || 0)}</strong>
                    </div>

                    <div className="home-summary-card">
                        <span>Total abonos</span>
                        <strong>${formatAmount(totals.totalAbonos)}</strong>
                    </div>

                    <div className="home-summary-card">
                        <span>Total cargos</span>
                        <strong>${formatAmount(totals.totalCargos)}</strong>
                    </div>

                    <div className="home-summary-card final">
                        <span>Saldo final</span>
                        <strong>${formatAmount(totals.finalBalance)}</strong>
                    </div>
                </section>

                <section className="card home-excel-card">
                    <div className="card-header reports-header-row">
                        <div>
                            <h2>Control semanal</h2>
                            <p className="home-card-subtitle">
                                Semana {getWeekLabel(Number(period), Number(selectedWeek))}
                            </p>
                        </div>
                    </div>

                    <div className="home-filters-panel">
                        <div className="home-filters-row">
                            <div className="filter-box">
                                <label htmlFor="homePeriodo">Periodo</label>
                                <select
                                    id="homePeriodo"
                                    className="filter-control"
                                    value={period}
                                    onChange={(event) => {
                                        const nextYear = event.target.value;
                                        const maxWeek = getMaxAllowedWeekForYear(Number(nextYear), records);

                                        setPeriod(nextYear);
                                        setWeek(String(maxWeek));
                                    }}
                                >
                                    {years.map((year) => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="filter-box">
                                <label htmlFor="homeSemana">Semana</label>
                                <select
                                    id="homeSemana"
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

                            <div className="filter-box">
                                <label htmlFor="startingBalance">Monto inicial de la semana</label>
                                <input
                                    id="startingBalance"
                                    className="filter-control"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={startingBalance}
                                    onChange={(event) => setStartingBalance(event.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="home-table-panel">
                        <div className="table-wrapper home-table-wrapper">
                            <table className="home-excel-table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Folio</th>
                                        <th>Descripción</th>
                                        <th>Cargo</th>
                                        <th>Abono</th>
                                        <th>Saldo</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan="6" className="home-empty-row">
                                                Cargando movimientos...
                                            </td>
                                        </tr>
                                    ) : apiError ? (
                                        <tr>
                                            <td colSpan="6" className="home-empty-row">
                                                {apiError}
                                            </td>
                                        </tr>
                                    ) : cashRows.length === 1 ? (
                                        <>
                                            {cashRows.map((row) => (
                                                <tr key={row.id} className="home-row-initial">
                                                    <td>{row.fecha}</td>
                                                    <td>{row.folio}</td>
                                                    <td>{row.descripcion}</td>
                                                    <td></td>
                                                    <td>${formatAmount(row.abono)}</td>
                                                    <td>${formatAmount(row.saldo)}</td>
                                                </tr>
                                            ))}

                                            <tr>
                                                <td colSpan="6" className="home-empty-row">
                                                    No hay cargos ni abonos registrados en esta semana.
                                                </td>
                                            </tr>
                                        </>
                                    ) : (
                                        cashRows.map((row) => (
                                            <tr
                                                key={row.id}
                                                className={
                                                    row.rowType === 'initial'
                                                        ? 'home-row-initial'
                                                        : row.rowType === 'ingreso'
                                                            ? 'home-row-abono'
                                                            : 'home-row-cargo'
                                                }
                                            >
                                                <td>{row.fecha}</td>
                                                <td>{row.folio}</td>
                                                <td>{row.descripcion}</td>
                                                <td>{row.cargo ? `$${formatAmount(row.cargo)}` : ''}</td>
                                                <td>{row.abono ? `$${formatAmount(row.abono)}` : ''}</td>
                                                <td>${formatAmount(row.saldo)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>

                                <tfoot>
                                    <tr>
                                        <td colSpan="3">Totales de la semana</td>
                                        <td>${formatAmount(totals.totalCargos)}</td>
                                        <td>${formatAmount(totals.totalAbonos)}</td>
                                        <td>${formatAmount(totals.finalBalance)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </section>
            </main>
        </>
    );
}

export default Home;