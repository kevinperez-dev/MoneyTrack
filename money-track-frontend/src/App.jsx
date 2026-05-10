// Archivo: src/App.jsx
// Propósito: definir las rutas principales del frontend, incluyendo reportes separados por ingresos y egresos.
import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Reports from './pages/Reports.jsx';
import { logoutSession } from './utils/common.js';

function App() {
  // Cierra sesión después de 15 minutos de inactividad
  useEffect(() => {
    const maxInactiveTime = 15 * 60 * 1000;

    const updateActivity = () => {
      if (sessionStorage.getItem('pegasoAuth') === '1') {
        sessionStorage.setItem('pegasoLastActivity', String(Date.now()));
      }
    };

    const checkInactiveSession = () => {
      const lastActivity = Number(sessionStorage.getItem('pegasoLastActivity') || 0);

      if (!lastActivity) return;

      const inactiveTime = Date.now() - lastActivity;

      if (inactiveTime >= maxInactiveTime) {
        logoutSession();
        window.location.href = '/login';
      }
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    events.forEach((eventName) => {
      window.addEventListener(eventName, updateActivity);
    });

    const intervalId = window.setInterval(checkInactiveSession, 30000);

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, updateActivity);
      });

      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/inicio" replace />} />

        <Route path="/login" element={<Login />} />
        <Route path="/inicio" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Rutas separadas para reportes desde el menú desplegable del header */}
        <Route path="/reports" element={<Navigate to="/reports/ingresos" replace />} />
        <Route path="/reports/ingresos" element={<Reports reportType="ingreso" />} />
        <Route path="/reports/egresos" element={<Reports reportType="egreso" />} />
        <Route path="/reports/cancelados" element={<Reports reportType="cancelado" />} />

        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
