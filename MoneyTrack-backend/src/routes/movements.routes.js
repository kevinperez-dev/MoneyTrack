// Archivo: src/routes/movements.routes.js
// Propósito: definir rutas protegidas para movimientos

const express = require('express');
const { getMovements, createMovement } = require('../controllers/movements.controller');

const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

// Todas las rutas de movimientos requieren sesión válida
router.get('/', authMiddleware, getMovements);
router.post('/', authMiddleware, createMovement);

module.exports = router;
