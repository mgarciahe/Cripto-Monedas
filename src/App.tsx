import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './services/supabase';
import Welcome from './views/Welcome';
import Dashboard from './views/Dashboard';
import MercadoP2P from './views/MercadoP2P';
import Login from './views/Login';
import AdminDashboard from './views/AdminDashboard';
import Profile from './views/Profile';
import Support from './views/Support';
import { getUserRole } from './services/auth';
import './App.css';

// Interceptar de forma síncrona la intención en la URL al cargar el JS
// antes de que Supabase reescriba la barra de direcciones
const urlParamsInit = new URLSearchParams(window.location.search);
const oauthModeFromUrl = urlParamsInit.get('oauth_mode');
if (oauthModeFromUrl) {
  sessionStorage.setItem('oauth_mode', oauthModeFromUrl);
}

function App() {
  // 1. Estado de la Sesión con tipado oficial de Supabase
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<string>('welcome');

  // Valida si la sesión es legítima para iniciar sesión (evita auto-registro con Google si es nuevo)
  const validateSession = async (s: Session): Promise<boolean> => {
    const user = s.user;
    
    // Obtener la intención desde sessionStorage
    const oauthMode = sessionStorage.getItem('oauth_mode');
    
    // Solo aplicar esta guardia a usuarios que vienen de OAuth con Google
    const isGoogleUser = user.app_metadata?.provider === 'google';
    if (!isGoogleUser) {
      // El usuario se registró manualmente con email/password: siempre permitir
      sessionStorage.removeItem('oauth_mode');
      return true;
    }

    // Si la cuenta de Google es nueva, created_at y last_sign_in_at tendrán la misma fecha o diferencia menor a 8s
    const isNewUser = user.created_at && user.last_sign_in_at && 
      (new Date(user.last_sign_in_at).getTime() - new Date(user.created_at).getTime() < 8000);

    if (isNewUser && (oauthMode === 'login' || !oauthMode)) {
      console.warn("Usuario nuevo de Google detectado intentando ingresar en iniciar sesión. Cancelando...");
      sessionStorage.removeItem('oauth_mode');
      
      // Cerrar sesión
      await supabase.auth.signOut();
      setSession(null);
      
      // Redirigir a registro
      setCurrentView('register');
      
      // Evitar alertas duplicadas mediante un lock en sessionStorage
      const hasAlerted = sessionStorage.getItem('has_alerted_unregistered');
      if (!hasAlerted) {
        sessionStorage.setItem('has_alerted_unregistered', 'true');
        alert("Esta cuenta de Google no está registrada. Por favor, regístrate primero.");
        setTimeout(() => {
          sessionStorage.removeItem('has_alerted_unregistered');
        }, 3000);
      }
      return false;
    }

    sessionStorage.removeItem('oauth_mode');
    return true;
  };

  // 2. Suscripción de Auth al montar la aplicación
  useEffect(() => {
    // Obtener la sesión actual inicialmente
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (currentSession) {
        const isValid = await validateSession(currentSession);
        if (isValid) {
          setSession(currentSession);
          getUserRole(currentSession.user.id).then((rol) => {
            setUserRole(rol || 'Usuario');
          });
        }
      } else {
        setSession(null);
        setUserRole(null);
      }
    });

    // Escuchar cambios de estado en la sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (currentSession) {
        const isValid = await validateSession(currentSession);
        if (isValid) {
          setSession(currentSession);
          getUserRole(currentSession.user.id).then((rol) => {
            setUserRole(rol || 'Usuario');
          });
        }
      } else {
        setSession(null);
        setUserRole(null);
      }
    });

    // Limpiar suscripción al desmontar
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Guardia de Ruta: Redirige a inicio si un no-administrador intenta acceder a la ruta admin
  useEffect(() => {
    if (currentView === 'admin') {
      if (!session) {
        setCurrentView('welcome');
      } else if (userRole?.toLowerCase() !== 'administrador' && userRole !== null) {
        console.warn("Acceso denegado: El usuario no posee privilegios de Administrador. Redirigiendo a Dashboard...");
        setCurrentView('welcome');
      }
    }
  }, [currentView, userRole, session]);

  const handleNavigate = (view: string) => {
    if (view === 'invitado') {
      const mockSession: Session = {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: 'guest-user-id',
          app_metadata: {},
          user_metadata: {
            full_name: 'Invitado',
            avatar_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&q=80'
          },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          email: 'invitado@billeteravirtual.com'
        }
      };
      setSession(mockSession);
      setUserRole('Usuario');
    } else if (view === 'welcome' && session?.user?.id === 'guest-user-id') {
      setSession(null);
      setUserRole(null);
    }
    setCurrentView(view);
  };

  // Helper function to render elegant mock views for each route
  const renderPlaceholder = (title: string, colorRGB: string) => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0b0813',
      color: '#f3f4f6',
      textAlign: 'center',
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: `rgba(${colorRGB}, 0.1)`,
        border: `1px solid rgba(${colorRGB}, 0.3)`,
        color: `rgb(${colorRGB})`,
        padding: '0.4rem 1rem',
        borderRadius: '20px',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        marginBottom: '1.5rem',
        letterSpacing: '1px'
      }}>
        MÓDULO EN CONSTRUCCIÓN
      </div>
      <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 800, letterSpacing: '-1px' }}>
        Vista {title}
      </h2>
      <p style={{ color: '#9ca3af', maxWidth: '500px', lineHeight: '1.6', marginBottom: '2.5rem', fontSize: '1.05rem' }}>
        Esta pantalla se vinculará a los controladores de estado en <code>/src/hooks</code> y a las conexiones a la API/Supabase en <code>/src/services</code> durante el desarrollo.
      </p>
      <button 
        onClick={() => setCurrentView('welcome')}
        style={{
          background: 'linear-gradient(135deg, #a855f7, #8b5cf6)',
          border: 'none',
          color: 'white',
          fontWeight: '600',
          fontSize: '0.95rem',
          padding: '0.8rem 1.6rem',
          borderRadius: '10px',
          cursor: 'pointer',
          boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(168, 85, 247, 0.45)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(168, 85, 247, 0.3)';
        }}
      >
        ← Volver al Inicio
      </button>
    </div>
  );

  // 3. Renderizado Condicional de Vistas según presencia de la sesión
  return (
    <main>
      {session ? (
        <>
          {currentView === 'welcome' && <Dashboard session={session} onNavigate={handleNavigate} userRole={userRole} />}
          {currentView === 'wallet' && renderPlaceholder('Billetera (Wallet)', '6, 182, 212')}
          {currentView === 'p2p' && <MercadoP2P session={session} onNavigate={handleNavigate} userRole={userRole} />}
          {currentView === 'admin' && <AdminDashboard session={session} onNavigate={handleNavigate} userRole={userRole} />}
          {currentView === 'profile' && <Profile session={session} onNavigate={handleNavigate} userRole={userRole} />}
          {currentView === 'support' && <Support session={session} onNavigate={handleNavigate} userRole={userRole} />}
          {(currentView === 'login' || currentView === 'register' || currentView === 'invitado') && <Dashboard session={session} onNavigate={handleNavigate} userRole={userRole} />}
        </>
      ) : (
        <>
          {currentView === 'welcome' && <Welcome onNavigate={handleNavigate} />}
          {currentView === 'wallet' && renderPlaceholder('Billetera (Wallet)', '6, 182, 212')}
          {currentView === 'p2p' && renderPlaceholder('Comercio P2P', '16, 185, 129')}
          {currentView === 'admin' && renderPlaceholder('Panel de Administración', '239, 68, 68')}
          {currentView === 'login' && <Login onNavigate={handleNavigate} initialRegisterMode={false} />}
          {currentView === 'register' && <Login onNavigate={handleNavigate} initialRegisterMode={true} />}
          {currentView === 'invitado' && renderPlaceholder('Acceso de Invitado', '245, 158, 11')}
        </>
      )}
    </main>
  );
}

export default App;
