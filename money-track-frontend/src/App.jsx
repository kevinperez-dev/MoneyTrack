// Archivo: src/App.jsx
// Propósito: definir las rutas principales del frontend de MoneyTrack.

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Reports from './pages/Reports.jsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Propósito: enviar a inicio; si no hay sesión, Home redirige al login. */}
        <Route path="/" element={<Navigate to="/inicio" replace />} />

        {/* Propósito: rutas principales del sistema. */}
        <Route path="/login" element={<Login />} />
        <Route path="/inicio" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Propósito: rutas separadas para reportes desde el submenú del header. */}
        <Route path="/reports" element={<Navigate to="/reports/ingresos" replace />} />
        <Route path="/reports/ingresos" element={<Reports reportType="ingreso" />} />
        <Route path="/reports/egresos" element={<Reports reportType="egreso" />} />
        <Route path="/reports/cancelados" element={<Reports reportType="cancelado" />} />

        {/* Propósito: evitar que una ruta no registrada mande directo al login por error. */}
        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
