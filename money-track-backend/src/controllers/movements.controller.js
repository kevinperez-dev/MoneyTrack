// Archivo: src/controllers/movements.controller.js
// Propósito: controlar movimientos protegidos con usuario autenticado.

const pool = require('../config/db');

// Tipos válidos que acepta la tabla movements.
const VALID_TYPES = ['ingreso', 'egreso'];

// Monedas válidas que acepta la tabla movements.
const VALID_CURRENCIES = ['Pesos', 'Dólares'];

// Normaliza y valida los datos de un movimiento antes de guardar o actualizar.
function validateMovementPayload(payload) {
  const tipo = String(payload.tipo || '').trim();
  const fecha = String(payload.fecha || '').trim();
  const folio = String(payload.folio || '').trim();
  const nombre = String(payload.nombre || '').trim();
  const descripcion = String(payload.descripcion || '').trim();
  const cantidad = Number(payload.cantidad);
  const moneda = String(payload.moneda || '').trim();

  if (!tipo || !fecha || !folio || !nombre || !descripcion || !payload.cantidad || !moneda) {
    return {
      hasError: true,
      message: 'Todos los campos son obligatorios.',
    };
  }

  if (!VALID_TYPES.includes(tipo)) {
    return {
      hasError: true,
      message: 'El tipo de movimiento no es válido.',
    };
  }

  if (!VALID_CURRENCIES.includes(moneda)) {
    return {
      hasError: true,
      message: 'La moneda seleccionada no es válida.',
    };
  }

  if (Number.isNaN(cantidad) || cantidad <= 0) {
    return {
      hasError: true,
      message: 'La cantidad debe ser mayor a 0.',
    };
  }

  return {
    hasError: false,
    data: {
      tipo,
      fecha,
      folio,
      nombre,
      descripcion,
      cantidad,
      moneda,
    },
  };
}

// Valida que el parámetro id sea numérico antes de consultar PostgreSQL.
function getValidMovementId(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({
      message: 'El identificador del movimiento no es válido.',
    });
    return null;
  }

  return id;
}

// Obtener todos los movimientos.
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

// Crear un nuevo movimiento.
async function createMovement(req, res) {
  try {
    const validation = validateMovementPayload(req.body);

    if (validation.hasError) {
      return res.status(400).json({
        message: validation.message,
      });
    }

    const { tipo, fecha, folio, nombre, descripcion, cantidad, moneda } = validation.data;

    // Inserta el movimiento con el usuario autenticado.
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

    // Error de folio duplicado.
    if (error.code === '23505') {
      return res.status(409).json({
        message: 'El folio ya existe.',
      });
    }

    // Error por restricción CHECK de PostgreSQL.
    if (error.code === '23514') {
      return res.status(400).json({
        message: 'Los datos del movimiento no cumplen con las reglas permitidas.',
      });
    }

    res.status(500).json({
      message: 'Error al crear movimiento.',
    });
  }
}

// Actualizar un movimiento existente desde Reportes.
async function updateMovement(req, res) {
  try {
    const id = getValidMovementId(req, res);
    if (!id) return undefined;

    const validation = validateMovementPayload(req.body);

    if (validation.hasError) {
      return res.status(400).json({
        message: validation.message,
      });
    }

    const { tipo, fecha, folio, nombre, descripcion, cantidad, moneda } = validation.data;

    // Actualiza el movimiento completo y regresa el registro modificado.
    const result = await pool.query(
      `
      UPDATE movements
      SET
        tipo = $1,
        fecha = $2,
        folio = $3,
        nombre = $4,
        descripcion = $5,
        cantidad = $6,
        moneda = $7
      WHERE id = $8
      RETURNING *
      `,
      [tipo, fecha, folio, nombre, descripcion, cantidad, moneda, id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: 'No se encontró el movimiento que deseas modificar.',
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar movimiento:', error);

    // Error de folio duplicado.
    if (error.code === '23505') {
      return res.status(409).json({
        message: 'El folio ya existe en otro movimiento.',
      });
    }

    // Error por restricción CHECK de PostgreSQL.
    if (error.code === '23514') {
      return res.status(400).json({
        message: 'Los datos del movimiento no cumplen con las reglas permitidas.',
      });
    }

    res.status(500).json({
      message: 'Error al actualizar movimiento.',
    });
  }
}

// Eliminar un movimiento existente desde Reportes.
async function deleteMovement(req, res) {
  try {
    const id = getValidMovementId(req, res);
    if (!id) return undefined;

    // Elimina definitivamente el movimiento de PostgreSQL.
    const result = await pool.query(
      `
      DELETE FROM movements
      WHERE id = $1
      RETURNING id, folio
      `,
      [id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: 'No se encontró el movimiento que deseas eliminar.',
      });
    }

    res.json({
      message: 'Movimiento eliminado correctamente.',
      movement: result.rows[0],
    });
  } catch (error) {
    console.error('Error al eliminar movimiento:', error);
    res.status(500).json({
      message: 'Error al eliminar movimiento.',
    });
  }
}

module.exports = {
  getMovements,
  createMovement,
  updateMovement,
  deleteMovement,
};
