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
  const fetchTransactions = useCallback(async () => {
    try {
      setTxHistoryLoading(true);
      setTxHistoryError(null);
      const res = await getTransactionHistory(user.id);
      if (res.success && res.data) {
        setTransacciones(res.data);
      } else if (!res.success) {
        setTxHistoryError(res.message);
      }
    } catch (err: unknown) {
      console.error('Error al cargar historial de movimientos:', err);
      setTxHistoryError(err instanceof Error ? err.message : 'Error al obtener transacciones.');
    } finally {
      setTxHistoryLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (showTxHistory) {
      fetchTransactions();
    }
  }, [showTxHistory, fetchTransactions]);

  useEffect(() => {
    fetchWallet(true);
  }, [fetchWallet]);

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
    <div className="dashboard-container">
      {/* Glow Ambient Effects */}
      <div className="dash-glow sphere-purple"></div>
      <div className="dash-glow sphere-cyan"></div>

      {/* Header Panel */}
      <header className="dashboard-header">
        <div className="header-logo" style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.5px', background: 'linear-gradient(to right, #a855f7, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          AetherWallet
        </div>
        <div className="user-profile-header">
          <div className="user-details">
            <span className="user-name">{fullName}</span>
            <span className="user-email">{email}</span>
          </div>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="user-avatar" />
          ) : (
            <div className="user-avatar-placeholder">
              {fullName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="dashboard-content" style={{ position: 'relative' }}>
        {loading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p className="loading-msg">Cargando balances desde Supabase...</p>
          </div>
        )}

        {errorMsg && (
          <div className="error-alert" style={{ marginBottom: '1.5rem', width: '100%', maxWidth: '1000px', boxSizing: 'border-box' }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" className="error-icon" style={{ marginRight: '8px' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="dashboard-grid">
          {/* Left Column: Balances & Operations */}
          <section className="balances-section">
            {/* Main Balance Card */}
            <div className="main-balance-card">
              <div className="card-top">
                <span className="card-label">BALANCE ESTIMADO</span>
                <span className="card-status-badge">Activo</span>
              </div>
              <h1 className="balance-amount">
                ${(billetera?.balance_usd ?? 0.00).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="balance-currency"> USD</span>
              </h1>
              
              <div className="address-container" onClick={handleCopyWallet} title={`ID de Billetera (UUID): ${user.id}\n\nHaz clic para copiar`}>
                <span className="address-text">
                  {user.id.slice(0, 8)}...{user.id.slice(-8)}
                </span>
                <button className="copy-icon-btn">
                  {copied ? '¡Copiado!' : (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Financial Actions */}
            <div className="financial-actions">
              <button className="action-button-btn swap" onClick={() => onNavigate('p2p')}>
                <div className="btn-circle">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M17 2.1l4 4-4 4M3 21.9l-4-4 4-4M21 6H7.8A4.8 4.8 0 003 10.8v4.4M3 18h13.2a4.8 4.8 0 004.8-4.8V8.8" />
                  </svg>
                </div>
                <span>Comerciar criptomonedas</span>
              </button>
              <button className="action-button-btn swap" onClick={() => setShowTxHistory(true)} style={{ color: '#c084fc' }}>
                <div className="btn-circle" style={{ borderColor: 'rgba(168, 85, 247, 0.4)', background: 'rgba(168, 85, 247, 0.05)' }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <span>Transacciones</span>
              </button>
            </div>

            {/* Formulario Interactivo de Transferencia con efecto glassmorphism */}
            <div className="transfer-card glass-card">
              <h3 className="transfer-title">Transferir Fondos</h3>
              
              {txError && (
                <div className="tx-alert error">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" className="alert-icon" style={{ marginRight: '6px' }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>{txError}</span>
                </div>
              )}
              {txSuccess && (
                <div className="tx-alert success">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" className="alert-icon" style={{ marginRight: '6px' }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  <span>{txSuccess}</span>
                </div>
              )}

              <form onSubmit={handleTransfer} className="transfer-form">
                <div className="form-group">
                  <label htmlFor="destinatario">ID del Destinatario (UUID)</label>
                  <input
                    id="destinatario"
                    type="text"
                    placeholder="ej. 8a34b22c-a81d-4567-a720-74e532b21acb"
                    value={destinatarioId}
                    onChange={(e) => setDestinatarioId(e.target.value)}
                    disabled={txLoading}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group select-group">
                    <label htmlFor="moneda">Moneda</label>
                    <select
                      id="moneda"
                      value={monedaSeleccionada}
                      onChange={(e) => setMonedaSeleccionada(e.target.value)}
                      disabled={txLoading}
                      className="form-select"
                    >
                      <option value="balance_usd">Dólar (USD)</option>
                      <option value="balance_btc">Bitcoin (BTC)</option>
                      <option value="balance_eth">Ethereum (ETH)</option>
                      <option value="balance_sol">Solana (SOL)</option>
                    </select>
                  </div>

                  <div className="form-group amount-group">
                    <label htmlFor="monto">Monto</label>
                    <input
                      id="monto"
                      type="number"
                      step="any"
                      min="0.000001"
                      placeholder="0.00"
                      value={montoTransferencia}
                      onChange={(e) => setMontoTransferencia(e.target.value)}
                      disabled={txLoading}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <button type="submit" disabled={txLoading} className="btn-transfer-submit">
                  {txLoading ? (
                    <>
                      <div className="btn-spinner"></div>
                      <span>Procesando...</span>
                    </>
                  ) : 'Enviar Fondos'}
                </button>
              </form>
            </div>

            {/* Formulario de Recarga de Saldo USD */}
            <div className="transfer-card glass-card" style={{ marginTop: '1.5rem' }}>
              <h3 className="transfer-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="2" y1="10" x2="22" y2="10"></line>
                </svg>
                Recargar Saldo USD
              </h3>
              
              {reloadError && (
                <div className="tx-alert error">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" className="alert-icon" style={{ marginRight: '6px' }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>{reloadError}</span>
                </div>
              )}
              {reloadSuccess && (
                <div className="tx-alert success">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" className="alert-icon" style={{ marginRight: '6px' }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  <span>{reloadSuccess}</span>
                </div>
              )}

              <form onSubmit={handleReloadSubmit} className="transfer-form">
                <div className="form-group">
                  <label htmlFor="montoReload">Monto a cargar (USD)</label>
                  <input
                    id="montoReload"
                    type="number"
                    step="any"
                    min="1"
                    placeholder="ej. 1000.00"
                    value={montoReload}
                    onChange={(e) => setMontoReload(e.target.value)}
                    disabled={reloadLoading}
                    className="form-input"
                    required
                  />
                </div>

                <button type="submit" disabled={reloadLoading} className="btn-transfer-submit" style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', boxShadow: '0 4px 15px rgba(6, 182, 212, 0.25)' }}>
                  {reloadLoading ? (
                    <>
                      <div className="btn-spinner"></div>
                      <span>Recargando...</span>
                    </>
                  ) : 'Confirmar Recarga'}
                </button>
              </form>
            </div>
          </section>

          {/* Right Column: Crypto assets list */}
          <section className="crypto-assets-section glass-card">
            <h2 className="section-title">Tus Criptomonedas</h2>
            <p className="section-subtitle-hint" style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1rem', marginTop: '-0.5rem' }}>
              Haz clic en cualquier moneda para comprarla ficticiamente al valor de la API.
            </p>
            <div className="assets-list">
              {/* Bitcoin Item */}
              <div 
                className={`crypto-asset-item selectable ${selectedBuyCrypto === 'btc' ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedBuyCrypto(selectedBuyCrypto === 'btc' ? null : 'btc');
                  setBuyError(null);
                  setBuySuccess(null);
                  setUsdBuyAmount('');
                }}
                style={{ cursor: 'pointer', transition: 'all 0.2s ease', border: selectedBuyCrypto === 'btc' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', marginBottom: '0.75rem' }}
              >
                <div className="crypto-details">
                  <div className="crypto-icon btc">₿</div>
                  <div className="crypto-meta">
                    <span className="crypto-name">Bitcoin</span>
                    <span className="crypto-symbol">BTC</span>
                    <span className="crypto-rate-tag" style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '4px', display: 'block' }}>
                      {precios ? `1 BTC = $${precios.bitcoin.usd.toLocaleString('en-US')} USD` : 'Cargando precio...'}
                    </span>
                  </div>
                </div>
                <div className="crypto-balance-info">
                  <span className="crypto-units">{(billetera?.balance_btc ?? 0.00).toFixed(4)} BTC</span>
                  <span className="crypto-usd">
                    {precios 
                      ? `~$${((billetera?.balance_btc ?? 0.00) * precios.bitcoin.usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                      : 'Cargando precio...'}
                  </span>
                </div>
              </div>

              {/* Ethereum Item */}
              <div 
                className={`crypto-asset-item selectable ${selectedBuyCrypto === 'eth' ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedBuyCrypto(selectedBuyCrypto === 'eth' ? null : 'eth');
                  setBuyError(null);
                  setBuySuccess(null);
                  setUsdBuyAmount('');
                }}
                style={{ cursor: 'pointer', transition: 'all 0.2s ease', border: selectedBuyCrypto === 'eth' ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', marginBottom: '0.75rem' }}
              >
                <div className="crypto-details">
                  <div className="crypto-icon eth">Ξ</div>
                  <div className="crypto-meta">
                    <span className="crypto-name">Ethereum</span>
                    <span className="crypto-symbol">ETH</span>
                    <span className="crypto-rate-tag" style={{ fontSize: '0.75rem', color: '#a855f7', marginTop: '4px', display: 'block' }}>
                      {precios ? `1 ETH = $${precios.ethereum.usd.toLocaleString('en-US')} USD` : 'Cargando precio...'}
                    </span>
                  </div>
                </div>
                <div className="crypto-balance-info">
                  <span className="crypto-units">{(billetera?.balance_eth ?? 0.00).toFixed(4)} ETH</span>
                  <span className="crypto-usd">
                    {precios 
                      ? `~$${((billetera?.balance_eth ?? 0.00) * precios.ethereum.usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                      : 'Cargando precio...'}
                  </span>
                </div>
              </div>

              {/* Solana Item */}
              <div 
                className={`crypto-asset-item selectable ${selectedBuyCrypto === 'sol' ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedBuyCrypto(selectedBuyCrypto === 'sol' ? null : 'sol');
                  setBuyError(null);
                  setBuySuccess(null);
                  setUsdBuyAmount('');
                }}
                style={{ cursor: 'pointer', transition: 'all 0.2s ease', border: selectedBuyCrypto === 'sol' ? '1px solid #14b8a6' : '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', marginBottom: '0.75rem' }}
              >
                <div className="crypto-details">
                  <div className="crypto-icon sol">S</div>
                  <div className="crypto-meta">
                    <span className="crypto-name">Solana</span>
                    <span className="crypto-symbol">SOL</span>
                    <span className="crypto-rate-tag" style={{ fontSize: '0.75rem', color: '#14b8a6', marginTop: '4px', display: 'block' }}>
                      {precios ? `1 SOL = $${precios.solana.usd.toLocaleString('en-US')} USD` : 'Cargando precio...'}
                    </span>
                  </div>
                </div>
                <div className="crypto-balance-info">
                  <span className="crypto-units">{(billetera?.balance_sol ?? 0.00).toFixed(2)} SOL</span>
                  <span className="crypto-usd">
                    {precios 
                      ? `~$${((billetera?.balance_sol ?? 0.00) * precios.solana.usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                      : 'Cargando precio...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Fictitious Buy Form */}
            {selectedBuyCrypto && precios && (
              <div className="buy-crypto-card glass-card" style={{ marginTop: '1.5rem', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}>
                <h3 className="transfer-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', margin: '0 0 1rem 0', color: '#fff' }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={selectedBuyCrypto === 'btc' ? '#f59e0b' : selectedBuyCrypto === 'eth' ? '#a855f7' : '#14b8a6'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                  </svg>
                  Comprar {selectedBuyCrypto === 'btc' ? 'Bitcoin (BTC)' : selectedBuyCrypto === 'eth' ? 'Ethereum (ETH)' : 'Solana (SOL)'}
                </h3>

                <p className="buy-rate-info" style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '1rem', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.75rem', borderRadius: '8px', borderLeft: `3px solid ${selectedBuyCrypto === 'btc' ? '#f59e0b' : selectedBuyCrypto === 'eth' ? '#a855f7' : '#14b8a6'}` }}>
                  Cotización API: <strong>1 {selectedBuyCrypto.toUpperCase()} = ${
                    selectedBuyCrypto === 'btc' ? precios.bitcoin.usd.toLocaleString() : selectedBuyCrypto === 'eth' ? precios.ethereum.usd.toLocaleString() : precios.solana.usd.toLocaleString()
                  } USD</strong>
                </p>

                {buyError && (
                  <div className="tx-alert error" style={{ marginBottom: '1rem' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" className="alert-icon" style={{ marginRight: '6px' }}>
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>{buyError}</span>
                  </div>
                )}
                {buySuccess && (
                  <div className="tx-alert success" style={{ marginBottom: '1rem' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" className="alert-icon" style={{ marginRight: '6px' }}>
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <span>{buySuccess}</span>
                  </div>
                )}

                <form onSubmit={handleBuySubmit} className="transfer-form">
                  <div className="form-group">
                    <label htmlFor="usdBuyAmount">Monto a gastar (USD)</label>
                    <input
                      id="usdBuyAmount"
                      type="number"
                      step="any"
                      min="1"
                      placeholder="ej. 500"
                      value={usdBuyAmount}
                      onChange={(e) => setUsdBuyAmount(e.target.value)}
                      disabled={buyLoading}
                      className="form-input"
                      required
                    />
                  </div>

                  {usdBuyAmount && parseFloat(usdBuyAmount) > 0 && (
                    <div className="buy-estimate" style={{ fontSize: '0.85rem', color: '#22d3ee', margin: '0.5rem 0 1rem 0', fontWeight: 'bold' }}>
                      Recibirás aproximadamente:{' '}
                      {(
                        parseFloat(usdBuyAmount) / 
                        (selectedBuyCrypto === 'btc' ? precios.bitcoin.usd : selectedBuyCrypto === 'eth' ? precios.ethereum.usd : precios.solana.usd)
                      ).toFixed(6)}{' '}
                      {selectedBuyCrypto.toUpperCase()}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
                    <button 
                      type="submit" 
                      disabled={buyLoading} 
                      className="btn-transfer-submit" 
                      style={{ 
                        flex: 1,
                        background: selectedBuyCrypto === 'btc' 
                          ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                          : selectedBuyCrypto === 'eth' 
                          ? 'linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)' 
                          : 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                        boxShadow: 'none'
                      }}
                    >
                      {buyLoading ? 'Comprando...' : `Comprar ${selectedBuyCrypto.toUpperCase()}`}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setSelectedBuyCrypto(null);
                        setBuyError(null);
                        setBuySuccess(null);
                        setUsdBuyAmount('');
                      }} 
                      className="btn-transfer-submit" 
                      style={{ 
                        width: 'auto',
                        padding: '0.8rem 1rem',
                        background: 'rgba(255,255,255,0.05)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#9ca3af',
                        boxShadow: 'none'
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>
        </div>

        {/* Logout container at bottom */}
        <div className="logout-container">
          <button className="btn-logout-primary" onClick={handleLogoutClick}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Cerrar Sesión
          </button>
        </div>
      </main>

      {/* Modal de Historial de Transacciones */}
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

      <footer className="dashboard-footer">
        <p>© 2026 AetherWallet. Panel de control financiero seguro.</p>
      </footer>
    </div>
  );
}
