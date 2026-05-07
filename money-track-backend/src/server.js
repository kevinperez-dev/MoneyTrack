// Archivo: src/server.js
// Propósito: levantar la API de MoneyTrack con rutas, CORS y endpoint de salud

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const movementsRoutes = require('./routes/movements.routes');

const app = express();
const PORT = process.env.PORT || 4000;

// Convierte FRONTEND_URL en una lista de orígenes permitidos.
// Ejemplo:
// FRONTEND_URL=http://localhost:5173,https://money-track-roan.vercel.app
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Configuración de CORS para permitir frontend local y frontend desplegado
app.use(
  cors({
    origin(origin, callback) {
      // Permite peticiones sin origen, por ejemplo PowerShell, Postman o monitores externos
      if (!origin) {
        return callback(null, true);
      }

      // Permite solo URLs configuradas en FRONTEND_URL
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
  }),
);

// Permite recibir JSON desde el frontend
app.use(express.json());

// Ruta raíz para verificar rápido que la API está publicada
app.get('/', (req, res) => {
  res.json({
    message: 'API MoneyTrack funcionando correctamente.',
  });
});

// Ruta de salud para Render, UptimeRobot o cron-job.org
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'moneytrack-backend',
    timestamp: new Date().toISOString(),
  });
});

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas protegidas de movimientos
app.use('/api/movements', movementsRoutes);

// Respuesta para rutas inexistentes
app.use((req, res) => {
  res.status(404).json({
    message: 'Ruta no encontrada.',
    path: req.originalUrl,
  });
});

// Manejo global de errores para responder en JSON
app.use((error, req, res, next) => {
  console.error('Error global del servidor:', {
    message: error.message,
    path: req.originalUrl,
    method: req.method,
  });

  res.status(500).json({
    message: 'Error interno del servidor.',
    error: error.message,
  });
});

// Levanta el servidor usando el puerto asignado por Render o 4000 local
app.listen(PORT, () => {
  console.log(`Servidor MoneyTrack corriendo en puerto ${PORT}`);
});