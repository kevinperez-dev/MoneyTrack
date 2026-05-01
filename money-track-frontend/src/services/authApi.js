// Archivo: src/services/authApi.js
// Propósito: centralizar las peticiones de autenticación hacia el backend de MoneyTrack

// URL base de la API.
// En local usa localhost.
// En producción Vercel debe usar VITE_API_URL=https://moneytrack-api.onrender.com/api
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Función para hacer peticiones fetch con tiempo límite.
// Esto evita que el login se quede esperando indefinidamente si el backend no responde.
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();

  // Temporizador que cancela la petición si tarda demasiado
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    // Ejecutar la petición HTTP con soporte de cancelación
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    return response;
  } catch (error) {
    // Mostrar un error claro si la petición fue cancelada por tardar demasiado
    if (error.name === 'AbortError') {
      throw new Error(
        `El backend tardó demasiado en responder. Backend configurado: ${API_BASE_URL}`,
        {
          cause: error,
        },
      );
    }

    // Mostrar un error claro si no se pudo conectar al backend configurado
    throw new Error(`No se pudo conectar con el backend configurado: ${API_BASE_URL}`, {
      cause: error,
    });
  } finally {
    // Limpiar el temporizador para evitar procesos pendientes
    clearTimeout(timeoutId);
  }
}

// Función para leer respuestas JSON sin romper la app si el backend responde vacío
async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

// Función para iniciar sesión contra el backend
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

  // Si el backend responde error, mostrar el mensaje enviado por la API
  if (!response.ok) {
    throw new Error(data.message || 'Usuario o contraseña incorrectos.');
  }

  return data;
}

// Función para validar la sesión actual usando el token guardado
export async function getCurrentSession() {
  const token = localStorage.getItem('pegasoToken');

  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await readJsonResponse(response);

  // Si el token no es válido, mostrar error de sesión
  if (!response.ok) {
    throw new Error(data.message || 'Sesión inválida.');
  }

  return data;
}