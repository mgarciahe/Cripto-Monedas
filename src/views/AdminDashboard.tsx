import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { logout } from '../services/auth';
import { 
  adminGetGlobalTransactions, 
  adminGetAllOffers, 
  adminUpdateOfferState 
} from '../services/wallet';
import type { Movimiento, OfertaP2P } from '../services/wallet';
import './Dashboard.css';

interface AdminDashboardProps {
  session: Session;
  onNavigate: (view: string) => void;
  userRole?: string | null;
}

export default function AdminDashboard({ session, onNavigate, userRole }: AdminDashboardProps) {
  const [transacciones, setTransacciones] = useState<Movimiento[]>([]);
  const [ofertas, setOfertas] = useState<OfertaP2P[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const user = session.user;
  const userMetadata = user.user_metadata;
  const avatarUrl = userMetadata?.avatar_url || '';
  const fullName = userMetadata?.full_name || 'Administrador';
  const email = user.email || 'admin@billeteravirtual.com';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // Cargar transacciones globales y ofertas P2P en paralelo
      const [txResult, offersResult] = await Promise.all([
        adminGetGlobalTransactions(),
        adminGetAllOffers()
      ]);

      if (txResult.success && txResult.data) {
        setTransacciones(txResult.data);
      } else if (!txResult.success) {
        setErrorMsg(txResult.message);
      }

      if (offersResult.success && offersResult.data) {
        setOfertas(offersResult.data);
      } else if (!offersResult.success) {
        setErrorMsg((prev) => prev ? `${prev} | ${offersResult.message}` : offersResult.message);
      }
    } catch (err: unknown) {
      console.error('Error al cargar datos administrativos:', err);
      setErrorMsg('Error de conexión con la base de datos de administración.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogoutClick = async () => {
    const confirmation = window.confirm("¿Estás seguro de que deseas cerrar la sesión de administración?");
    if (confirmation) {
      try {
        await logout();
      } catch (err: unknown) {
        console.error('Error al cerrar sesión:', err);
        setErrorMsg('Error al intentar cerrar la sesión.');
      }
    }
  };

  const handleUpdateOfferState = async (ofertaId: string, nuevoEstado: string) => {
    try {
      setActioningId(ofertaId);
      setErrorMsg(null);
      setSuccessMsg(null);

      const result = await adminUpdateOfferState(ofertaId, nuevoEstado);
      if (result.success) {
        setSuccessMsg(`Oferta actualizada a '${nuevoEstado}' correctamente.`);
        // Refrescar listado local de ofertas
        setOfertas((prev) => 
          prev.map((o) => o.id === ofertaId ? { ...o, estado: nuevoEstado } : o)
        );
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(result.message);
      }
    } catch (err: unknown) {
      console.error('Error al actualizar oferta:', err);
      setErrorMsg('Error al intentar cambiar el estado de la oferta.');
    } finally {
      setActioningId(null);
    }
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

  const typeLabels: any = {
    deposito: 'Depósito USD',
    compra_directa: 'Compra Cripto',
    compra_p2p: 'Compra P2P',
    venta_p2p: 'Venta P2P',
    transferencia_enviada: 'Envío',
    transferencia_recibida: 'Recibido'
  };

  return (
    <div className="dashboard-container-new">
      {/* Glow Ambient Effects */}
      <div className="dash-glow sphere-purple" style={{ top: '-10%', left: '-10%', width: '50vw', height: '50vw', opacity: 0.12 }}></div>
      <div className="dash-glow sphere-cyan" style={{ bottom: '-10%', right: '-10%', width: '50vw', height: '50vw', opacity: 0.12 }}></div>

      {/* 1. LEFT SIDEBAR */}
      <aside className="sidebar-container">
        <div className="sidebar-logo" style={{ color: '#ef4444' }}>
          <span className="logo-icon">🔒</span> Panel Admin
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
          <button className="menu-item" onClick={() => onNavigate('p2p')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 2.1l4 4-4 4M3 21.9l-4-4 4-4M21 6H7.8A4.8 4.8 0 003 10.8v4.4M3 18h13.2a4.8 4.8 0 004.8-4.8V8.8" />
            </svg>
            Comercio P2P
          </button>
          <button className="menu-item" onClick={() => onNavigate('profile')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Mi Perfil
          </button>
          <button className="menu-item active" style={{ borderLeft: '3px solid #ef4444', color: '#f3f4f6' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Administración
          </button>
        </nav>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="main-content-wrapper">
        {/* Header Panel */}
        <header className="dashboard-header-premium">
          <h2 className="header-title">Auditoría General</h2>
          <div className="header-right">
            {/* Perfil del Usuario Administrador */}
            <div className="user-profile-widget" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="user-avatar" />
              ) : (
                <div className="user-avatar-placeholder" style={{ background: '#ef4444', color: '#fff' }}>
                  A
                </div>
              )}
              <div className="user-meta-premium">
                <span className="user-name-premium">{fullName}</span>
                <span className="user-email-premium" style={{ color: '#ef4444', fontWeight: 600 }}>{email}</span>
              </div>
              <button className="btn-logout-header" onClick={handleLogoutClick} title="Cerrar sesión de admin">
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
            <div className="spinner" style={{ borderColor: '#ef4444 transparent #ef4444 transparent' }}></div>
            <p className="loading-msg">Consultando registros financieros globales...</p>
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

        {successMsg && (
          <div className="success-alert" style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            color: '#10b981',
            padding: '0.75rem 1rem',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '1.5rem',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>{successMsg}</span>
          </div>
        )}

        {/* 3. CONTENT PANELS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {/* SECCIÓN 1: AUDITORÍA GLOBAL DE TRANSACCIONES */}
          <div className="glass-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>Historial Global de Transacciones</h3>
              <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: '4px 0 0 0' }}>Registro completo y cronológico de movimientos financieros en la plataforma</p>
            </div>
            
            <div style={{ overflowX: 'auto', width: '100%', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
              {transacciones.length === 0 ? (
                <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
                  No se registran movimientos globales en el sistema.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                      <th style={{ padding: '0.8rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700 }}>Fecha</th>
                      <th style={{ padding: '0.8rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700 }}>ID de Usuario</th>
                      <th style={{ padding: '0.8rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700 }}>Tipo</th>
                      <th style={{ padding: '0.8rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700 }}>Detalle</th>
                      <th style={{ padding: '0.8rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700, textAlign: 'right' }}>Monto</th>
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

                      return (
                        <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                          <td className="font-numeric" style={{ padding: '0.8rem', fontSize: '0.85rem', color: '#9ca3af' }}>{dateFormatted}</td>
                          <td style={{ padding: '0.8rem', fontSize: '0.8rem', fontFamily: 'monospace', color: '#d1d5db' }} title={tx.usuario_id}>
                            {tx.usuario_id.substring(0, 13)}...
                          </td>
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
                          <td style={{ padding: '0.8rem', fontSize: '0.85rem', color: '#f3f4f6' }}>{tx.detalle}</td>
                          <td className="font-numeric" style={{ padding: '0.8rem', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>
                            {tx.monto_usd ? `$${Number(tx.monto_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD` : `${tx.cantidad_cripto} ${tx.moneda}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* SECCIÓN 2: CONTROL Y MODERACIÓN DE MERCADO P2P */}
          <div className="glass-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>Control del Mercado P2P</h3>
              <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: '4px 0 0 0' }}>Monitoreo de publicaciones registradas y acciones de resolución/congelamiento en vivo</p>
            </div>
            
            <div style={{ overflowX: 'auto', width: '100%', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
              {ofertas.length === 0 ? (
                <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
                  No se registran ofertas P2P publicadas en el sistema.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                      <th style={{ padding: '0.8rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700 }}>ID Oferta</th>
                      <th style={{ padding: '0.8rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700 }}>Vendedor</th>
                      <th style={{ padding: '0.8rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700 }}>Cripto</th>
                      <th style={{ padding: '0.8rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700, textAlign: 'right' }}>Monto</th>
                      <th style={{ padding: '0.8rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700, textAlign: 'right' }}>Precio Unit.</th>
                      <th style={{ padding: '0.8rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700, textAlign: 'center' }}>Estado</th>
                      <th style={{ padding: '0.8rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700, textAlign: 'right' }}>Acciones Administrativas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ofertas.map((o) => {
                      const isActioning = actioningId === o.id;

                      let statusBg = 'rgba(255,255,255,0.05)';
                      let statusColor = '#fff';
                      if (o.estado === 'activa') {
                        statusBg = 'rgba(16, 185, 129, 0.12)';
                        statusColor = '#10b981';
                      } else if (o.estado === 'procesando') {
                        statusBg = 'rgba(245, 158, 11, 0.12)';
                        statusColor = '#f59e0b';
                      } else if (o.estado === 'completada') {
                        statusBg = 'rgba(59, 130, 246, 0.12)';
                        statusColor = '#3b82f6';
                      } else if (o.estado === 'pausada') {
                        statusBg = 'rgba(107, 114, 128, 0.15)';
                        statusColor = '#9ca3af';
                      } else if (o.estado === 'cancelada') {
                        statusBg = 'rgba(239, 68, 68, 0.12)';
                        statusColor = '#ef4444';
                      } else if (o.estado === 'cancelada_usuario') {
                        statusBg = 'rgba(239, 68, 68, 0.08)';
                        statusColor = '#f43f5e';
                      } else if (o.estado === 'anulada') {
                        statusBg = 'rgba(239, 68, 68, 0.15)';
                        statusColor = '#ef4444';
                      }

                      return (
                        <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                          <td style={{ padding: '0.8rem', fontSize: '0.8rem', fontFamily: 'monospace', color: '#9ca3af' }} title={o.id}>
                            {o.id.substring(0, 8)}...
                          </td>
                          <td style={{ padding: '0.8rem', fontSize: '0.8rem', fontFamily: 'monospace', color: '#d1d5db' }} title={o.vendedor_id}>
                            {o.vendedor_id.substring(0, 8)}...
                          </td>
                          <td style={{ padding: '0.8rem', fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>{o.moneda_cripto}</td>
                          <td className="font-numeric" style={{ padding: '0.8rem', textAlign: 'right', color: '#f3f4f6', fontSize: '0.85rem' }}>
                            {Number(o.monto).toFixed(4)}
                          </td>
                          <td className="font-numeric" style={{ padding: '0.8rem', textAlign: 'right', color: '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>
                            ${Number(o.precio_unid).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                          </td>
                          <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                            <span style={{ 
                              padding: '0.25rem 0.5rem', 
                              borderRadius: '6px', 
                              fontSize: '0.7rem', 
                              fontWeight: 800,
                              background: statusBg,
                              color: statusColor,
                              textTransform: 'uppercase'
                            }}>
                              {o.estado === 'cancelada_usuario' ? 'cancelada (usuario)' : o.estado}
                            </span>
                          </td>
                          <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                            {o.estado === 'activa' ? (
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button
                                  disabled={isActioning}
                                  onClick={() => handleUpdateOfferState(o.id, 'pausada')}
                                  style={{
                                    background: 'rgba(245, 158, 11, 0.12)',
                                    border: '1px solid rgba(245, 158, 11, 0.3)',
                                    borderRadius: '8px',
                                    color: '#f59e0b',
                                    padding: '0.35rem 0.75rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: isActioning ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isActioning) e.currentTarget.style.background = 'rgba(245, 158, 11, 0.2)';
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isActioning) e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)';
                                  }}
                                >
                                  Pausar
                                </button>
                                <button
                                  disabled={isActioning}
                                  onClick={() => handleUpdateOfferState(o.id, 'cancelada')}
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '8px',
                                    color: '#ef4444',
                                    padding: '0.35rem 0.75rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: isActioning ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isActioning) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isActioning) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                                  }}
                                >
                                  Dar de Baja
                                </button>
                              </div>
                            ) : o.estado === 'pausada' ? (
                              <button
                                disabled={isActioning}
                                onClick={() => handleUpdateOfferState(o.id, 'activa')}
                                style={{
                                  background: 'rgba(16, 185, 129, 0.12)',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  borderRadius: '8px',
                                  color: '#10b981',
                                  padding: '0.35rem 0.75rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: isActioning ? 'not-allowed' : 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isActioning) e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isActioning) e.currentTarget.style.background = 'rgba(16, 185, 129, 0.12)';
                                }}
                              >
                                Activar
                              </button>
                            ) : o.estado === 'completada' ? (
                              <button
                                disabled={isActioning}
                                onClick={() => {
                                  const confirmReverse = window.confirm("¿Estás seguro de que deseas ANULAR esta transacción completada? Esto devolverá las criptomonedas al vendedor y los dólares al comprador.");
                                  if (confirmReverse) {
                                    handleUpdateOfferState(o.id, 'anulada');
                                  }
                                }}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: '8px',
                                  color: '#ef4444',
                                  padding: '0.35rem 0.75rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: isActioning ? 'not-allowed' : 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isActioning) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isActioning) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                                }}
                              >
                                Anular Transacción
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>Sin acciones</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          
        </div>

        <footer className="dashboard-footer">
          <p>© 2026 Mi Billetera Virtual. Panel de control financiero seguro de administración.</p>
        </footer>
      </div>
    </div>
  );
}
