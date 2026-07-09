import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { logout } from '../services/auth';
import { createP2POffer, buyP2POffer, getActiveOffers, transferFunds, reloadBalance, getTransactionHistory } from '../services/wallet';
import type { OfertaP2P, Movimiento } from '../services/wallet';
import { getWalletBalances } from '../services/supabase';
import type { Billetera } from '../services/supabase';
import { getCryptoPrices } from '../services/prices';
import type { PreciosCripto } from '../services/prices';
import './MercadoP2P.css';

interface MercadoP2PProps {
  session: Session;
  onNavigate: (view: string) => void;
}

export default function MercadoP2P({ session, onNavigate }: MercadoP2PProps) {
  const [ofertas, setOfertas] = useState<OfertaP2P[]>([]);
  const [billetera, setBilletera] = useState<Billetera | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedOfferForBuy, setSelectedOfferForBuy] = useState<OfertaP2P | null>(null);
  
  // Estado para los precios en vivo de las criptomonedas
  const [precios, setPrecios] = useState<PreciosCripto | null>(null);

  // Estados para los modales de operaciones en el sidebar
  const [showReloadModal, setShowReloadModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showTxHistory, setShowTxHistory] = useState<boolean>(false);
  
  // Estados para cargar billetera / transferir (iguales a Dashboard.tsx)
  const [montoReload, setMontoReload] = useState('');
  const [reloadLoading, setReloadLoading] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [reloadSuccess, setReloadSuccess] = useState<string | null>(null);

  // Estados para simular datos de tarjeta (solo de vista, no guardados)
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');

  const [destinatarioId, setDestinatarioId] = useState('');
  const [monedaSeleccionada, setMonedaSeleccionada] = useState('balance_usd');
  const [montoTransferencia, setMontoTransferencia] = useState('');
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  const [transacciones, setTransacciones] = useState<Movimiento[]>([]);
  const [txHistoryLoading, setTxHistoryLoading] = useState<boolean>(false);
  const [txHistoryError, setTxHistoryError] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [hasNewNotifications, setHasNewNotifications] = useState<boolean>(false);

  // Control del modal de publicación
  const [showCreateOfferModal, setShowCreateOfferModal] = useState<boolean>(false);

  // Form states for creating offer
  const [moneda, setMoneda] = useState<string>('BTC');
  const [monto, setMonto] = useState<string>('');
  const [precioUnidad, setPrecioUnidad] = useState<string>('');

  const user = session.user;
  const userMetadata = user.user_metadata;
  const avatarUrl = userMetadata?.avatar_url || '';
  const fullName = userMetadata?.full_name || 'Usuario';
  const email = user.email || 'correo@ejemplo.com';

  const handleLogoutClick = async () => {
    const confirmation = window.confirm("¿Estás seguro de que deseas cerrar sesión?");
    if (confirmation) {
      try {
        await logout();
        onNavigate('login');
      } catch (err: unknown) {
        console.error('Error al cerrar sesión:', err);
      }
    }
  };

  const handleToggleNotifications = () => {
    setShowNotifications(!showNotifications);
    if (hasNewNotifications) {
      setHasNewNotifications(false);
      if (transacciones.length > 0) {
        localStorage.setItem(`lastSeenTx:${user.id}`, transacciones[0].id);
      }
    }
  };

  const fetchTransactions = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setTxHistoryLoading(true);
      setTxHistoryError(null);
      const res = await getTransactionHistory(user.id);
      if (res.success && res.data) {
        setTransacciones(res.data);
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

  // Carga de datos sincronizada (Balances + Anuncios)
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      
      // Consultar ofertas P2P activas
      const offersRes = await getActiveOffers();
      if (offersRes.success && offersRes.data) {
        setOfertas(offersRes.data);
      } else if (!offersRes.success) {
        setErrorMsg(offersRes.message);
      }

      // Consultar balances actuales del usuario
      const walletData = await getWalletBalances(user.id);
      setBilletera(walletData);

      // Cargar notificaciones e historial
      await fetchTransactions(false);
    } catch (err: unknown) {
      console.error('Error al cargar datos del Mercado P2P:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al sincronizar datos del mercado.');
    } finally {
      if (loading) setLoading(false);
    }
  }, [user.id, fetchTransactions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Carga de precios en tiempo real para el ticker superior
  useEffect(() => {
    let isMounted = true;

    const fetchPrices = async () => {
      try {
        const data = await getCryptoPrices();
        if (isMounted) {
          setPrecios(data);
        }
      } catch (err: unknown) {
        console.error('Error al cargar precios en el panel P2P:', err);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Manejo de la recarga de saldo USD en modal
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
        await loadData();
      }
    } catch (err: unknown) {
      console.error('Error al recargar saldo:', err);
      setReloadError(err instanceof Error ? err.message : 'Error inesperado al recargar saldo.');
    } finally {
      setReloadLoading(false);
    }
  };

  // Manejo de la transferencia interactiva en modal
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
        await loadData();
      }
    } catch (err: unknown) {
      console.error('Error durante la transferencia:', err);
      setTxError(err instanceof Error ? err.message : 'Error inesperado al procesar la transferencia.');
    } finally {
      setTxLoading(false);
    }
  };

  // Manejo de la publicación de oferta
  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    const montoVal = parseFloat(monto);
    const precioVal = parseFloat(precioUnidad);

    if (isNaN(montoVal) || montoVal <= 0) {
      setErrorMsg('Por favor, ingresa una cantidad válida de criptomoneda.');
      return;
    }
    if (isNaN(precioVal) || precioVal <= 0) {
      setErrorMsg('Por favor, ingresa un precio unitario válido en USD.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await createP2POffer(user.id, moneda, montoVal, precioVal);
      
      if (!res.success) {
        setErrorMsg(res.message);
      } else {
        setSuccessMsg(res.message);
        setMonto('');
        setPrecioUnidad('');
        setShowCreateOfferModal(false);
        await loadData();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al publicar la oferta.');
    } finally {
      setSubmitting(false);
    }
  };

  // Manejo de la confirmación de compra
  const handleConfirmBuy = async () => {
    if (!selectedOfferForBuy) return;
    const ofertaId = selectedOfferForBuy.id;
    setSelectedOfferForBuy(null);

    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      setSubmitting(true);
      const res = await buyP2POffer(ofertaId, user.id);
      
      if (!res.success) {
        setErrorMsg(res.message);
      } else {
        setSuccessMsg(res.message);
        await loadData();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al procesar la compra.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper para acortar UUIDs de usuarios vendedores
  const formatUserId = (id: string) => {
    return `${id.substring(0, 6)}...${id.substring(id.length - 4)}`;
  };

  // Obtener balance y precio dinámicos para el formulario de publicación
  const getSelectedCryptoStats = () => {
    if (!billetera) return { balance: 0, precio: 0 };
    
    let balance = 0;
    let precio = 0;
    
    if (moneda === 'BTC') {
      balance = billetera.balance_btc || 0;
      precio = precios?.bitcoin?.usd || 0;
    } else if (moneda === 'ETH') {
      balance = billetera.balance_eth || 0;
      precio = precios?.ethereum?.usd || 0;
    } else if (moneda === 'SOL') {
      balance = billetera.balance_sol || 0;
      precio = precios?.solana?.usd || 0;
    }
    
    return { balance, precio };
  };

  const { balance: currentBalance, precio: livePrice } = getSelectedCryptoStats();

  return (
    <div className="dashboard-container-new">
      {/* Glow ambient design */}
      <div className="dash-glow sphere-purple"></div>
      <div className="dash-glow sphere-cyan"></div>

      {/* 1. LEFT SIDEBAR */}
      <aside className="sidebar-container">
        <div className="sidebar-logo">
          <span className="logo-icon">▲</span> Mi Billetera Virtual
        </div>
        <nav className="sidebar-menu">
          <button className="menu-item" onClick={() => onNavigate('welcome')}>
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
          <button className="menu-item active" onClick={() => onNavigate('p2p')}>
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
          <h2 className="header-title">Comercio de Criptomonedas</h2>
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
            <p className="loading-msg">Sincronizando mercado P2P...</p>
          </div>
        )}

        {/* Ticker de precios en vivo horizontal */}
        {precios && (
          <div className="p2p-prices-ticker glass-card" style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '2.5rem',
            padding: '0.8rem 1.5rem',
            margin: '2rem 3rem 0 3rem',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(25, 20, 38, 0.25)',
            borderRadius: '16px',
            flexWrap: 'wrap',
            boxSizing: 'border-box'
          }}>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Precios en Vivo:
            </span>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: '#f3f4f6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#f59e0b', fontSize: '1.1rem' }}>₿</span> Bitcoin (BTC): 
                <strong style={{ color: '#fff' }}>${precios.bitcoin.usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</strong>
              </span>
              <span style={{ fontSize: '0.9rem', color: '#f3f4f6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#a855f7', fontSize: '1.1rem' }}>Ξ</span> Ethereum (ETH): 
                <strong style={{ color: '#fff' }}>${precios.ethereum.usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</strong>
              </span>
              <span style={{ fontSize: '0.9rem', color: '#f3f4f6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#14b8a6', fontSize: '1.1rem' }}>S</span> Solana (SOL): 
                <strong style={{ color: '#fff' }}>${precios.solana.usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</strong>
              </span>
            </div>
          </div>
        )}

        <main className="p2p-content-new" style={{ padding: '2rem 3rem', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
          {successMsg && <div className="tx-alert success" style={{ marginBottom: '1.5rem' }}>{successMsg}</div>}
          {errorMsg && <div className="tx-alert error" style={{ marginBottom: '1.5rem' }}>{errorMsg}</div>}

          {/* Tablón de Ofertas (Orderbook) */}
          <section className="p2p-market-section glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            <div className="card-header-premium" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem' }}>Anuncios en Vivo (Comerciar Criptomonedas)</h3>
                <p className="p2p-subtitle" style={{ fontSize: '0.85rem', color: '#9ca3af', margin: '4px 0 0 0' }}>Compra criptomonedas al instante utilizando tu balance de dólares (USD) o publica un anuncio.</p>
              </div>
              <button className="balance-action-btn reload" onClick={() => setShowCreateOfferModal(true)} style={{ flex: 'none', padding: '0.75rem 1.5rem', borderRadius: '12px' }}>
                Publicar Oferta
              </button>
            </div>

            {/* Panel de balances del usuario */}
            {billetera && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--glass-border-light)' }}>
                <span style={{ fontSize: '0.85rem', color: '#9ca3af', fontWeight: 'bold' }}>Mis Balances:</span>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>Dólar: <strong style={{ color: '#22d3ee' }}>${billetera.balance_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                  <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>BTC: <strong style={{ color: '#f59e0b' }}>{billetera.balance_btc.toFixed(6)}</strong></span>
                  <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>ETH: <strong style={{ color: '#a855f7' }}>{billetera.balance_eth.toFixed(6)}</strong></span>
                  <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>SOL: <strong style={{ color: '#14b8a6' }}>{billetera.balance_sol.toFixed(4)}</strong></span>
                </div>
              </div>
            )}

            <div className="orderbook-container" style={{ overflowX: 'auto', flex: 1, width: '100%', minWidth: 0 }}>
              {ofertas.length === 0 ? (
                <div className="orderbook-empty" style={{ textAlign: 'center', padding: '4rem 0' }}>
                  <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#9ca3af' }}>No hay ofertas de venta activas en este momento.</p>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>¡Sé el primero en publicar una oferta!</span>
                </div>
              ) : (
                <table className="orderbook-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ padding: '1rem 1rem 1rem 2rem' }}>Moneda</th>
                      <th style={{ padding: '1rem' }}>Cantidad</th>
                      <th style={{ padding: '1rem' }}>Precio Unitario (USD)</th>
                      <th style={{ padding: '1rem' }}>Total (USD)</th>
                      <th style={{ padding: '1rem' }}>Vendedor</th>
                      <th style={{ padding: '1rem 2rem 1rem 1rem', textAlign: 'right' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ofertas.map((offer) => {
                      const isOwner = offer.vendedor_id === user.id;
                      const totalUSD = offer.monto * offer.precio_unid;
                      return (
                        <tr key={offer.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                          <td style={{ padding: '1rem 1rem 1rem 2rem' }}>
                            <span className={`token-badge ${offer.moneda_cripto.toLowerCase()}`} style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              background: offer.moneda_cripto === 'BTC' ? 'rgba(245, 158, 11, 0.12)' : offer.moneda_cripto === 'ETH' ? 'rgba(168, 85, 247, 0.12)' : 'rgba(20, 184, 166, 0.12)',
                              color: offer.moneda_cripto === 'BTC' ? '#f59e0b' : offer.moneda_cripto === 'ETH' ? '#a855f7' : '#14b8a6'
                            }}>
                              {offer.moneda_cripto}
                            </span>
                          </td>
                          <td className="font-numeric" style={{ padding: '1rem', fontWeight: 600 }}>{offer.monto} {offer.moneda_cripto}</td>
                          <td className="font-numeric" style={{ padding: '1rem', color: '#9ca3af' }}>${offer.precio_unid.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
                          <td className="font-numeric font-highlight" style={{ padding: '1rem', color: '#22d3ee', fontWeight: 700 }}>${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
                          <td className="vendedor-id" style={{ padding: '1rem', fontSize: '0.85rem', color: '#6b7280' }} title={offer.vendedor_id}>
                            {isOwner ? 'Tú' : formatUserId(offer.vendedor_id)}
                          </td>
                          <td style={{ padding: '1rem 2rem 1rem 1rem', textAlign: 'right' }}>
                            <button
                              onClick={() => setSelectedOfferForBuy(offer)}
                              disabled={isOwner || submitting}
                              className={`btn-p2p-buy ${isOwner ? 'own-offer' : ''}`}
                              style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '10px',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: isOwner ? 'not-allowed' : 'pointer',
                                background: isOwner ? 'rgba(255,255,255,0.03)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: isOwner ? '#4b5563' : '#fff',
                                boxShadow: isOwner ? 'none' : '0 4px 10px rgba(16, 185, 129, 0.2)'
                              }}
                            >
                              {isOwner ? 'Tu Anuncio' : 'Comprar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <footer className="dashboard-footer">
            <p>© 2026 Mi Billetera Virtual. Mercado Financiero Seguro P2P.</p>
          </footer>
        </main>
      </div>

      {/* ==================== MODALES GLASSMORPHISM ==================== */}

      {/* MODAL: PUBLICAR ANUNCIO DE VENTA */}
      {showCreateOfferModal && (
        <div className="p2p-modal-overlay">
          <div className="p2p-modal-card" style={{ maxWidth: '480px', width: '90%' }}>
            <div className="p2p-modal-header">
              <h3 className="p2p-modal-title">Publicar Oferta de Venta</h3>
              <button className="p2p-modal-close-btn" onClick={() => { setShowCreateOfferModal(false); setMonto(''); setPrecioUnidad(''); }}>&times;</button>
            </div>
            <form onSubmit={handleCreateOffer} className="p2p-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label>Criptomoneda a vender</label>
                <select value={moneda} onChange={(e) => setMoneda(e.target.value)} disabled={submitting} className="form-select">
                  <option value="BTC">Bitcoin (BTC)</option>
                  <option value="ETH">Ethereum (ETH)</option>
                  <option value="SOL">Solana (SOL)</option>
                </select>
              </div>

              {/* Estadísticas en vivo de la cripto seleccionada */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                padding: '0.85rem 1rem',
                borderRadius: '14px',
                fontSize: '0.85rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Precio de referencia en vivo:</span>
                  <span style={{ color: '#22d3ee', fontWeight: 800 }}>
                    {livePrice > 0 ? `$${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD` : 'Cargando...'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Tu saldo disponible:</span>
                  <span style={{ color: '#c084fc', fontWeight: 800 }}>
                    {currentBalance.toFixed(6)} {moneda}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Cantidad a vender</label>
                  <input type="number" step="any" min="0.000001" placeholder="ej. 0.05" value={monto} onChange={(e) => setMonto(e.target.value)} disabled={submitting} className="form-input" required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Precio Unitario (USD)</label>
                  <input type="number" step="any" min="0.01" placeholder="ej. 65000" value={precioUnidad} onChange={(e) => setPrecioUnidad(e.target.value)} disabled={submitting} className="form-input" required />
                </div>
              </div>

              {monto && precioUnidad && !isNaN(parseFloat(monto)) && !isNaN(parseFloat(precioUnidad)) && (
                <div className="p2p-estimated-total" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.9rem', color: '#22d3ee', fontWeight: 'bold' }}>
                  <span>Total a Recibir: </span>
                  <strong>${(parseFloat(monto) * parseFloat(precioUnidad)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong>
                </div>
              )}

              <button type="submit" disabled={submitting} className="btn-transfer-submit" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', width: '100%', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.25)' }}>
                {submitting ? 'Publicando...' : 'Confirmar Publicación'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CARGAR BILLETERA */}
      {showReloadModal && (
        <div className="p2p-modal-overlay">
          <div className="p2p-modal-card" style={{ maxWidth: '420px', width: '90%' }}>
            <div className="p2p-modal-header">
              <h3 className="p2p-modal-title">Cargar Billetera</h3>
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
              <h3 className="p2p-modal-title">Transferir Fondos</h3>
              <button className="p2p-modal-close-btn" onClick={() => { setShowTransferModal(false); setTxError(null); setTxSuccess(null); setDestinatarioId(''); setMontoTransferencia(''); }}>&times;</button>
            </div>
            <form onSubmit={handleTransfer} className="p2p-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {txError && <div className="tx-alert error">{txError}</div>}
              {txSuccess && <div className="tx-alert success">{txSuccess}</div>}
              <div className="form-group">
                <label>ID del Destinatario (UUID)</label>
                <input type="text" placeholder="UUID del usuario" value={destinatarioId} onChange={(e) => setDestinatarioId(e.target.value)} disabled={txLoading} className="form-input" required />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Moneda</label>
                  <select value={monedaSeleccionada} onChange={(e) => setMonedaSeleccionada(e.target.value)} disabled={txLoading} className="form-select">
                    <option value="balance_usd">Dólar (USD)</option>
                    <option value="balance_btc">Bitcoin (BTC)</option>
                    <option value="balance_eth">Ethereum (ETH)</option>
                    <option value="balance_sol">Solana (SOL)</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Monto</label>
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

      {/* Modal de Confirmación de Compra P2P */}
      {selectedOfferForBuy && (
        <div className="p2p-modal-overlay">
          <div className="p2p-modal-card" style={{ maxWidth: '450px', width: '90%' }}>
            <div className="p2p-modal-header">
              <h3 className="p2p-modal-title">Confirmar Compra P2P</h3>
              <button className="p2p-modal-close-btn" onClick={() => setSelectedOfferForBuy(null)}>
                &times;
              </button>
            </div>

            <div className="p2p-modal-body">
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#9ca3af', lineHeight: 1.5 }}>
                ¿Estás seguro de que deseas comprar esta oferta de criptomoneda? Los fondos en USD se descontarán de tu cuenta y recibirás los activos inmediatamente.
              </p>

              <div className="p2p-details-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--glass-border-light)' }}>
                <div className="p2p-detail-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="p2p-detail-label" style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Criptomoneda:</span>
                  <span className={`token-badge ${selectedOfferForBuy.moneda_cripto.toLowerCase()}`} style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    background: selectedOfferForBuy.moneda_cripto === 'BTC' ? 'rgba(245, 158, 11, 0.12)' : selectedOfferForBuy.moneda_cripto === 'ETH' ? 'rgba(168, 85, 247, 0.12)' : 'rgba(20, 184, 166, 0.12)',
                    color: selectedOfferForBuy.moneda_cripto === 'BTC' ? '#f59e0b' : selectedOfferForBuy.moneda_cripto === 'ETH' ? '#a855f7' : '#14b8a6'
                  }}>
                    {selectedOfferForBuy.moneda_cripto}
                  </span>
                </div>
                <div className="p2p-detail-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="p2p-detail-label" style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Cantidad a comprar:</span>
                  <span className="p2p-detail-val" style={{ fontWeight: 750 }}>{selectedOfferForBuy.monto} {selectedOfferForBuy.moneda_cripto}</span>
                </div>
                <div className="p2p-detail-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="p2p-detail-label" style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Precio Unitario:</span>
                  <span className="p2p-detail-val" style={{ fontWeight: 750 }}>${selectedOfferForBuy.precio_unid.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
                </div>
                <div className="p2p-detail-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.8rem', marginTop: '0.4rem' }}>
                  <span className="p2p-detail-label" style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Total a Pagar:</span>
                  <span className="p2p-detail-val total" style={{ color: '#10b981', fontWeight: 800, fontSize: '1.05rem' }}>
                    ${(selectedOfferForBuy.monto * selectedOfferForBuy.precio_unid).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </span>
                </div>
              </div>
            </div>

            <div className="p2p-modal-footer">
              <button className="btn-modal-cancel" onClick={() => setSelectedOfferForBuy(null)} disabled={submitting}>
                Cancelar
              </button>
              <button className="btn-transfer-submit" onClick={handleConfirmBuy} disabled={submitting} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' }}>
                {submitting ? 'Procesando...' : 'Confirmar Compra'}
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
