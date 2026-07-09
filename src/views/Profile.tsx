import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getWalletBalances } from '../services/supabase';
import type { Billetera } from '../services/supabase';
import { getCryptoPrices } from '../services/prices';
import type { PreciosCripto } from '../services/prices';
import { logout } from '../services/auth';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import './Dashboard.css';

interface ProfileProps {
  session: Session;
  onNavigate: (view: string) => void;
  userRole: string | null;
}

export default function Profile({ session, onNavigate, userRole }: ProfileProps) {
  const user = session.user;
  const [billetera, setBilletera] = useState<Billetera | null>(null);
  const [precios, setPrecios] = useState<PreciosCripto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // Cargar datos de la billetera y los precios de las criptos
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const walletRes = await getWalletBalances(user.id);
      setBilletera(walletRes);

      const pricesRes = await getCryptoPrices();
      if (pricesRes) {
        setPrecios(pricesRes);
      }
    } catch (err) {
      console.error('Error al cargar datos del perfil:', err);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadData();
    // Actualizar precios en segundo plano cada 20 segundos
    const interval = setInterval(() => {
      loadData();
    }, 20000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Copiar ID de la billetera al portapapeles
  const handleCopyWalletId = () => {
    if (user.id) {
      navigator.clipboard.writeText(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogoutClick = async () => {
    const confirmation = window.confirm("¿Estás seguro de que deseas cerrar la sesión?");
    if (confirmation) {
      try {
        await logout();
        onNavigate('welcome');
      } catch (err) {
        console.error('Error al cerrar sesión:', err);
      }
    }
  };

  // Calcular distribución del portafolio en USD
  const portfolioDistribution = useMemo(() => {
    if (!billetera || !precios) {
      return { totalVal: 0, items: [] };
    }

    const usdVal = Number(billetera.balance_usd ?? 0);
    const btcVal = Number(billetera.balance_btc ?? 0) * (precios.bitcoin?.usd ?? 0);
    const ethVal = Number(billetera.balance_eth ?? 0) * (precios.ethereum?.usd ?? 0);
    const solVal = Number(billetera.balance_sol ?? 0) * (precios.solana?.usd ?? 0);

    const totalVal = usdVal + btcVal + ethVal + solVal;

    const items = [
      { name: 'Dólares (USD)', valCripto: usdVal, valUSD: usdVal, color: '#06b6d4', coin: 'USD' },
      { name: 'Bitcoin (BTC)', valCripto: Number(billetera.balance_btc ?? 0), valUSD: btcVal, color: '#f59e0b', coin: 'BTC' },
      { name: 'Ethereum (ETH)', valCripto: Number(billetera.balance_eth ?? 0), valUSD: ethVal, color: '#a855f7', coin: 'ETH' },
      { name: 'Solana (SOL)', valCripto: Number(billetera.balance_sol ?? 0), valUSD: solVal, color: '#14b8a6', coin: 'SOL' }
    ];

    // Mapear porcentajes
    const itemsWithPct = items.map(item => {
      const pct = totalVal > 0 ? (item.valUSD / totalVal) * 100 : 0;
      return {
        ...item,
        value: Number(item.valUSD.toFixed(2)), // Para la gráfica Recharts
        percentage: pct
      };
    });

    return {
      totalVal,
      items: itemsWithPct
    };
  }, [billetera, precios]);

  // Si no hay saldo total, mostrar un gráfico vacío representativo
  const pieChartData = useMemo(() => {
    if (portfolioDistribution.totalVal === 0) {
      return [{ name: 'Sin Fondos', value: 1, percentage: 100, color: '#4b5563', coin: 'VACIO' }];
    }
    return portfolioDistribution.items.filter(item => item.value > 0);
  }, [portfolioDistribution]);

  // Renderizador del Tooltip personalizado para el gráfico circular
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          background: 'rgba(15, 10, 25, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '0.75rem 1rem',
          borderRadius: '12px',
          color: '#fff',
          fontSize: '0.85rem',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)'
        }}>
          <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: data.color }}>{data.name}</p>
          {data.coin !== 'VACIO' ? (
            <>
              <p style={{ margin: 0 }}>Cantidad: <strong>{data.valCripto.toFixed(data.coin === 'USD' ? 2 : 6)} {data.coin}</strong></p>
              <p style={{ margin: 0 }}>Valor USD: <strong>${data.valUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
              <p style={{ margin: '4px 0 0 0', color: '#a855f7' }}>Porcentaje: <strong>{data.percentage.toFixed(2)}%</strong></p>
            </>
          ) : (
            <p style={{ margin: 0 }}>Billetera vacía sin saldo</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-container-new">
      {/* Glow Ambient Effects */}
      <div className="dash-glow sphere-purple"></div>
      <div className="dash-glow sphere-cyan"></div>

      {/* 1. LEFT SIDEBAR */}
      <aside className="sidebar-container">
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="logo-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a855f7', filter: 'drop-shadow(0 0 6px rgba(168, 85, 247, 0.6))' }}>
              <path d="M18 10V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v4" />
              <rect x="3" y="10" width="18" height="10" rx="2" />
              <path d="M17 14h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2" />
              <circle cx="18" cy="15" r="1.2" fill="currentColor" />
            </svg>
          </span>
          Mi Billetera Virtual
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
            Comercio de Criptomonedas
          </button>
          <button className="menu-item active" onClick={() => onNavigate('profile')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Mi Perfil
          </button>
          <button className="menu-item" onClick={() => onNavigate('support')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Contactar soporte
          </button>
          {userRole?.toLowerCase() === 'administrador' && (
            <button className="menu-item" onClick={() => onNavigate('admin')} style={{ borderLeft: '3px solid #ef4444', color: '#f3f4f6' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Administración
            </button>
          )}
        </nav>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="main-content-wrapper">
        <header className="dashboard-header-premium">
          <h2 className="header-title">Mi Perfil</h2>
          <div className="header-right">
            <button className="btn-logout-premium" onClick={handleLogoutClick}>
              Cerrar Sesión
            </button>
          </div>
        </header>

        {loading && !billetera ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: '#9ca3af' }}>
            <div className="spinner-premium" style={{ marginBottom: '1rem' }}></div>
            <p>Sincronizando información de perfil...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '1rem' }}>
            {/* PANEL DE INFORMACIÓN SUPERIOR */}
            <div className="welcome-banner-premium glass-card" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              padding: '2rem',
              borderRadius: '24px',
              flexWrap: 'wrap'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                color: '#fff',
                fontWeight: 800,
                boxShadow: '0 8px 25px rgba(6, 182, 212, 0.3)'
              }}>
                {user.user_metadata.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <span className="welcome-tagline" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  {userRole || 'Usuario'}
                </span>
                <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.5rem 0 0.25rem 0', color: '#fff' }}>
                  {user.user_metadata.full_name || 'Usuario Billetera'}
                </h3>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>{user.email}</p>
              </div>
              
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1rem',
                minWidth: '280px',
                textAlign: 'left'
              }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>NÚMERO DE BILLETERA (ID)</span>
                <span style={{ fontSize: '0.85rem', color: '#22d3ee', fontFamily: 'monospace', display: 'block', wordBreak: 'break-all' }}>
                  {user.id}
                </span>
                <button
                  onClick={handleCopyWalletId}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: copied ? '#10b981' : '#a855f7',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    marginTop: '0.5rem',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
                    {copied ? (
                      <polyline points="20 6 9 17 4 12"></polyline>
                    ) : (
                      <>
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </>
                    )}
                  </svg>
                  {copied ? '¡ID Copiado!' : 'Copiar número de billetera'}
                </button>
              </div>
            </div>

            {/* SECCIÓN INFERIOR: BALANCES Y GRÁFICA */}
            <div style={{
              display: 'flex',
              gap: '2rem',
              flexWrap: 'wrap',
              width: '100%'
            }}>
              {/* COLUMNA 1: SALDOS DETALLADOS */}
              <div className="glass-card" style={{
                flex: 1,
                minWidth: '320px',
                padding: '2rem',
                borderRadius: '24px',
                textAlign: 'left'
              }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
                  Saldos de Activos
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Balance USD */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#06b6d4' }}></div>
                      <div>
                        <span style={{ fontWeight: 600, display: 'block' }}>Dólares</span>
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Moneda local</span>
                      </div>
                    </div>
                    <span className="font-numeric" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#06b6d4' }}>
                      ${Number(billetera?.balance_usd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </span>
                  </div>

                  {/* Balance BTC */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }}></div>
                      <div>
                        <span style={{ fontWeight: 600, display: 'block' }}>Bitcoin</span>
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{billetera?.balance_btc ?? 0} BTC</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="font-numeric" style={{ fontSize: '1rem', fontWeight: 700, display: 'block' }}>
                        ${(Number(billetera?.balance_btc ?? 0) * (precios?.bitcoin?.usd ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                        1 BTC = ${precios?.bitcoin?.usd.toLocaleString('en-US') ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* Balance ETH */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#a855f7' }}></div>
                      <div>
                        <span style={{ fontWeight: 600, display: 'block' }}>Ethereum</span>
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{billetera?.balance_eth ?? 0} ETH</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="font-numeric" style={{ fontSize: '1rem', fontWeight: 700, display: 'block' }}>
                        ${(Number(billetera?.balance_eth ?? 0) * (precios?.ethereum?.usd ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                        1 ETH = ${precios?.ethereum?.usd.toLocaleString('en-US') ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* Balance SOL */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#14b8a6' }}></div>
                      <div>
                        <span style={{ fontWeight: 600, display: 'block' }}>Solana</span>
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{billetera?.balance_sol ?? 0} SOL</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="font-numeric" style={{ fontSize: '1rem', fontWeight: 700, display: 'block' }}>
                        ${(Number(billetera?.balance_sol ?? 0) * (precios?.solana?.usd ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                        1 SOL = ${precios?.solana?.usd.toLocaleString('en-US') ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(168, 85, 247, 0.06)',
                  border: '1px solid rgba(168, 85, 247, 0.15)',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  marginTop: '2rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#a855f7', fontSize: '0.9rem' }}>Valor Total Estimado:</span>
                  <span className="font-numeric" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
                    ${portfolioDistribution.totalVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </span>
                </div>
              </div>

              {/* COLUMNA 2: DISTRIBUCIÓN DEL PORTAFOLIO (GRAFICA) */}
              <div className="glass-card" style={{
                flex: 1,
                minWidth: '320px',
                padding: '2rem',
                borderRadius: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <h3 style={{ fontSize: '1.25rem', width: '100%', textAlign: 'left', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
                  Distribución del Portafolio
                </h3>

                <div style={{ width: '100%', height: '240px', position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {portfolioDistribution.totalVal > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      pointerEvents: 'none'
                    }}>
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 'bold' }}>Portafolio</span>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                        ${portfolioDistribution.totalVal > 100000 ? `${(portfolioDistribution.totalVal / 1000).toFixed(1)}k` : portfolioDistribution.totalVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </h4>
                    </div>
                  )}
                </div>

                {/* Leyenda con porcentajes detallados */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  width: '100%',
                  marginTop: '1rem',
                  fontSize: '0.85rem'
                }}>
                  {portfolioDistribution.items.map((item, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(255,255,255,0.03)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }}></div>
                        <span style={{ color: 'rgba(255,255,255,0.8)' }}>{item.name}</span>
                      </div>
                      <span style={{ fontWeight: 'bold', color: '#fff' }}>
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
