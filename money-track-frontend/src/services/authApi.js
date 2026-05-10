// Archivo: src/services/authApi.js
// Propósito: centralizar las peticiones de autenticación hacia el backend

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Función para hacer peticiones con tiempo límite
async function fetchWithTimeout(url, options = {}, timeoutMs = 60000) {
  const controller = new AbortController();

  // Cancela la petición si tarda demasiado
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`El backend tardó demasiado en responder: ${API_BASE_URL}`, {
        cause: error,
      });
    }

    throw new Error(`No se pudo conectar con el backend configurado: ${API_BASE_URL}`, {
      cause: error,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Lee la respuesta JSON de forma segura
async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

// Iniciar sesión
export async function loginUser(username, password) {
  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'Usuario o contraseña incorrectos.');
  }

  return data;
}

// Obtener sesión actual
export async function getCurrentSession() {

  // Obtiene el token guardado solo para la sesión actual
const token = sessionStorage.getItem('pegasoToken');

  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'Sesión inválida.');
  }

  return data;
}