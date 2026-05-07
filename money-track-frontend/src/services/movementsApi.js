// Archivo: src/services/movementsApi.js
// Propósito: conectar React con la API protegida de movimientos.

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Obtiene el token guardado después del login.
function getAuthToken() {
  return localStorage.getItem('pegasoToken');
}

// Normaliza datos recibidos desde PostgreSQL para usarlos en React.
function normalizeMovement(item) {
  return {
    ...item,
    fecha: String(item.fecha).split('T')[0],
    cantidad: Number(item.cantidad),
  };
}

// Lee el JSON de una respuesta y maneja respuestas vacías sin romper la app.
async function readJsonResponse(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

// Obtener movimientos desde PostgreSQL.
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

// Crear movimiento en PostgreSQL.
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

// Actualizar movimiento existente en PostgreSQL.
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

// Eliminar movimiento existente en PostgreSQL.
export async function deleteMovement(id) {
  const response = await fetch(`${API_BASE_URL}/movements/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo eliminar el movimiento.');
  }

  return data;
}
