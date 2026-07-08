import React, { useState, useEffect } from 'react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../services/auth';
import './Login.css';

interface LoginProps {
  onNavigate: (view: string) => void;
  initialRegisterMode?: boolean;
}

export default function Login({ onNavigate, initialRegisterMode }: LoginProps) {
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(!!initialRegisterMode);

  // Sincronizar el modo si cambia por navegación externa
  useEffect(() => {
    setIsRegisterMode(!!initialRegisterMode);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [initialRegisterMode]);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      await signInWithGoogle();
    } catch (err: unknown) {
      console.error('Error al iniciar sesión con Google:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error inesperado con Google Login.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Todos los campos son obligatorios.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (isRegisterMode && password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    try {
      setLoading(true);
      if (isRegisterMode) {
        // Registrar cuenta nueva con metadatos de nombre
        await signUpWithEmail(
          email.trim(), 
          password.trim(), 
          fullName.trim() || undefined
        );
        setSuccessMsg('¡Registro exitoso! Revisa tu bandeja de entrada para verificar tu cuenta (si tienes habilitada la confirmación por correo).');
        // Limpiar campos
        setPassword('');
        setConfirmPassword('');
        setFullName('');
      } else {
        // Iniciar sesión
        await signInWithEmail(email.trim(), password.trim());
      }
    } catch (err: unknown) {
      console.error('Error en autenticación:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al procesar la autenticación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Background glow elements */}
      <div className="login-glow glow-1"></div>
      <div className="login-glow glow-2"></div>

      <div className="login-card-wrapper">
        <button className="btn-back-home" onClick={() => onNavigate('welcome')}>
          ← Volver al Inicio
        </button>

        <div className="login-card glass-card">
          <div className="login-header">
            <h2 className="login-title">
              {isRegisterMode ? 'Crear una Cuenta' : 'Iniciar Sesión'}
            </h2>
            <p className="login-subtitle">
              {isRegisterMode 
                ? 'Regístrate para comenzar a gestionar tus criptoactivos en AetherWallet' 
                : 'Accede a tus saldos y opera en el mercado P2P'
              }
            </p>
          </div>

          {errorMsg && (
            <div className="login-alert error">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" className="alert-icon" style={{ marginRight: '6px' }}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="login-alert success">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" className="alert-icon" style={{ marginRight: '6px' }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleEmailAuth} className="login-form">
            {isRegisterMode && (
              <div className="form-group">
                <label htmlFor="fullName">Nombre Completo</label>
                <input
                  id="fullName"
                  type="text"
                  placeholder="ej. Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  className="form-input"
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Correo Electrónico</label>
              <input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="form-input"
                required
              />
            </div>

            {isRegisterMode && (
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirmar Contraseña</label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="form-input"
                  required
                />
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-auth-submit">
              {loading 
                ? 'Cargando...' 
                : (isRegisterMode ? 'Registrarse' : 'Ingresar')
              }
            </button>
          </form>

          {/* Línea divisoria */}
          <div className="auth-divider">
            <span>o continúa con</span>
          </div>

          {/* Botón de Google OAuth */}
          <button 
            type="button" 
            onClick={handleGoogleLogin} 
            disabled={loading} 
            className="btn-google-auth"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" className="google-icon-svg" style={{ marginRight: '8px' }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Google
          </button>

          {/* Toggle de Modo */}
          <div className="auth-toggle-mode">
            <span>
              {isRegisterMode ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta aún?'}
            </span>
            <button 
              type="button" 
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="btn-toggle-action"
            >
              {isRegisterMode ? 'Inicia Sesión' : 'Regístrate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
