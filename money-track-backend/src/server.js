// Archivo: src/server.js
// Propósito: levantar API Express con autenticación, CORS y rutas protegidas

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const movementsRoutes = require('./routes/movements.routes');

const app = express();
const PORT = process.env.PORT || 4000;

// Convierte FRONTEND_URL en una lista de orígenes permitidos.
// Ejemplo en Render:
// FRONTEND_URL=http://localhost:5173,https://tu-proyecto.vercel.app
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Configuración de CORS para permitir conexión con React local y producción
app.use(
  cors({
    origin(origin, callback) {
      // Permite llamadas sin origin, útil para pruebas con Postman o health checks
      if (!origin) {
        return callback(null, true);
      }

      // Permite solo los dominios configurados en FRONTEND_URL
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
  }),
);

// Permitir recibir JSON desde React
app.use(express.json());

// Ruta raíz para comprobar que la API está viva
app.get('/', (req, res) => {
  res.json({
    message: 'API Pegasso Packing funcionando correctamente.',
  });
});

// Ruta de salud útil para Render
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'pegasso-packing-backend',
  });
});

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas protegidas de movimientos
app.use('/api/movements', movementsRoutes);

// Levantar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});