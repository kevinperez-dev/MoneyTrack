// Archivo: src/components/Header.jsx
// Propósito: header general reutilizable con dropdown solo en Movimientos

import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { getCurrentUser, logoutSession } from '../utils/common.js';

function Header({ activePage = '', movementType = 'ingreso', onMovementTypeChange }) {
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Cierra sesión y regresa al login
    const handleLogout = (event) => {
        event.preventDefault();

        logoutSession();
        navigate('/login', { replace: true });
    };

    // Cambia a la vista de movimientos según el tipo seleccionado
    const handleMovementClick = (type) => {
        setIsMenuOpen(false);

        if (onMovementTypeChange) {
            onMovementTypeChange(type);
            return;
        }

        navigate(`/dashboard?tipo=${type}`);
    };

    return (
        <header className="topbar">
            <div className="topbar-left">
                <div className="brand">
                    <img src="/logo-sinFondo.png" alt="Logo" className="brand-logo" />
                    <span className="brand-name">MoneyTrack</span>
                </div>

                <nav className="top-nav">
                    <Link
                        to="/inicio"
                        className={`top-nav-link ${activePage === 'inicio' ? 'active' : ''}`}
                    >
                        <span>Inicio</span>
                    </Link>

                    <div className={`top-nav-dropdown ${isMenuOpen ? 'open' : ''}`}>
                        <button
                            type="button"
                            className={`top-nav-link top-nav-dropdown-toggle ${activePage === 'movimientos' ? 'active' : ''}`}
                            onClick={() => setIsMenuOpen((current) => !current)}
                        >
                            <span>Movimientos</span>
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

                    <Link
                        to="/reports"
                        className={`top-nav-link ${activePage === 'reportes' ? 'active' : ''}`}
                    >
                        <span>Reportes</span>
                    </Link>

                    <a href="#" className="top-nav-link">
                        <span>Documentos</span>
                    </a>
                </nav>
            </div>

            <div className="topbar-right">
                <div className="topbar-search">
                    <input type="text" placeholder="Buscar código" />
                    <button type="button" aria-label="Buscar">
                        <span className="material-icons-outlined">search</span>
                    </button>
                </div>

                <div className="user-box">
                    <span>{getCurrentUser()}</span>
                </div>

                <a href="#" className="logout-link" onClick={handleLogout}>
                    Cerrar sesión
                </a>
            </div>
        </header>
    );
}

export default Header;