// Archivo: src/services/authApi.js
// Propósito: manejar peticiones de autenticación hacia el backend con tiempo límite

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Ejecuta fetch con tiempo límite para evitar que el login se quede congelado
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();

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
      throw new Error('El servidor tardó demasiado en responder. Revisa backend o PostgreSQL.');
    }

    throw new Error(
      'No se pudo conectar con el backend. Revisa que esté corriendo en localhost:4000.',
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

// Lee una respuesta JSON de forma segura
async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

// Iniciar sesión contra PostgreSQL
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

// Validar la sesión actual usando el token
export async function getCurrentSession() {
  const token = localStorage.getItem('pegasoToken');

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
