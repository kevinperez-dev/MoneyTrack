// Archivo: src/components/Header.jsx
// Propósito: header general reutilizable con submenús para Movimientos y Reportes.

import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { getCurrentUser, logoutSession } from '../utils/session.js';

function Header({
    activePage = '',
    movementType = 'ingreso',
    reportType = 'ingreso',
    onMovementTypeChange,
    onReportTypeChange
}) {
    const navigate = useNavigate();
    const [isMovementsMenuOpen, setIsMovementsMenuOpen] = useState(false);
    const [isReportsMenuOpen, setIsReportsMenuOpen] = useState(false);

    // Cierra sesión y regresa al login.
    const handleLogout = (event) => {
        event.preventDefault();

        logoutSession();
        navigate('/login', { replace: true });
    };

    // Cambia a la vista de movimientos según el tipo seleccionado.
    const handleMovementClick = (type) => {
        setIsMovementsMenuOpen(false);
        setIsReportsMenuOpen(false);

        if (onMovementTypeChange) {
            onMovementTypeChange(type);
            return;
        }

        navigate(`/dashboard?tipo=${type}`);
    };

    // Cambia a la vista de reportes según el tipo seleccionado.
    const handleReportClick = (type) => {
        setIsReportsMenuOpen(false);
        setIsMovementsMenuOpen(false);

        if (onReportTypeChange) {
            onReportTypeChange(type);
            return;
        }

        if (type === 'egreso') {
            navigate('/reports/egresos');
            return;
        }

        if (type === 'cancelado') {
            navigate('/reports/cancelados');
            return;
        }

        navigate('/reports/ingresos');
    };

    // Abre o cierra el submenú de movimientos y cierra el de reportes.
    const toggleMovementsMenu = () => {
        setIsMovementsMenuOpen((current) => !current);
        setIsReportsMenuOpen(false);
    };

    // Abre o cierra el submenú de reportes y cierra el de movimientos.
    const toggleReportsMenu = () => {
        setIsReportsMenuOpen((current) => !current);
        setIsMovementsMenuOpen(false);
    };

    return (
        <header className="topbar">
            <div className="topbar-shell">
                <Link to="/inicio" className="brand" aria-label="Ir a Inicio">
                    <span className="brand-logo-frame">
                        <img src="/snoopy-laptop-removebg-preview.png" alt="Snoopy Project" className="brand-logo" />
                    </span>

                    <span className="brand-copy">
                        <span className="brand-name">Snoopy Project</span>
                        <span className="brand-subtitle">Control de ingresos y egresos</span>
                    </span>
                </Link>

                <nav className="top-nav" aria-label="Navegación principal">
                    <Link
                        to="/inicio"
                        className={`top-nav-link ${activePage === 'inicio' ? 'active' : ''}`}
                    >
                        <span className="material-icons-outlined top-nav-icon">dashboard</span>
                        <span>Inicio</span>
                    </Link>

                    <div className={`top-nav-dropdown ${isMovementsMenuOpen ? 'open' : ''}`}>
                        <button
                            type="button"
                            className={`top-nav-link top-nav-dropdown-toggle ${activePage === 'movimientos' ? 'active' : ''}`}
                            onClick={toggleMovementsMenu}
                        >
                            <span className="top-nav-text">
                                <span className="material-icons-outlined top-nav-icon">swap_vert</span>
                                <span>Movimientos</span>
                            </span>
                            <span className="material-icons-outlined top-nav-mini-caret">expand_more</span>
                        </button>

                        <div className="top-nav-dropdown-menu">
                            <button
                                type="button"
                                className={`top-nav-dropdown-item ${movementType === 'ingreso' ? 'active' : ''}`}
                                onClick={() => handleMovementClick('ingreso')}
                            >
                                <span className="material-icons-outlined">south_west</span>
                                Ingresos
                            </button>

                            <button
                                type="button"
                                className={`top-nav-dropdown-item ${movementType === 'egreso' ? 'active' : ''}`}
                                onClick={() => handleMovementClick('egreso')}
                            >
                                <span className="material-icons-outlined">north_east</span>
                                Egresos
                            </button>
                        </div>
                    </div>

                    <div className={`top-nav-dropdown ${isReportsMenuOpen ? 'open' : ''}`}>
                        <button
                            type="button"
                            className={`top-nav-link top-nav-dropdown-toggle ${activePage === 'reportes' ? 'active' : ''}`}
                            onClick={toggleReportsMenu}
                        >
                            <span className="top-nav-text">
                                <span className="material-icons-outlined top-nav-icon">assessment</span>
                                <span>Reportes</span>
                            </span>
                            <span className="material-icons-outlined top-nav-mini-caret">expand_more</span>
                        </button>

                        <div className="top-nav-dropdown-menu">
                            <button
                                type="button"
                                className={`top-nav-dropdown-item ${reportType === 'ingreso' ? 'active' : ''}`}
                                onClick={() => handleReportClick('ingreso')}
                            >
                                <span className="material-icons-outlined">south_west</span>
                                Ingresos
                            </button>

                            <button
                                type="button"
                                className={`top-nav-dropdown-item ${reportType === 'egreso' ? 'active' : ''}`}
                                onClick={() => handleReportClick('egreso')}
                            >
                                <span className="material-icons-outlined">north_east</span>
                                Egresos
                            </button>

                            <button
                                type="button"
                                className={`top-nav-dropdown-item ${reportType === 'cancelado' ? 'active' : ''}`}
                                onClick={() => handleReportClick('cancelado')}
                            >
                                <span className="material-icons-outlined">block</span>
                                Historial
                            </button>
                        </div>
                    </div>
                </nav>

                <div className="topbar-actions">
                    <div className="user-box" title="Usuario activo">
                        <span className="material-icons-outlined user-box-icon">person</span>
                        <span>{getCurrentUser()}</span>
                    </div>

                    <button type="button" className="logout-link" onClick={handleLogout}>
                        <span className="material-icons-outlined">logout</span>
                        <span>Cerrar sesión</span>
                    </button>
                </div>
            </div>
        </header>
    );
}

export default Header;
