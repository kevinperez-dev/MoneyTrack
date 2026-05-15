// Archivo: src/pages/Home.jsx
// Propósito: vista inicial tipo Excel para control semanal de caja chica por moneda

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

    // Función auxiliar para cargar el saldo inicial guardado por semana y moneda
    const getStoredBalances = (year, weekNumber) => {
        const oldSingleBalanceKey = `pegasoSaldoInicial_${year}_${weekNumber}`;
        const pesosKey = `moneyTrackSaldoInicialPesos_${year}_${weekNumber}`;
        const dollarsKey = `moneyTrackSaldoInicialDolares_${year}_${weekNumber}`;

        return {
            pesos: localStorage.getItem(pesosKey) ?? localStorage.getItem(oldSingleBalanceKey) ?? '0',
            dolares: localStorage.getItem(dollarsKey) ?? '0'
        };
    };

    // Saldo inicial temporal por semana y moneda
    // Después se puede guardar en PostgreSQL con una tabla weekly_balances
    const initialStoredBalances = getStoredBalances(currentWeek.year, currentWeek.week);
    const [manualStartingBalancePesos, setManualStartingBalancePesos] = useState(initialStoredBalances.pesos);
    const [manualStartingBalanceDolares, setManualStartingBalanceDolares] = useState(initialStoredBalances.dolares);

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

    // Normaliza el texto de moneda para separar pesos y dólares sin depender de acentos
    const normalizeCurrency = (currency) => {
        const cleanCurrency = String(currency || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

        return cleanCurrency.includes('dolar') || cleanCurrency.includes('usd')
            ? 'dolares'
            : 'pesos';
    };

    // Renderiza importes en pesos o dólares usando únicamente el símbolo $.
    // Si el monto es cero, muestra -- para que la tabla sea más limpia.
    const renderCurrencyAmount = (amount) => {
        return Number(amount || 0) === 0 ? '--' : `$${formatAmount(amount || 0)}`;
    };

    // Renderiza celdas de ingresos/egresos; si no hay importe, muestra --.
    const renderMovementAmount = (amount) => {
        return Number(amount || 0) > 0 ? renderCurrencyAmount(amount) : '--';
    };

    // Carga el saldo inicial manual correspondiente cuando cambia el periodo o la semana.
    const loadStartingBalances = (year, weekNumber) => {
        const storedBalances = getStoredBalances(year, weekNumber);
        setManualStartingBalancePesos(storedBalances.pesos);
        setManualStartingBalanceDolares(storedBalances.dolares);
    };

    // Obtiene el lunes de una semana ISO para poder ordenar semanas de diferentes años.
    const getISOWeekStartDate = (year, weekNumber) => {
        const janFourth = new Date(Date.UTC(Number(year), 0, 4));
        const janFourthDay = janFourth.getUTCDay() || 7;
        const firstMonday = new Date(janFourth);

        firstMonday.setUTCDate(janFourth.getUTCDate() - janFourthDay + 1);
        firstMonday.setUTCDate(firstMonday.getUTCDate() + (Number(weekNumber) - 1) * 7);

        return firstMonday;
    };

    // Convierte año/semana en un valor numérico comparable.
    const getWeekStartTime = (year, weekNumber) => {
        return getISOWeekStartDate(year, weekNumber).getTime();
    };

    // Movimientos activos que sí participan en saldos.
    const activeRecords = useMemo(() => {
        return records.filter((record) => record.tipo !== 'cancelado');
    }, [records]);

    // Calcula el saldo inicial de la semana seleccionada con arrastre automático.
    const computedInitialBalances = useMemo(() => {
        const selectedYear = Number(period);
        const selectedWeekNumber = Number(selectedWeek);
        const selectedWeekStart = getWeekStartTime(selectedYear, selectedWeekNumber);

        const relevantRecords = activeRecords.filter((record) => {
            const info = getISOWeekInfo(record.fecha);
            return getWeekStartTime(info.year, info.week) <= selectedWeekStart;
        });

        if (!relevantRecords.length) {
            return {
                pesos: Number(manualStartingBalancePesos || 0),
                dolares: Number(manualStartingBalanceDolares || 0),
                isAutomatic: false,
                baseYear: selectedYear,
                baseWeek: selectedWeekNumber
            };
        }

        const sortedWeekStarts = relevantRecords
            .map((record) => {
                const info = getISOWeekInfo(record.fecha);
                return {
                    year: info.year,
                    week: info.week,
                    start: getWeekStartTime(info.year, info.week)
                };
            })
            .sort((a, b) => a.start - b.start);

        const baseWeekInfo = sortedWeekStarts[0];
        const baseBalances = getStoredBalances(baseWeekInfo.year, baseWeekInfo.week);

        const carriedBalances = relevantRecords.reduce(
            (accumulator, record) => {
                const info = getISOWeekInfo(record.fecha);
                const recordWeekStart = getWeekStartTime(info.year, info.week);

                if (recordWeekStart >= selectedWeekStart) {
                    return accumulator;
                }

                const amount = Number(record.cantidad || 0);
                const currency = normalizeCurrency(record.moneda);
                const multiplier = record.tipo === 'ingreso' ? 1 : -1;

                if (currency === 'dolares') {
                    accumulator.dolares += amount * multiplier;
                } else {
                    accumulator.pesos += amount * multiplier;
                }

                return accumulator;
            },
            {
                pesos: Number(baseBalances.pesos || 0),
                dolares: Number(baseBalances.dolares || 0)
            }
        );

        return {
            ...carriedBalances,
            isAutomatic: baseWeekInfo.start < selectedWeekStart,
            baseYear: baseWeekInfo.year,
            baseWeek: baseWeekInfo.week
        };
    }, [
        activeRecords,
        period,
        selectedWeek,
        manualStartingBalancePesos,
        manualStartingBalanceDolares
    ]);


    // Busca la última semana que sí tiene movimientos para no mostrar inicio vacío por defecto.
    const getLatestWeekWithRecords = (movementList) => {
        const activeMovements = movementList.filter((movement) => movement.tipo !== 'cancelado');

        if (!activeMovements.length) return null;

        const sortedRecords = [...activeMovements].sort((a, b) => {
            const dateA = new Date(`${a.fecha}T00:00:00`).getTime();
            const dateB = new Date(`${b.fecha}T00:00:00`).getTime();

            if (dateA !== dateB) {
                return dateB - dateA;
            }

            return Number(b.id || 0) - Number(a.id || 0);
        });

        const latestInfo = getISOWeekInfo(sortedRecords[0].fecha);

        return {
            year: String(latestInfo.year),
            week: String(latestInfo.week)
        };
    };

    // Movimientos de la semana seleccionada
    const weeklyRecords = useMemo(() => {
        return activeRecords
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
    }, [activeRecords, period, selectedWeek]);

    // Tabla tipo Excel con saldo acumulado separado por pesos y dólares
    const cashRows = useMemo(() => {
        const initialBalancePesos = Number(computedInitialBalances.pesos || 0);
        const initialBalanceDolares = Number(computedInitialBalances.dolares || 0);

        // Fila inicial de la semana
        const initialRow = {
            id: 'saldo-inicial',
            fecha: '',
            folio: '',
            descripcion: 'Saldo de semana anterior',
            ingresoPesos: null,
            ingresoDolares: null,
            egresoPesos: null,
            egresoDolares: null,
            saldoPesos: initialBalancePesos,
            saldoDolares: initialBalanceDolares,
            rowType: 'initial'
        };

        // Se generan las filas calculando el saldo independiente por moneda
        const { rows } = weeklyRecords.reduce(
            (accumulator, record) => {
                const amount = Number(record.cantidad || 0);
                const isIncome = record.tipo === 'ingreso';
                const currency = normalizeCurrency(record.moneda);
                const isPesos = currency === 'pesos';

                const ingresoPesos = isIncome && isPesos ? amount : null;
                const ingresoDolares = isIncome && !isPesos ? amount : null;
                const egresoPesos = !isIncome && isPesos ? amount : null;
                const egresoDolares = !isIncome && !isPesos ? amount : null;

                const nextBalancePesos =
                    accumulator.balancePesos + Number(ingresoPesos || 0) - Number(egresoPesos || 0);

                const nextBalanceDolares =
                    accumulator.balanceDolares + Number(ingresoDolares || 0) - Number(egresoDolares || 0);

                const row = {
                    id: record.id,
                    fecha: record.fecha,
                    folio: record.folio,
                    descripcion: record.descripcion || record.nombre,
                    ingresoPesos,
                    ingresoDolares,
                    egresoPesos,
                    egresoDolares,
                    saldoPesos: nextBalancePesos,
                    saldoDolares: nextBalanceDolares,
                    rowType: record.tipo
                };

                return {
                    balancePesos: nextBalancePesos,
                    balanceDolares: nextBalanceDolares,
                    rows: [...accumulator.rows, row]
                };
            },
            {
                balancePesos: initialBalancePesos,
                balanceDolares: initialBalanceDolares,
                rows: []
            }
        );

        return [initialRow, ...rows];
    }, [weeklyRecords, computedInitialBalances]);

    // Totales de la semana separados por moneda
    const totals = useMemo(() => {
        const weeklyTotals = weeklyRecords.reduce(
            (accumulator, record) => {
                const amount = Number(record.cantidad || 0);
                const currency = normalizeCurrency(record.moneda);
                const isIncome = record.tipo === 'ingreso';

                if (isIncome && currency === 'pesos') {
                    accumulator.totalIngresosPesos += amount;
                }

                if (isIncome && currency === 'dolares') {
                    accumulator.totalIngresosDolares += amount;
                }

                if (!isIncome && currency === 'pesos') {
                    accumulator.totalEgresosPesos += amount;
                }

                if (!isIncome && currency === 'dolares') {
                    accumulator.totalEgresosDolares += amount;
                }

                return accumulator;
            },
            {
                totalIngresosPesos: 0,
                totalIngresosDolares: 0,
                totalEgresosPesos: 0,
                totalEgresosDolares: 0
            }
        );

        const initialBalancePesos = Number(computedInitialBalances.pesos || 0);
        const initialBalanceDolares = Number(computedInitialBalances.dolares || 0);

        return {
            ...weeklyTotals,
            initialBalancePesos,
            initialBalanceDolares,
            finalBalancePesos:
                initialBalancePesos + weeklyTotals.totalIngresosPesos - weeklyTotals.totalEgresosPesos,
            finalBalanceDolares:
                initialBalanceDolares + weeklyTotals.totalIngresosDolares - weeklyTotals.totalEgresosDolares
        };
    }, [weeklyRecords, computedInitialBalances]);

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

                // Si la semana actual no tiene datos, muestra automáticamente la última semana con movimientos.
                const currentWeekHasRecords = data.some((record) => {
                    const info = getISOWeekInfo(record.fecha);
                    return (
                        record.tipo !== 'cancelado' &&
                        info.year === currentWeek.year &&
                        info.week === currentWeek.week
                    );
                });

                if (!currentWeekHasRecords) {
                    const latestWeekWithRecords = getLatestWeekWithRecords(data);

                    if (latestWeekWithRecords) {
                        setPeriod(latestWeekWithRecords.year);
                        setWeek(latestWeekWithRecords.week);
                        loadStartingBalances(latestWeekWithRecords.year, latestWeekWithRecords.week);
                    }
                }
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

    // Guarda únicamente el saldo manual de la primera semana de trabajo.
    // Las semanas siguientes se calculan automáticamente con el saldo final anterior.
    useEffect(() => {
        if (computedInitialBalances.isAutomatic) return;

        localStorage.setItem(
            `moneyTrackSaldoInicialPesos_${period}_${selectedWeek}`,
            manualStartingBalancePesos || '0'
        );

        localStorage.setItem(
            `moneyTrackSaldoInicialDolares_${period}_${selectedWeek}`,
            manualStartingBalanceDolares || '0'
        );
    }, [
        period,
        selectedWeek,
        manualStartingBalancePesos,
        manualStartingBalanceDolares,
        computedInitialBalances.isAutomatic
    ]);

    return (
        <>
            <Header activePage="inicio" />

            <main className="page-wrapper">
                <section className="page-header screenshot-style-header">
                    <div>
                        <h1>Inicio</h1>
                        <p>Control semanal tipo Excel de caja chica, ingresos, egresos y saldo acumulado automático por moneda.</p>
                    </div>
                </section>

                <section className="home-summary-grid">
                    <div className="home-summary-card">
                        <span>Saldo inicial</span>
                        <div className="home-currency-summary">
                            <div>
                                <small>Dólares</small>
                                <strong>{renderCurrencyAmount(totals.initialBalanceDolares, 'dolares')}</strong>
                            </div>
                            <div>
                                <small>Pesos</small>
                                <strong>{renderCurrencyAmount(totals.initialBalancePesos, 'pesos')}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="home-summary-card income">
                        <span>Total ingresos</span>
                        <div className="home-currency-summary">
                            <div>
                                <small>Dólares</small>
                                <strong>{renderCurrencyAmount(totals.totalIngresosDolares, 'dolares')}</strong>
                            </div>
                            <div>
                                <small>Pesos</small>
                                <strong>{renderCurrencyAmount(totals.totalIngresosPesos, 'pesos')}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="home-summary-card expense">
                        <span>Total egresos</span>
                        <div className="home-currency-summary">
                            <div>
                                <small>Dólares</small>
                                <strong>{renderCurrencyAmount(totals.totalEgresosDolares, 'dolares')}</strong>
                            </div>
                            <div>
                                <small>Pesos</small>
                                <strong>{renderCurrencyAmount(totals.totalEgresosPesos, 'pesos')}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="home-summary-card final">
                        <span>Saldo total</span>
                        <div className="home-currency-summary">
                            <div>
                                <small>Dólares</small>
                                <strong>{renderCurrencyAmount(totals.finalBalanceDolares, 'dolares')}</strong>
                            </div>
                            <div>
                                <small>Pesos</small>
                                <strong>{renderCurrencyAmount(totals.finalBalancePesos, 'pesos')}</strong>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="card home-excel-card">
                    <div className="card-header reports-header-row">
                        <div>
                            <h2>Control semanal</h2>
                            <p className="home-card-subtitle">
                                Semana {getWeekLabel(Number(period), Number(selectedWeek))}
                            </p>
                            <p className="home-auto-balance-note">
                                {computedInitialBalances.isAutomatic
                                    ? `Saldo inicial calculado desde la semana ${computedInitialBalances.baseWeek} del ${computedInitialBalances.baseYear}.`
                                    : 'Esta semana usa saldo inicial manual como punto de partida.'}
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
                                        loadStartingBalances(nextYear, maxWeek);
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
                                    onChange={(event) => {
                                        const nextWeek = event.target.value;
                                        setWeek(nextWeek);
                                        loadStartingBalances(period, nextWeek);
                                    }}
                                >
                                    {weeks.map((itemWeek) => (
                                        <option key={itemWeek} value={itemWeek}>
                                            {getWeekLabel(Number(period), itemWeek)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="filter-box">
                                <label htmlFor="startingBalanceDolares">Saldo inicial en dólares</label>
                                <input
                                    id="startingBalanceDolares"
                                    className="filter-control"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={
                                        computedInitialBalances.isAutomatic
                                            ? computedInitialBalances.dolares
                                            : manualStartingBalanceDolares
                                    }
                                    disabled={computedInitialBalances.isAutomatic}
                                    onChange={(event) => setManualStartingBalanceDolares(event.target.value)}
                                />
                            </div>

                            <div className="filter-box">
                                <label htmlFor="startingBalancePesos">Saldo inicial en pesos</label>
                                <input
                                    id="startingBalancePesos"
                                    className="filter-control"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={
                                        computedInitialBalances.isAutomatic
                                            ? computedInitialBalances.pesos
                                            : manualStartingBalancePesos
                                    }
                                    disabled={computedInitialBalances.isAutomatic}
                                    onChange={(event) => setManualStartingBalancePesos(event.target.value)}
                                />
                            </div>

                            {computedInitialBalances.isAutomatic && (
                                <div className="home-balance-auto-chip">
                                    <span className="material-icons-outlined">sync_alt</span>
                                    Saldo inicial automático
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="home-table-panel">
                        <div className="table-wrapper home-table-wrapper">
                            <table className="home-excel-table">
                                <thead>
                                    <tr>
                                        <th rowSpan="2">Fecha</th>
                                        <th rowSpan="2">Folio</th>
                                        <th rowSpan="2">Descripción</th>
                                        <th colSpan="2" className="home-th-income">Ingreso</th>
                                        <th colSpan="2" className="home-th-expense">Egreso</th>
                                        <th colSpan="2" className="home-th-balance">Saldo</th>
                                    </tr>
                                    <tr className="home-currency-head">
                                        <th>Dólares</th>
                                        <th>Pesos</th>
                                        <th>Dólares</th>
                                        <th>Pesos</th>
                                        <th>Dólares</th>
                                        <th>Pesos</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan="9" className="home-empty-row">
                                                Cargando movimientos...
                                            </td>
                                        </tr>
                                    ) : apiError ? (
                                        <tr>
                                            <td colSpan="9" className="home-empty-row">
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
                                                    <td>--</td>
                                                    <td>--</td>
                                                    <td>--</td>
                                                    <td>--</td>
                                                    <td>{renderCurrencyAmount(row.saldoDolares, 'dolares')}</td>
                                                    <td>{renderCurrencyAmount(row.saldoPesos, 'pesos')}</td>
                                                </tr>
                                            ))}

                                            <tr>
                                                <td colSpan="9" className="home-empty-row">
                                                    No hay ingresos ni egresos registrados en esta semana.
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
                                                            ? 'home-row-ingreso'
                                                            : 'home-row-egreso'
                                                }
                                            >
                                                <td>{row.fecha}</td>
                                                <td>{row.folio}</td>
                                                <td>{row.descripcion}</td>
                                                <td>{renderMovementAmount(row.ingresoDolares, 'dolares')}</td>
                                                <td>{renderMovementAmount(row.ingresoPesos, 'pesos')}</td>
                                                <td>{renderMovementAmount(row.egresoDolares, 'dolares')}</td>
                                                <td>{renderMovementAmount(row.egresoPesos, 'pesos')}</td>
                                                <td>{renderCurrencyAmount(row.saldoDolares, 'dolares')}</td>
                                                <td>{renderCurrencyAmount(row.saldoPesos, 'pesos')}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>

                                <tfoot>
                                    <tr>
                                        <td colSpan="3">Totales de la semana</td>
                                        <td>{renderCurrencyAmount(totals.totalIngresosDolares, 'dolares')}</td>
                                        <td>{renderCurrencyAmount(totals.totalIngresosPesos, 'pesos')}</td>
                                        <td>{renderCurrencyAmount(totals.totalEgresosDolares, 'dolares')}</td>
                                        <td>{renderCurrencyAmount(totals.totalEgresosPesos, 'pesos')}</td>
                                        <td>{renderCurrencyAmount(totals.finalBalanceDolares, 'dolares')}</td>
                                        <td>{renderCurrencyAmount(totals.finalBalancePesos, 'pesos')}</td>
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
