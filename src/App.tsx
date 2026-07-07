import { useState } from 'react';
import Welcome from './views/Welcome';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState<string>('welcome');

  const handleNavigate = (view: string) => {
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

  return (
    <main>
      {currentView === 'welcome' && <Welcome onNavigate={handleNavigate} />}
      {currentView === 'wallet' && renderPlaceholder('Billetera (Wallet)', '6, 182, 212')}
      {currentView === 'p2p' && renderPlaceholder('Comercio P2P', '16, 185, 129')}
      {currentView === 'admin' && renderPlaceholder('Panel de Administración', '239, 68, 68')}
      {currentView === 'login' && renderPlaceholder('Iniciar Sesión (Login)', '168, 85, 247')}
      {currentView === 'invitado' && renderPlaceholder('Acceso de Invitado', '245, 158, 11')}
    </main>
  );
}

export default App;
