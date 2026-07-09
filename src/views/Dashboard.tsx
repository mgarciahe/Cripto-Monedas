import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { logout } from '../services/auth';
import { getWalletBalances } from '../services/supabase';
import type { Billetera } from '../services/supabase';
import { getCryptoPrices } from '../services/prices';
import type { PreciosCripto } from '../services/prices';
import { transferFunds, reloadBalance, buyCrypto, getTransactionHistory } from '../services/wallet';
import type { Movimiento } from '../services/wallet';
import './Dashboard.css';

interface DashboardProps {
  session: Session;
  onNavigate: (view: string) => void;
}

export default function Dashboard({ session, onNavigate }: DashboardProps) {
  // Estado dinámico para almacenar balances reales de Supabase
  const [billetera, setBilletera] = useState<Billetera | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Estado dinámico para los precios de criptomonedas en tiempo real
  const [precios, setPrecios] = useState<PreciosCripto | null>(null);
  
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados locales para el formulario de transferencia interactivo
  const [destinatarioId, setDestinatarioId] = useState('');
  const [monedaSeleccionada, setMonedaSeleccionada] = useState('balance_usd');
  const [montoTransferencia, setMontoTransferencia] = useState('');
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  // Estados locales para la recarga de saldo interactiva
  const [montoReload, setMontoReload] = useState('');
  const [reloadLoading, setReloadLoading] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [reloadSuccess, setReloadSuccess] = useState<string | null>(null);

  // Estados para simular datos de tarjeta (solo de vista, no guardados)
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');

  // Estados locales para la compra ficticia de criptomonedas
  const [selectedBuyCrypto, setSelectedBuyCrypto] = useState<'btc' | 'eth' | 'sol' | null>(null);
  const [usdBuyAmount, setUsdBuyAmount] = useState('');
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buySuccess, setBuySuccess] = useState<string | null>(null);

  // Estados para el historial de transacciones
  const [showTxHistory, setShowTxHistory] = useState<boolean>(false);
  const [transacciones, setTransacciones] = useState<Movimiento[]>([]);
  const [txHistoryLoading, setTxHistoryLoading] = useState<boolean>(false);
  const [txHistoryError, setTxHistoryError] = useState<string | null>(null);

  // Estados para las notificaciones
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [hasNewNotifications, setHasNewNotifications] = useState<boolean>(false);

  // Estados para controlar los modales del Sidebar / Saldo
  const [showReloadModal, setShowReloadModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);

  const user = session.user;
  const userMetadata = user.user_metadata;
  
  // Extraer datos del perfil de Google de forma segura
  const avatarUrl = userMetadata?.avatar_url || '';
  const fullName = userMetadata?.full_name || 'Usuario AetherWallet';
  const email = user.email || 'correo@ejemplo.com';

  // Función reutilizable para consultar balances (soporta recarga en segundo plano)
  const fetchWallet = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setErrorMsg(null);
      const data = await getWalletBalances(user.id);
      setBilletera(data);
    } catch (err: unknown) {
      console.error('Error al consultar balances en Supabase:', err);
      const msg = err instanceof Error ? err.message : 'Error al conectar con la base de datos de balances.';
      setErrorMsg(msg);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user.id]);

  // Función para obtener historial de movimientos
  const fetchTransactions = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setTxHistoryLoading(true);
      setTxHistoryError(null);
      const res = await getTransactionHistory(user.id);
      if (res.success && res.data) {
        setTransacciones(res.data);
        
        // Verificar si hay una transacción más nueva que la última vista
        const lastSeen = localStorage.getItem(`lastSeenTx:${user.id}`);
        if (res.data.length > 0) {
          const latestTxId = res.data[0].id;
          if (lastSeen !== latestTxId) {
            setHasNewNotifications(true);
          }
        }
      } else if (!res.success) {
        setTxHistoryError(res.message);
      }
    } catch (err: unknown) {
      console.error('Error al cargar historial de movimientos:', err);
      setTxHistoryError(err instanceof Error ? err.message : 'Error al obtener transacciones.');
    } finally {
      if (showLoading) setTxHistoryLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (showTxHistory) {
      fetchTransactions(true);
    }
  }, [showTxHistory, fetchTransactions]);

  useEffect(() => {
    // Carga inicial
    fetchWallet(true);
    fetchTransactions(false);

    // Polling en segundo plano cada 10 segundos
    const interval = setInterval(() => {
      fetchWallet(false);
      fetchTransactions(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchWallet, fetchTransactions]);

  useEffect(() => {
    let isMounted = true;

    const fetchPrices = async () => {
      try {
        const data = await getCryptoPrices();
        if (isMounted) {
          setPrecios(data);
        }
      } catch (err: unknown) {
        console.error('Error al cargar precios de CoinGecko:', err);
      }
    };

    fetchPrices();

    const interval = setInterval(fetchPrices, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleReloadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReloadError(null);
    setReloadSuccess(null);

    const amount = parseFloat(montoReload);
    if (isNaN(amount) || amount <= 0) {
      setReloadError('Por favor ingresa un monto válido mayor a cero.');
      return;
    }

    try {
      setReloadLoading(true);
      const res = await reloadBalance(user.id, amount);
      if (!res.success) {
        setReloadError(res.message);
      } else {
        setReloadSuccess(res.message);
        setMontoReload('');
        setCardNumber('');
        setCardName('');
        setCardCvv('');
        setCardExpiry('');
        // Recargar balances para actualizar en tiempo real
        await fetchWallet(false);
      }
    } catch (err: unknown) {
      console.error('Error al recargar saldo:', err);
      const msg = err instanceof Error ? err.message : 'Error inesperado al recargar saldo.';
      setReloadError(msg);
    } finally {
      setReloadLoading(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxError(null);
    setTxSuccess(null);

    const montoVal = parseFloat(montoTransferencia);
    if (!destinatarioId.trim()) {
      setTxError('El ID del destinatario (UUID) es obligatorio.');
      return;
    }
    if (isNaN(montoVal) || montoVal <= 0) {
      setTxError('Por favor, ingresa un monto válido mayor a cero.');
      return;
    }

    try {
      setTxLoading(true);
      const res = await transferFunds(
        user.id,
        destinatarioId.trim(),
        monedaSeleccionada,
        montoVal
      );

      if (!res.success) {
        setTxError(res.message);
      } else {
        setTxSuccess(res.message);
        setDestinatarioId('');
        setMontoTransferencia('');
        // Recargar balances de forma silenciosa para actualizar el panel en tiempo real
        await fetchWallet(false);
      }
    } catch (err: unknown) {
      console.error('Error durante la transacción:', err);
      const msg = err instanceof Error ? err.message : 'Ocurrió un error inesperado al procesar la transferencia.';
      setTxError(msg);
    } finally {
      setTxLoading(false);
    }
  };

  const handleBuySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuyError(null);
    setBuySuccess(null);

    if (!selectedBuyCrypto) return;
    if (!precios) {
      setBuyError('Los precios en vivo aún no están cargados. Intenta de nuevo.');
      return;
    }

    const usdVal = parseFloat(usdBuyAmount);
    if (isNaN(usdVal) || usdVal <= 0) {
      setBuyError('Por favor ingresa un monto válido mayor a cero.');
      return;
    }

    let coinPrice = 0;
    if (selectedBuyCrypto === 'btc') coinPrice = precios.bitcoin.usd;
    else if (selectedBuyCrypto === 'eth') coinPrice = precios.ethereum.usd;
    else if (selectedBuyCrypto === 'sol') coinPrice = precios.solana.usd;

    if (coinPrice <= 0) {
      setBuyError('El precio actual de cotización de la criptomoneda no es válido.');
      return;
    }

    try {
      setBuyLoading(true);
      const res = await buyCrypto(user.id, selectedBuyCrypto, usdVal, coinPrice);
      if (!res.success) {
        setBuyError(res.message);
      } else {
        setBuySuccess(res.message);
        setUsdBuyAmount('');
        // Recargar balances para actualizar en tiempo real
        await fetchWallet(false);
      }
    } catch (err: unknown) {
      console.error('Error al comprar criptomoneda:', err);
      const msg = err instanceof Error ? err.message : 'Error al procesar la compra.';
      setBuyError(msg);
    } finally {
      setBuyLoading(false);
    }
  };

  const handleToggleNotifications = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications && transacciones.length > 0) {
      localStorage.setItem(`lastSeenTx:${user.id}`, transacciones[0].id);
      setHasNewNotifications(false);
    }
  };

  const handleCopyWallet = () => {
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogoutClick = async () => {
    try {
      setErrorMsg(null);
      await logout();
    } catch (err: unknown) {
      console.error('Error al cerrar sesión:', err);
      const msg = err instanceof Error ? err.message : 'Error al intentar cerrar la sesión.';
      setErrorMsg(msg);
    }
  };

  return (
    <div className="dashboard-container-new">
      {/* Glow Ambient Effects */}
      <div className="dash-glow sphere-purple"></div>
      <div className="dash-glow sphere-cyan"></div>

      {/* 1. LEFT SIDEBAR */}
      <aside className="sidebar-container">
        <div className="sidebar-logo">
          <span className="logo-icon">▲</span> Mi Billetera Virtual
        </div>
        <nav className="sidebar-menu">
          <button className="menu-item active" onClick={() => onNavigate('welcome')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9" rx="1"></rect>
              <rect x="14" y="3" width="7" height="5" rx="1"></rect>
              <rect x="14" y="12" width="7" height="9" rx="1"></rect>
              <rect x="3" y="16" width="7" height="5" rx="1"></rect>
            </svg>
            Inicio
          </button>
          <button className="menu-item" onClick={() => setShowReloadModal(true)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="12" y1="17" x2="12" y2="17"></line>
              <path d="M12 9v4M10 11h4"></path>
            </svg>
            Cargar Billetera
          </button>
          <button className="menu-item" onClick={() => setShowTransferModal(true)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            Transferir Fondos
          </button>
          <button className="menu-item" onClick={() => onNavigate('p2p')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 2.1l4 4-4 4M3 21.9l-4-4 4-4M21 6H7.8A4.8 4.8 0 003 10.8v4.4M3 18h13.2a4.8 4.8 0 004.8-4.8V8.8" />
            </svg>
            Comercio de Criptomonedas
          </button>
          <button className="menu-item" onClick={() => setShowTxHistory(true)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            Historial
          </button>
        </nav>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="main-content-wrapper">
        {/* Header Panel */}
        <header className="dashboard-header-premium">
          <h2 className="header-title">Billetera Virtual</h2>
          <div className="header-right">
            {/* Campana de Notificaciones */}
            <div className="notifications-bell-container" style={{ position: 'relative' }}>
              <button className="bell-button" onClick={handleToggleNotifications}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                  {hasNewNotifications && (
                    <span className="bell-badge" style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', border: '2px solid #0b0813', boxShadow: '0 0 8px #ef4444' }}></span>
                  )}
                </div>
              </button>            </div>

            {/* Perfil del Usuario */}
            <div className="user-profile-widget">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="user-avatar" />
              ) : (
                <div className="user-avatar-placeholder">
                  {fullName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="user-meta-premium">
                <span className="user-name-premium">{fullName}</span>
                <span className="user-email-premium">{email}</span>
              </div>
              <button className="btn-logout-header" onClick={handleLogoutClick} title="Cerrar sesión">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          </div>
        </header>

        {loading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p className="loading-msg">Sincronizando con Supabase...</p>
          </div>
        )}

        {errorMsg && (
          <div className="error-alert" style={{ marginBottom: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" className="error-icon" style={{ marginRight: '8px' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 3. GRID OF PREMIUM CARDS */}
        <div className="dashboard-grid-premium">
          {/* Left Column: Total Balance & Bezier Chart */}
          <div className="total-balance-card glass-card">
            <div className="balance-header-row">
              <div>
                <span className="balance-label">Saldo Total (USD)</span>
                <h1 className="balance-value">
                  ${(billetera?.balance_usd ?? 0.00).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="balance-currency-label"> USD</span>
                </h1>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace', background: 'rgba(255,255,255,0.02)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }} title="Dirección UUID de tu billetera">
                  ID: {user.id}
                </span>
                <button 
                  onClick={handleCopyWallet}
                  className="wallet-copy-btn-header"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '0.5rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    color: copied ? '#22d3ee' : '#9ca3af',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    outline: 'none',
                    backdropFilter: 'blur(10px)',
                    boxShadow: copied ? '0 0 10px rgba(34, 211, 238, 0.15)' : 'none',
                    borderColor: copied ? '#22d3ee' : 'rgba(255, 255, 255, 0.08)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.color = copied ? '#22d3ee' : '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.color = copied ? '#22d3ee' : '#9ca3af';
                  }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {copied ? (
                      <polyline points="20 6 9 17 4 12"></polyline>
                    ) : (
                      <>
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </>
                    )}
                  </svg>
                  {copied ? '¡Copiado!' : 'Copiar ID de billetera'}
                </button>
              </div>
            </div>

            {/* Gráfico SVG de Líneas Fluido y Estilizado */}
            <div className="chart-container">
              <svg viewBox="0 0 500 200" width="100%" height="100%" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(6, 182, 212, 0.4)" />
                    <stop offset="50%" stopColor="rgba(168, 85, 247, 0.15)" />
                    <stop offset="100%" stopColor="rgba(11, 8, 19, 0)" />
                  </linearGradient>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                {/* Area under the line */}
                <path d="M 0 160 Q 100 80 180 130 T 350 70 T 500 40 L 500 200 L 0 200 Z" fill="url(#chartGradient)" />
                {/* Smooth bezier curves */}
                <path d="M 0 160 Q 100 80 180 130 T 350 70 T 500 40" fill="none" stroke="url(#lineGradient)" strokeWidth="3" strokeLinecap="round" />
                {/* Indicator dots */}
                <circle cx="180" cy="130" r="5" fill="#06b6d4" style={{ filter: 'drop-shadow(0 0 6px #06b6d4)' }} />
              </svg>
            </div>

            {/* Acciones Rápidas con Degradados */}
            <div className="balance-actions-row">
              <button className="balance-action-btn reload" onClick={() => setShowReloadModal(true)}>
                Cargar Billetera
              </button>
              <button className="balance-action-btn transfer" onClick={() => setShowTransferModal(true)}>
                Transferir Fondos
              </button>
            </div>
          </div>

          {/* Right Column: Info & Assets */}
          <div className="right-panel-column">
            {/* Actividad Reciente */}
            <div className="recent-activity-card glass-card">
              <div className="card-header-premium">
                <h3>Actividad Reciente</h3>
              </div>
              {transacciones.length > 0 ? (
                (() => {
                  const latestTx = transacciones[0];
                  const isPositive = latestTx.tipo === 'deposito' || latestTx.tipo === 'venta_p2p' || latestTx.tipo === 'transferencia_recibida';
                  
                  return (
                    <div className="recent-activity-content">
                      <div className="activity-main-row">
                        <div className="activity-info">
                          <span className="activity-title">
                            {latestTx.tipo === 'deposito' ? 'Depósito' : 
                             latestTx.tipo === 'compra_directa' ? 'Compra Cripto' : 
                             latestTx.tipo === 'compra_p2p' ? 'Compra P2P' :
                             latestTx.tipo === 'venta_p2p' ? 'Venta P2P' :
                             latestTx.tipo === 'transferencia_enviada' ? 'Envío' : 'Recibido'}
                          </span>
                          <span className="activity-date">Hace unos momentos</span>
                        </div>
                        <div className="activity-sparkline">
                          <svg width="60" height="24" viewBox="0 0 60 24">
                            <path d="M 0 18 Q 15 6 30 14 T 60 4" fill="none" stroke={isPositive ? '#10b981' : '#ef4444'} strokeWidth="1.5" />
                          </svg>
                        </div>
                        <div className="activity-value-side">
                          <span className={`activity-amount ${isPositive ? 'positive' : 'negative'}`}>
                            {isPositive ? '+' : '-'}
                            {latestTx.cantidad_cripto 
                              ? `${Number(latestTx.cantidad_cripto).toFixed(4)} ${latestTx.moneda}`
                              : `$${Number(latestTx.monto_usd).toFixed(2)} USD`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="no-activity-msg">
                  No hay movimientos registrados.
                </div>
              )}
            </div>

            {/* Mis Criptomonedas */}
            <div className="my-cryptos-card glass-card">
              <div className="card-header-premium">
                <h3>Mis Criptomonedas</h3>
                <span className="hint-pill">Clic para comprar</span>
              </div>
              <div className="cryptos-list-premium">
                {/* Bitcoin Row */}
                <div className="crypto-row-premium" onClick={() => setSelectedBuyCrypto('btc')}>
                  <div className="crypto-logo-col">
                    <div className="logo-circle-premium btc">₿</div>
                    <div className="logo-meta-premium">
                      <span className="logo-name-premium">Bitcoin</span>
                      <span className="logo-symbol-premium">$BTC</span>
                    </div>
                  </div>
                  <div className="crypto-sparkline-col">
                    <svg width="60" height="20" viewBox="0 0 60 20">
                      <path d="M 0 14 Q 15 4 30 11 T 60 4" fill="none" stroke="#10b981" strokeWidth="1.5" />
                    </svg>
                  </div>
                  <div className="crypto-values-col">
                    <span className="crypto-units-val">{(billetera?.balance_btc ?? 0.00).toFixed(6)} BTC</span>
                    <span className="crypto-usd-val">
                      ${((billetera?.balance_btc ?? 0.00) * (precios?.bitcoin?.usd ?? 0.00)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </span>
                  </div>
                </div>

                {/* Ethereum Row */}
                <div className="crypto-row-premium" onClick={() => setSelectedBuyCrypto('eth')}>
                  <div className="crypto-logo-col">
                    <div className="logo-circle-premium eth">Ξ</div>
                    <div className="logo-meta-premium">
                      <span className="logo-name-premium">Ethereum</span>
                      <span className="logo-symbol-premium">$ETH</span>
                    </div>
                  </div>
                  <div className="crypto-sparkline-col">
                    <svg width="60" height="20" viewBox="0 0 60 20">
                      <path d="M 0 8 Q 15 14 30 5 T 60 12" fill="none" stroke="#a855f7" strokeWidth="1.5" />
                    </svg>
                  </div>
                  <div className="crypto-values-col">
                    <span className="crypto-units-val">{(billetera?.balance_eth ?? 0.00).toFixed(6)} ETH</span>
                    <span className="crypto-usd-val">
                      ${((billetera?.balance_eth ?? 0.00) * (precios?.ethereum?.usd ?? 0.00)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </span>
                  </div>
                </div>

                {/* Solana Row */}
                <div className="crypto-row-premium" onClick={() => setSelectedBuyCrypto('sol')}>
                  <div className="crypto-logo-col">
                    <div className="logo-circle-premium sol">S</div>
                    <div className="logo-meta-premium">
                      <span className="logo-name-premium">Solana</span>
                      <span className="logo-symbol-premium">$SOL</span>
                    </div>
                  </div>
                  <div className="crypto-sparkline-col">
                    <svg width="60" height="20" viewBox="0 0 60 20">
                      <path d="M 0 16 Q 15 8 30 12 T 60 2" fill="none" stroke="#14b8a6" strokeWidth="1.5" />
                    </svg>
                  </div>
                  <div className="crypto-values-col">
                    <span className="crypto-units-val">{(billetera?.balance_sol ?? 0.00).toFixed(4)} SOL</span>
                    <span className="crypto-usd-val">
                      ${((billetera?.balance_sol ?? 0.00) * (precios?.solana?.usd ?? 0.00)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="dashboard-footer">
          <p>© 2026 AetherWallet. Panel de control financiero seguro.</p>
        </footer>
      </div>

      {/* ==================== MODALES GLASSMORPHISM ==================== */}

      {/* MODAL: CARGAR FONDOS */}
      {showReloadModal && (
        <div className="p2p-modal-overlay">
          <div className="p2p-modal-card" style={{ maxWidth: '420px', width: '90%' }}>
            <div className="p2p-modal-header">
              <h3 className="p2p-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#22d3ee" strokeWidth="2.5">
                  <rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="2" y1="10" x2="22" y2="10"></line>
                </svg>
                Cargar Billetera
              </h3>
              <button className="p2p-modal-close-btn" onClick={() => { setShowReloadModal(false); setReloadError(null); setReloadSuccess(null); setMontoReload(''); setCardNumber(''); setCardName(''); setCardCvv(''); setCardExpiry(''); }}>&times;</button>
            </div>
            <form onSubmit={handleReloadSubmit} className="p2p-modal-body" autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {reloadError && <div className="tx-alert error">{reloadError}</div>}
              {reloadSuccess && <div className="tx-alert success">{reloadSuccess}</div>}
              
              <div className="form-group">
                <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.3rem', display: 'block' }}>Nombre del Titular</label>
                <input type="text" placeholder="Juan Pérez" value={cardName} onChange={(e) => setCardName(e.target.value)} disabled={reloadLoading} className="form-input" autoComplete="off" required />
              </div>
              
              <div className="form-group">
                <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.3rem', display: 'block' }}>Número de Tarjeta</label>
                <input 
                  type="text" 
                  maxLength={19}
                  placeholder="0000 0000 0000 0000" 
                  value={cardNumber} 
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').match(/.{1,4}/g)?.join(' ') || '';
                    setCardNumber(val);
                  }} 
                  disabled={reloadLoading} 
                  className="form-input" 
                  autoComplete="off"
                  required 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.3rem', display: 'block' }}>Expiración (MM/AA)</label>
                  <input 
                    type="text" 
                    maxLength={5}
                    placeholder="MM/AA" 
                    value={cardExpiry} 
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, '');
                      if (val.length > 2) {
                        val = val.substring(0, 2) + '/' + val.substring(2, 4);
                      }
                      setCardExpiry(val);
                    }} 
                    disabled={reloadLoading} 
                    className="form-input" 
                    autoComplete="off"
                    required 
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.3rem', display: 'block' }}>CVV</label>
                  <input 
                    type="text" 
                    maxLength={3}
                    placeholder="123" 
                    value={cardCvv} 
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))} 
                    disabled={reloadLoading} 
                    className="form-input" 
                    autoComplete="off"
                    required 
                  />
                </div>
              </div>

              <div className="form-group" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.3rem', display: 'block' }}>Monto a cargar (USD)</label>
                <input type="number" step="any" min="1" placeholder="0.00" value={montoReload} onChange={(e) => setMontoReload(e.target.value)} disabled={reloadLoading} className="form-input" required />
              </div>

              <button type="submit" disabled={reloadLoading} className="btn-transfer-submit" style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', width: '100%', boxShadow: '0 4px 15px rgba(6, 182, 212, 0.3)', marginTop: '0.5rem' }}>
                {reloadLoading ? 'Procesando...' : 'Confirmar Recarga'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TRANSFERIR FONDOS */}
      {showTransferModal && (
        <div className="p2p-modal-overlay">
          <div className="p2p-modal-card" style={{ maxWidth: '480px', width: '90%' }}>
            <div className="p2p-modal-header">
              <h3 className="p2p-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#a855f7" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
                Transferir Fondos
              </h3>
              <button className="p2p-modal-close-btn" onClick={() => { setShowTransferModal(false); setTxError(null); setTxSuccess(null); setDestinatarioId(''); setMontoTransferencia(''); }}>&times;</button>
            </div>
            <form onSubmit={handleTransfer} className="p2p-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {txError && <div className="tx-alert error">{txError}</div>}
              {txSuccess && <div className="tx-alert success">{txSuccess}</div>}
              <div className="form-group">
                <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>ID del Destinatario (UUID)</label>
                <input type="text" placeholder="ej. 8a34b22c-a81d-4567-a720-74e532b21acb" value={destinatarioId} onChange={(e) => setDestinatarioId(e.target.value)} disabled={txLoading} className="form-input" required />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>Moneda</label>
                  <select value={monedaSeleccionada} onChange={(e) => setMonedaSeleccionada(e.target.value)} disabled={txLoading} className="form-select">
                    <option value="balance_usd">Dólar (USD)</option>
                    <option value="balance_btc">Bitcoin (BTC)</option>
                    <option value="balance_eth">Ethereum (ETH)</option>
                    <option value="balance_sol">Solana (SOL)</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>Monto</label>
                  <input type="number" step="any" min="0.000001" placeholder="0.00" value={montoTransferencia} onChange={(e) => setMontoTransferencia(e.target.value)} disabled={txLoading} className="form-input" required />
                </div>
              </div>
              <button type="submit" disabled={txLoading} className="btn-transfer-submit" style={{ width: '100%' }}>
                {txLoading ? 'Procesando...' : 'Enviar Fondos'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COMPRA DE CRIPTO */}
      {selectedBuyCrypto && precios && (
        <div className="p2p-modal-overlay">
          <div className="p2p-modal-card" style={{ maxWidth: '420px', width: '90%' }}>
            <div className="p2p-modal-header">
              <h3 className="p2p-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={selectedBuyCrypto === 'btc' ? '#f59e0b' : selectedBuyCrypto === 'eth' ? '#a855f7' : '#14b8a6'} strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="16"></line>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                Comprar {selectedBuyCrypto.toUpperCase()}
              </h3>
              <button className="p2p-modal-close-btn" onClick={() => { setSelectedBuyCrypto(null); setBuyError(null); setBuySuccess(null); setUsdBuyAmount(''); }}>&times;</button>
            </div>
            <form onSubmit={handleBuySubmit} className="p2p-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p className="buy-rate-info" style={{ fontSize: '0.85rem', color: '#9ca3af', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.75rem', borderRadius: '8px', borderLeft: `3px solid ${selectedBuyCrypto === 'btc' ? '#f59e0b' : selectedBuyCrypto === 'eth' ? '#a855f7' : '#14b8a6'}`, margin: 0 }}>
                Cotización API: <strong>1 {selectedBuyCrypto.toUpperCase()} = ${
                  selectedBuyCrypto === 'btc' ? precios.bitcoin.usd.toLocaleString() : selectedBuyCrypto === 'eth' ? precios.ethereum.usd.toLocaleString() : precios.solana.usd.toLocaleString()
                } USD</strong>
              </p>

              {buyError && <div className="tx-alert error">{buyError}</div>}
              {buySuccess && <div className="tx-alert success">{buySuccess}</div>}

              <div className="form-group">
                <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>Monto a gastar (USD)</label>
                <input type="number" step="any" min="1" placeholder="ej. 500" value={usdBuyAmount} onChange={(e) => setUsdBuyAmount(e.target.value)} disabled={buyLoading} className="form-input" required />
              </div>

              {usdBuyAmount && parseFloat(usdBuyAmount) > 0 && (
                <div className="buy-estimate" style={{ fontSize: '0.85rem', color: '#22d3ee', fontWeight: 'bold', margin: '0' }}>
                  Recibirás aproximadamente:{' '}
                  {(
                    parseFloat(usdBuyAmount) / 
                    (selectedBuyCrypto === 'btc' ? precios.bitcoin.usd : selectedBuyCrypto === 'eth' ? precios.ethereum.usd : precios.solana.usd)
                  ).toFixed(6)}{' '}
                  {selectedBuyCrypto.toUpperCase()}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" disabled={buyLoading} className="btn-transfer-submit" style={{ flex: 1, background: selectedBuyCrypto === 'btc' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : selectedBuyCrypto === 'eth' ? 'linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)' : 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }}>
                  {buyLoading ? 'Comprando...' : `Comprar ${selectedBuyCrypto.toUpperCase()}`}
                </button>
                <button type="button" onClick={() => { setSelectedBuyCrypto(null); setBuyError(null); setBuySuccess(null); setUsdBuyAmount(''); }} className="btn-modal-cancel" style={{ flex: 'none', width: '100px' }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HISTORIAL DE TRANSACCIONES */}
      {showTxHistory && (
        <div className="p2p-modal-overlay">
          <div className="p2p-modal-card" style={{ maxWidth: '750px', width: '90%' }}>
            <div className="p2p-modal-header">
              <h3 className="p2p-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#22d3ee" strokeWidth="2.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Historial de Transacciones
              </h3>
              <button className="p2p-modal-close-btn" onClick={() => setShowTxHistory(false)}>
                &times;
              </button>
            </div>

            <div className="p2p-modal-body" style={{ maxHeight: '450px', overflowY: 'auto' }}>
              {txHistoryLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 0' }}>
                  <div className="spinner"></div>
                  <p style={{ marginTop: '1rem', color: '#9ca3af', fontSize: '0.9rem' }}>Cargando transacciones...</p>
                </div>
              ) : txHistoryError ? (
                <div className="tx-alert error" style={{ margin: '1rem 0' }}>
                  <span>{txHistoryError}</span>
                </div>
              ) : transacciones.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9ca3af' }}>
                  <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>No hay transacciones registradas.</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Realiza recargas, compras o transferencias para ver el detalle aquí.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="orderbook-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <th style={{ padding: '0.8rem' }}>Fecha</th>
                        <th style={{ padding: '0.8rem' }}>Operación</th>
                        <th style={{ padding: '0.8rem' }}>Detalle</th>
                        <th style={{ padding: '0.8rem', textAlign: 'right' }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transacciones.map((tx) => {
                        const dateFormatted = new Date(tx.creado_a).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        const typeLabels: any = {
                          deposito: 'Depósito USD',
                          compra_directa: 'Compra Cripto',
                          compra_p2p: 'Compra P2P',
                          venta_p2p: 'Venta P2P',
                          transferencia_enviada: 'Envío',
                          transferencia_recibida: 'Recibido'
                        };

                        const badgeColors: any = {
                          deposito: 'rgba(6, 182, 212, 0.12)',
                          compra_directa: 'rgba(16, 185, 129, 0.12)',
                          compra_p2p: 'rgba(16, 185, 129, 0.12)',
                          venta_p2p: 'rgba(245, 158, 11, 0.12)',
                          transferencia_enviada: 'rgba(239, 68, 68, 0.12)',
                          transferencia_recibida: 'rgba(16, 185, 129, 0.12)'
                        };

                        const textColors: any = {
                          deposito: '#22d3ee',
                          compra_directa: '#10b981',
                          compra_p2p: '#10b981',
                          venta_p2p: '#f59e0b',
                          transferencia_enviada: '#ef4444',
                          transferencia_recibida: '#10b981'
                        };

                        const renderMonto = () => {
                          if (tx.tipo === 'deposito') {
                            return (
                              <span style={{ color: '#10b981', fontWeight: 700 }}>
                                +${Number(tx.monto_usd).toFixed(2)} USD
                              </span>
                            );
                          }
                          
                          if (tx.tipo === 'compra_directa' || tx.tipo === 'compra_p2p') {
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                <span style={{ color: '#10b981', fontWeight: 700 }}>
                                  +{Number(tx.cantidad_cripto).toFixed(4)} {tx.moneda}
                                </span>
                                <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>
                                  -${Number(tx.monto_usd).toFixed(2)} USD
                                </span>
                              </div>
                            );
                          }

                          if (tx.tipo === 'venta_p2p') {
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                <span style={{ color: '#10b981', fontWeight: 700 }}>
                                  +${Number(tx.monto_usd).toFixed(2)} USD
                                </span>
                                <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>
                                  -{Number(tx.cantidad_cripto).toFixed(4)} {tx.moneda}
                                </span>
                              </div>
                            );
                          }

                          if (tx.tipo === 'transferencia_enviada') {
                            if (tx.moneda === 'USD') {
                              return (
                                <span style={{ color: '#ef4444', fontWeight: 700 }}>
                                  -${Number(tx.monto_usd).toFixed(2)} USD
                                </span>
                              );
                            } else {
                              return (
                                <span style={{ color: '#ef4444', fontWeight: 700 }}>
                                  -{Number(tx.cantidad_cripto).toFixed(4)} {tx.moneda}
                                </span>
                              );
                            }
                          }

                          if (tx.tipo === 'transferencia_recibida') {
                            if (tx.moneda === 'USD') {
                              return (
                                <span style={{ color: '#10b981', fontWeight: 700 }}>
                                  +${Number(tx.monto_usd).toFixed(2)} USD
                                </span>
                              );
                            } else {
                              return (
                                <span style={{ color: '#10b981', fontWeight: 700 }}>
                                  +{Number(tx.cantidad_cripto).toFixed(4)} {tx.moneda}
                                </span>
                              );
                            }
                          }

                          return null;
                        };

                        return (
                          <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                            <td className="font-numeric" style={{ padding: '0.8rem', fontSize: '0.85rem', color: '#9ca3af' }}>{dateFormatted}</td>
                            <td style={{ padding: '0.8rem' }}>
                              <span style={{ 
                                padding: '0.25rem 0.5rem', 
                                borderRadius: '6px', 
                                fontSize: '0.75rem', 
                                fontWeight: 800,
                                background: badgeColors[tx.tipo] || 'rgba(255,255,255,0.05)',
                                color: textColors[tx.tipo] || '#fff'
                              }}>
                                {typeLabels[tx.tipo] || tx.tipo}
                              </span>
                            </td>
                            <td style={{ padding: '0.8rem', fontSize: '0.9rem', color: '#f3f4f6' }}>{tx.detalle}</td>
                            <td className="font-numeric" style={{ 
                              padding: '0.8rem', 
                              textAlign: 'right'
                            }}>
                              {renderMonto()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p2p-modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', marginTop: '0' }}>
              <button className="btn-modal-cancel" onClick={() => setShowTxHistory(false)} style={{ flex: 'none', width: '120px', marginLeft: 'auto' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOTIFICACIONES */}
      {showNotifications && (
        <div className="p2p-modal-overlay">
          <div className="p2p-modal-card" style={{ maxWidth: '420px', width: '90%' }}>
            <div className="p2p-modal-header">
              <h3 className="p2p-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                Notificaciones
              </h3>
              <button className="p2p-modal-close-btn" onClick={() => setShowNotifications(false)}>&times;</button>
            </div>
            <div className="p2p-modal-body" style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {transacciones.length === 0 ? (
                <span style={{ color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>No tienes notificaciones recientes.</span>
              ) : (
                transacciones.slice(0, 10).map((tx) => {
                  let dotColor = '#9ca3af';
                  let label = tx.detalle;
                  if (tx.tipo === 'deposito') {
                    dotColor = '#22d3ee';
                    label = `Saldo recargado: +$${Number(tx.monto_usd).toFixed(2)} USD`;
                  } else if (tx.tipo === 'compra_directa' || tx.tipo === 'compra_p2p') {
                    dotColor = '#10b981';
                    label = `Compra exitosa: +${Number(tx.cantidad_cripto).toFixed(4)} ${tx.moneda}`;
                  } else if (tx.tipo === 'venta_p2p') {
                    dotColor = '#f59e0b';
                    label = `Venta P2P completada: +$${Number(tx.monto_usd).toFixed(2)} USD`;
                  } else if (tx.tipo === 'transferencia_enviada') {
                    dotColor = '#ef4444';
                    label = `Transferencia enviada: -${tx.cantidad_cripto ? Number(tx.cantidad_cripto).toFixed(4) + ' ' + tx.moneda : '$' + Number(tx.monto_usd).toFixed(2) + ' USD'}`;
                  } else if (tx.tipo === 'transferencia_recibida') {
                    dotColor = '#10b981';
                    label = `Fondos recibidos: +${tx.cantidad_cripto ? Number(tx.cantidad_cripto).toFixed(4) + ' ' + tx.moneda : '$' + Number(tx.monto_usd).toFixed(2) + ' USD'}`;
                  }

                  return (
                    <div key={tx.id} style={{ display: 'flex', gap: '12px', fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem', alignItems: 'center', textAlign: 'left' }}>
                      <span style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        backgroundColor: dotColor, 
                        boxShadow: `0 0 6px ${dotColor}`,
                        flexShrink: 0 
                      }}></span>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <span style={{ color: '#f3f4f6', fontWeight: 600, lineHeight: 1.3 }}>{label}</span>
                        <span style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '3px' }}>
                          {new Date(tx.creado_a).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} a las {new Date(tx.creado_a).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="p2p-modal-footer">
              <button className="btn-modal-cancel" onClick={() => setShowNotifications(false)} style={{ width: '100%', margin: 0 }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
