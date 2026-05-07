// Archivo: src/routes/movements.routes.js
// Propósito: definir rutas protegidas para consultar, crear, modificar y eliminar movimientos.

const express = require('express');
const {
  getMovements,
  createMovement,
  updateMovement,
  deleteMovement,
} = require('../controllers/movements.controller');

const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

// Todas las rutas de movimientos requieren sesión válida.
router.get('/', authMiddleware, getMovements);
router.post('/', authMiddleware, createMovement);
router.put('/:id', authMiddleware, updateMovement);
router.delete('/:id', authMiddleware, deleteMovement);

module.exports = router;
