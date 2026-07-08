import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { logout } from '../services/auth';
import { getWalletBalances } from '../services/supabase';
import type { Billetera } from '../services/supabase';
import { getCryptoPrices } from '../services/prices';
import type { PreciosCripto } from '../services/prices';
import { transferFunds } from '../services/wallet';
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
    } catch (err: any) {
      console.error('Error al consultar balances en Supabase:', err);
      setErrorMsg(err.message || 'Error al conectar con la base de datos de balances.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user.id]);

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
      } catch (err: any) {
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
    } catch (err: any) {
      console.error('Error durante la transacción:', err);
      setTxError(err.message || 'Ocurrió un error inesperado al procesar la transferencia.');
    } finally {
      setTxLoading(false);
    }
  };

  const handleCopyWallet = () => {
    navigator.clipboard.writeText('0x8F9B...5D3e');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogoutClick = async () => {
    try {
      setErrorMsg(null);
      await logout();
    } catch (err: any) {
      console.error('Error al cerrar sesión:', err);
      setErrorMsg(err.message || 'Error al intentar cerrar la sesión.');
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
              
              <div className="address-container" onClick={handleCopyWallet} title="Copiar dirección de billetera">
                <span className="address-text">0x8F9B...5D3e</span>
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
              <button className="action-button-btn send" onClick={() => onNavigate('wallet')}>
                <div className="btn-circle">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="19" x2="12" y2="5"></line>
                    <polyline points="5 12 12 5 19 12"></polyline>
                  </svg>
                </div>
                <span>Enviar</span>
              </button>
              <button className="action-button-btn receive" onClick={() => onNavigate('wallet')}>
                <div className="btn-circle">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <polyline points="19 12 12 19 5 12"></polyline>
                  </svg>
                </div>
                <span>Recibir</span>
              </button>
              <button className="action-button-btn swap" onClick={() => onNavigate('p2p')}>
                <div className="btn-circle">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M17 2.1l4 4-4 4M3 21.9l-4-4 4-4M21 6H7.8A4.8 4.8 0 003 10.8v4.4M3 18h13.2a4.8 4.8 0 004.8-4.8V8.8" />
                  </svg>
                </div>
                <span>Comerciar P2P</span>
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
          </section>

          {/* Right Column: Crypto assets list */}
          <section className="crypto-assets-section glass-card">
            <h2 className="section-title">Tus Criptomonedas</h2>
            <div className="assets-list">
              {/* Bitcoin Item */}
              <div className="crypto-asset-item">
                <div className="crypto-details">
                  <div className="crypto-icon btc">₿</div>
                  <div className="crypto-meta">
                    <span className="crypto-name">Bitcoin</span>
                    <span className="crypto-symbol">BTC</span>
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
              <div className="crypto-asset-item">
                <div className="crypto-details">
                  <div className="crypto-icon eth">Ξ</div>
                  <div className="crypto-meta">
                    <span className="crypto-name">Ethereum</span>
                    <span className="crypto-symbol">ETH</span>
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
              <div className="crypto-asset-item">
                <div className="crypto-details">
                  <div className="crypto-icon sol">S</div>
                  <div className="crypto-meta">
                    <span className="crypto-name">Solana</span>
                    <span className="crypto-symbol">SOL</span>
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

      <footer className="dashboard-footer">
        <p>© 2026 AetherWallet. Panel de control financiero seguro.</p>
      </footer>
    </div>
  );
}
