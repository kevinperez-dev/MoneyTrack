// Archivo: src/services/movementsApi.js
// Propósito: conectar React con la API protegida de movimientos

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Obtener token guardado después del login
function getAuthToken() {
  return localStorage.getItem('pegasoToken');
}

// Normalizar datos recibidos desde PostgreSQL
function normalizeMovement(item) {
  return {
    ...item,
    fecha: String(item.fecha).split('T')[0],
    cantidad: Number(item.cantidad),
  };
}

// Obtener movimientos desde PostgreSQL
export async function getMovements() {
  const response = await fetch(`${API_BASE_URL}/movements`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron obtener los movimientos.');
  }

  return data.map(normalizeMovement);
}

// Crear movimiento en PostgreSQL
export async function createMovement(movement) {
  const response = await fetch(`${API_BASE_URL}/movements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify(movement),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo guardar el movimiento.');
  }

  return normalizeMovement(data);
}
