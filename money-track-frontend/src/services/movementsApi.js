// Archivo: src/services/movementsApi.js
// Propósito: conectar React con la API protegida de movimientos.

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Propósito: obtener el token guardado por Login.jsx para llamar rutas protegidas.
function getAuthToken() {
  return localStorage.getItem('pegasoToken') || sessionStorage.getItem('pegasoToken') || '';
}

// Propósito: leer JSON sin romper la app cuando el backend responde vacío.
async function readJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

// Propósito: normalizar los datos recibidos desde PostgreSQL.
function normalizeMovement(item) {
  return {
    ...item,
    fecha: item?.fecha ? String(item.fecha).split('T')[0] : '',
    cantidad: Number(item?.cantidad || 0),
    moneda: item?.moneda || 'Pesos',
  };
}

// Propósito: aceptar respuestas tipo array o respuestas envueltas en propiedades comunes.
function normalizeMovementList(data) {
  if (Array.isArray(data)) {
    return data.map(normalizeMovement);
  }

  if (Array.isArray(data?.movements)) {
    return data.movements.map(normalizeMovement);
  }

  if (Array.isArray(data?.data)) {
    return data.data.map(normalizeMovement);
  }

  return [];
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

  return normalizeMovementList(data);
}

// Propósito: crear un movimiento en PostgreSQL.
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

// Propósito: actualizar un movimiento existente en PostgreSQL.
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

// Propósito: cancelar un movimiento sin eliminarlo de PostgreSQL.
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
