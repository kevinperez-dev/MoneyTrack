// Archivo: src/controllers/movements.controller.js
// Propósito: controlar movimientos protegidos con usuario autenticado

const pool = require('../config/db');

// Obtener todos los movimientos
async function getMovements(req, res) {
  try {
    const result = await pool.query(`
      SELECT 
        m.id,
        m.tipo,
        m.fecha,
        m.folio,
        m.nombre,
        m.descripcion,
        m.cantidad,
        m.moneda,
        m.created_by,
        u.username AS created_by_username,
        m.created_at
      FROM movements m
      LEFT JOIN users u ON u.id = m.created_by
      ORDER BY m.fecha DESC, m.id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    res.status(500).json({
      message: 'Error al obtener movimientos.',
    });
  }
}

// Crear un nuevo movimiento
async function createMovement(req, res) {
  try {
    const { tipo, fecha, folio, nombre, descripcion, cantidad, moneda } = req.body;

    // Validar campos obligatorios
    if (!tipo || !fecha || !folio || !nombre || !descripcion || !cantidad || !moneda) {
      return res.status(400).json({
        message: 'Todos los campos son obligatorios.',
      });
    }

    // Insertar movimiento con el usuario autenticado
    const result = await pool.query(
      `
      INSERT INTO movements (
        tipo,
        fecha,
        folio,
        nombre,
        descripcion,
        cantidad,
        moneda,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [tipo, fecha, folio, nombre, descripcion, cantidad, moneda, req.user.id],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear movimiento:', error);

    // Error de folio duplicado
    if (error.code === '23505') {
      return res.status(409).json({
        message: 'El folio ya existe.',
      });
    }

    res.status(500).json({
      message: 'Error al crear movimiento.',
    });
  }
}

module.exports = {
  getMovements,
  createMovement,
};
