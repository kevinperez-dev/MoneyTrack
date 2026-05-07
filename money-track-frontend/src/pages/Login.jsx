// Archivo: src/pages/Login.jsx
// Propósito: pantalla de inicio de sesión conectada al backend de MoneyTrack

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../services/authApi';
import '../styles/login.css';

function Login() {
  const navigate = useNavigate();

  // Estado del formulario de login
  const [form, setForm] = useState({
    username: '',
    password: '',
  });

  // Estado para mensajes de error
  const [error, setError] = useState('');

  // Estado para bloquear el botón mientras se valida el usuario
  const [isLoading, setIsLoading] = useState(false);

  // Aplica la clase del fondo al body real del documento
  useEffect(() => {
    document.body.classList.remove(
      'pagina-dashboard',
      'pagina-reportes',
      'modo-ingreso',
      'modo-egreso',
    );

    document.body.classList.add('login-page');

    return () => {
      document.body.classList.remove('login-page');
    };
  }, []);

  // Actualiza los valores del formulario
  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  // Envía usuario y contraseña al backend
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.username.trim() || !form.password.trim()) {
      setError('Ingresa usuario y contraseña.');
      return;
    }

    try {
      // Activa estado de carga mientras se valida el usuario
      setIsLoading(true);
      setError('');

      const result = await loginUser(form.username.trim(), form.password.trim());

      // Guardar sesión recibida desde el backend
      localStorage.setItem('pegasoToken', result.token);
      localStorage.setItem('pegasoAuth', '1');
      localStorage.setItem('pegasoUser', result.user.username);
      localStorage.setItem('pegasoRole', result.user.role);

      navigate('/inicio', { replace: true });
    } catch (error) {
      // Mostrar en consola el error real para depurar conexión o credenciales
      console.error('Error al iniciar sesión:', error);

      setError(error.message || 'No se pudo iniciar sesión.');
    } finally {
      // Desactiva la carga aunque el login falle o sea exitoso
      setIsLoading(false);
    }
  };

  return (
    <main className="login-wrapper">
      <section className="login-card">
        <div className="login-brand">
          <img src="/logo-fondo.png" alt="MoneyTrack Logo" className="login-logo" />

          <div>
            <h1>Proyecto Web</h1>
            <p>Proyecto para la materia de Desarrollo web</p>
          </div>
        </div>

        {error && <div className="login-alert">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
          <div className="login-field">
            <label htmlFor="username">Usuario</label>

            <div className="input-wrap">
              <span className="material-icons-outlined">person</span>

              <input
                type="text"
                id="username"
                name="username"
                placeholder="Ingresa tu usuario"
                value={form.username}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="password">Contraseña</label>

            <div className="input-wrap">
              <span className="material-icons-outlined">lock</span>

              <input
                type="password"
                id="password"
                name="password"
                placeholder="Ingresa tu contraseña"
                value={form.password}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
          </div>

          <button type="submit" className="btn-login" disabled={isLoading}>
            <span className="material-icons-outlined">login</span>
            {isLoading ? 'Conectando con el servidor...' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default Login;