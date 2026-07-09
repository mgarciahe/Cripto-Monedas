import { useState, useEffect } from 'react';
import { signInWithGoogle } from '../services/auth';
import './Welcome.css';

interface WelcomeProps {
  onNavigate?: (view: string) => void;
}

export default function Welcome({ onNavigate }: WelcomeProps) {
  const [activeTab, setActiveTab] = useState<'wallet' | 'p2p' | 'admin'>('wallet');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Analizar hash de URL por si Supabase OAuth devuelve errores de Trigger/DB
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const errorDesc = params.get('error_description');
      const errorCode = params.get('error');
      if (errorCode || errorDesc) {
        let friendlyMsg = errorDesc || errorCode || 'Error de autenticación.';

        if (
          friendlyMsg.toLowerCase().includes('database') ||
          friendlyMsg.toLowerCase().includes('trigger') ||
          friendlyMsg.toLowerCase().includes('hook')
        ) {
          friendlyMsg = `Error de Base de Datos al registrar nuevo usuario: "${friendlyMsg}". Revisa la consistencia de las columnas en 'perfiles' y 'billeteras' para no abortar la transacción ACID de registro.`;
        }

        setErrorMsg(friendlyMsg);

        // Limpiar hash de la URL
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  const handleCopyAddress = () => {
    navigator.clipboard.writeText('0x71C...8971');
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleGoogleLogin = async () => {
    try {
      setErrorMsg(null);
      sessionStorage.setItem('oauth_mode', 'login');
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Error al iniciar sesión con Google:', err);
      setErrorMsg(err.message || 'Ocurrió un error inesperado al intentar iniciar sesión.');
    }
  };

  const viewsInfo = {
    wallet: {
      title: 'Billetera Crypto',
      description: 'Gestiona tus activos digitales, visualiza gráficos de rendimiento en tiempo real y realiza transferencias instantáneas con tarifas mínimas.',
      features: ['Balance Multimoneda', 'Historial de Transacciones', 'Gráficos Interactivos'],
      badge: 'Core'
    },
    p2p: {
      title: 'Comercio P2P',
      description: 'Compra y vende criptomonedas directamente con otros usuarios de forma segura mediante nuestro sistema de depósito en garantía.',
      features: ['Verificacion de usuarios', 'saldos congelados', 'compras efectivas'],
      badge: 'Seguro'
    },
    admin: {
      title: 'Panel de Administración',
      description: 'Control total de la plataforma: monitoreo de transacciones globales, gestión de usuarios, límites de retiro y control de liquidez.',
      features: ['Métricas del Sistema', 'Gestión de Usuarios', 'Verificacion de compras'],
      badge: 'Control'
    }
  };

  return (
    <div className="welcome-container">
      {/* Background glow effects */}
      <div className="glow-sphere glow-1"></div>
      <div className="glow-sphere glow-2"></div>

      {/* Navigation Header */}
      <header className="welcome-header animate-fade-in">
        <div className="logo-container">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="logo-text">Mi Billetera <span className="logo-highlight">Virtual</span></span>
        </div>
        {/* Acciones simplificadas y movidas al centro de la página */}
      </header>

      {/* Main Content Grid */}
      <main className="welcome-main">
        <section className="hero-section animate-slide-up">
          <h1 className="hero-title">
            La billetera del futuro, <br />
            <span className="gradient-text">en tus manos.</span>
          </h1>
          <p className="hero-subtitle">
            Una plataforma segura y ultrarrápida para gestionar tus activos, realizar intercambios de criptomonedas y monitorear el mercado cripto de forma en vivo.
          </p>
          <div className="hero-actions" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '1rem', marginTop: '2rem' }}>
            <button className="btn-hero-primary" onClick={() => onNavigate?.('register')}>
              Crear Cuenta
            </button>
            <button className="btn-hero-secondary" onClick={() => onNavigate?.('login')}>
              Iniciar Sesión
            </button>
            <button className="btn-hero-secondary" onClick={() => onNavigate?.('invitado')}>
              Iniciar Sesión como Invitado
            </button>
          </div>

          {errorMsg && (
            <div className="error-alert">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="error-icon" style={{ marginRight: '8px', flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Module Selector Showcase */}
          <div className="module-showcase">
            <h3>Explora la Arquitectura Modular</h3>
            <div className="tab-buttons">
              {(['wallet', 'p2p', 'admin'] as const).map((tab) => (
                <button
                  key={tab}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="tab-content glass-card">
              <div className="tab-header">
                <span className="tab-badge">{viewsInfo[activeTab].badge}</span>
                <h4>{viewsInfo[activeTab].title}</h4>
              </div>
              <p>{viewsInfo[activeTab].description}</p>
              <ul className="feature-list">
                {viewsInfo[activeTab].features.map((feature, idx) => (
                  <li key={idx}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="check-icon">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              {activeTab !== 'admin' && (
                <button className="btn-action" onClick={() => onNavigate?.('login')}>
                  Ir a la Vista {viewsInfo[activeTab].title}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Dynamic Interactive Wallet Mockup */}
        <section className="mockup-section animate-slide-up-delayed">
          <div className="phone-mockup glass-card">
            {/* Mockup Notch & Bar */}
            <div className="mockup-header">
              <span className="mockup-time">09:41</span>
              <div className="mockup-notch"></div>
              <div className="mockup-icons">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c3.9 3.9 10.2 3.9 14.1 0l1.78-1.78C21.46 16.07 22 14.12 22 12c0-4.97-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" /></svg>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17 5H7a3 3 0 00-3 3v8a3 3 0 003 3h10a3 3 0 003-3V8a3 3 0 00-3-3zm1 11a1 1 0 01-1 1H7a1 1 0 01-1-1V8a1 1 0 011-1h10a1 1 0 011 1v8z" /></svg>
              </div>
            </div>

            {/* Wallet Dashboard Screen */}
            <div className="mockup-body">
              {/* Wallet Balance Card */}
              <div className="balance-card">
                <div className="balance-header">
                  <span>Balance Principal</span>
                  <span className="wallet-tag">Personal</span>
                </div>
                <h2>$12,450.80 <span className="currency-label">USD</span></h2>
                <div className="wallet-address" onClick={handleCopyAddress}>
                  <span>0x71C...8971</span>
                  <button className="copy-btn" aria-label="Copy wallet address">
                    {copiedAddress ? '¡Copiado!' : (
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="quick-actions">
                <button className="action-item">
                  <div className="action-circle">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5"></line>
                      <polyline points="5 12 12 5 19 12"></polyline>
                    </svg>
                  </div>
                  <span>Enviar</span>
                </button>
                <button className="action-item">
                  <div className="action-circle">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <polyline points="19 12 12 19 5 12"></polyline>
                    </svg>
                  </div>
                  <span>Recibir</span>
                </button>
                <button className="action-item">
                  <div className="action-circle">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 2.1l4 4-4 4M3 21.9l-4-4 4-4M21 6H7.8A4.8 4.8 0 003 10.8v4.4M3 18h13.2a4.8 4.8 0 004.8-4.8V8.8" />
                    </svg>
                  </div>
                  <span>Intercambio</span>
                </button>
              </div>

              {/* Assets List */}
              <div className="assets-section">
                <div className="section-title">
                  <span>Tus Activos</span>
                  <a href="#assets" className="see-all">Ver todos</a>
                </div>
                <div className="asset-item">
                  <div className="asset-info">
                    <div className="asset-icon btc">₿</div>
                    <div>
                      <div className="asset-name">Bitcoin</div>
                      <div className="asset-amount">0.24 BTC</div>
                    </div>
                  </div>
                  <div className="asset-price-info">
                    <div className="asset-val">$9,144.20</div>
                    <div className="asset-change positive">+2.4%</div>
                  </div>
                </div>

                <div className="asset-item">
                  <div className="asset-info">
                    <div className="asset-icon eth">Ξ</div>
                    <div>
                      <div className="asset-name">Ethereum</div>
                      <div className="asset-amount">1.50 ETH</div>
                    </div>
                  </div>
                  <div className="asset-price-info">
                    <div className="asset-val">$2,850.50</div>
                    <div className="asset-change positive">+1.8%</div>
                  </div>
                </div>

                <div className="asset-item">
                  <div className="asset-info">
                    <div className="asset-icon sol">S</div>
                    <div>
                      <div className="asset-name">Solana</div>
                      <div className="asset-amount">3.20 SOL</div>
                    </div>
                  </div>
                  <div className="asset-price-info">
                    <div className="asset-val">$456.10</div>
                    <div className="asset-change negative">-0.5%</div>
                  </div>
                </div>
              </div>

              {/* Performance Mini-Chart simulation */}
              <div className="chart-preview">
                <div className="chart-header">
                  <span>Rendimiento Semanal</span>
                  <span className="chart-stat positive">+6.8%</span>
                </div>
                <div className="chart-graph">
                  <svg viewBox="0 0 100 30" className="sparkline">
                    <defs>
                      <linearGradient id="gradient-chart" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--neon-green)" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="var(--neon-green)" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 0 25 Q 15 10 30 18 T 60 8 T 80 12 T 100 3"
                      fill="none"
                      stroke="var(--neon-green)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 0 25 Q 15 10 30 18 T 60 8 T 80 12 T 100 3 L 100 30 L 0 30 Z"
                      fill="url(#gradient-chart)"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer info */}
      <footer className="welcome-footer animate-fade-in-delayed">
        <p>© 2026 Mi Billetera Virtual. Arquitectura modular React + TypeScript.</p>
        <div className="footer-links">
          <span>Wallet</span> • <span>P2P</span> • <span>Admin</span> • <span>Login</span> • <span>Invitado</span>
        </div>
      </footer>
    </div>
  );
}
