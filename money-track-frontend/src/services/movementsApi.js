// Archivo: src/services/movementsApi.js
// Propósito: conectar React con la API protegida de movimientos y normalizar historial de ajustes.

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Propósito: obtener el token desde localStorage y mantener compatibilidad con sessionStorage.
function getAuthToken() {
  return localStorage.getItem('pegasoToken') || sessionStorage.getItem('pegasoToken');
}

// Propósito: convertir fechas del backend a formato YYYY-MM-DD para usarlas en formularios y tablas.
function normalizeDate(value) {
  if (!value) return null;
  return String(value).split('T')[0];
}

// Propósito: convertir números del backend sin romper cuando un valor es null.
function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  return Number(value);
}

// Propósito: normalizar datos recibidos desde PostgreSQL para usarlos en React.
function normalizeMovement(item) {
  return {
    ...item,
    fecha: normalizeDate(item.fecha),
    cantidad: Number(item.cantidad),
    created_at: item.created_at || null,
    fecha_anterior: normalizeDate(item.fecha_anterior),
    fecha_nueva: normalizeDate(item.fecha_nueva),
    cantidad_anterior: normalizeNumber(item.cantidad_anterior),
    cantidad_nueva: normalizeNumber(item.cantidad_nueva),
    fecha_ultima_edicion: normalizeDate(item.fecha_ultima_edicion),
  };
}

// Propósito: normalizar una fila del historial completo de ajustes.
function normalizeMovementEdit(item) {
  return {
    ...item,
    fecha: normalizeDate(item.fecha),
    fecha_anterior: normalizeDate(item.fecha_anterior),
    fecha_nueva: normalizeDate(item.fecha_nueva),
    cantidad_actual: normalizeNumber(item.cantidad_actual),
    cantidad_anterior: normalizeNumber(item.cantidad_anterior),
    cantidad_nueva: normalizeNumber(item.cantidad_nueva),
    edited_at: item.edited_at || null,
    fecha_edicion: normalizeDate(item.edited_at),
  };
}

// Propósito: leer el JSON de una respuesta y manejar respuestas vacías sin romper la app.
async function readJsonResponse(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

// Propósito: obtener movimientos desde PostgreSQL.
export async function getMovements() {
  const response = await fetch(`${API_BASE_URL}/movements`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron obtener los movimientos.');
  }

  return data.map(normalizeMovement);
}


// Propósito: obtener el historial completo de ajustes; puede filtrarse por tipo de movimiento.
export async function getMovementEditHistory(tipo = '') {
  const query = tipo ? `?tipo=${encodeURIComponent(tipo)}` : '';

  const response = await fetch(`${API_BASE_URL}/movements/edits/history${query}`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo obtener el historial de ajustes.');
  }

  return data.map(normalizeMovementEdit);
}

// Propósito: crear movimiento en PostgreSQL.
export async function createMovement(movement) {
  const response = await fetch(`${API_BASE_URL}/movements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify(movement),
  });

  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo guardar el movimiento.');
  }

  return normalizeMovement(data);
}

// Propósito: actualizar movimiento existente en PostgreSQL y recibir su último ajuste.
export async function updateMovement(id, movement) {
  const response = await fetch(`${API_BASE_URL}/movements/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify(movement),
  });

  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo actualizar el movimiento.');
  }

  return normalizeMovement(data);
}

// Propósito: cancelar movimiento existente en PostgreSQL sin eliminarlo físicamente.
export async function deleteMovement(id) {
  const response = await fetch(`${API_BASE_URL}/movements/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo cancelar el movimiento.');
  }

  return normalizeMovement(data.movement || data);
}
