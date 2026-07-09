import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Session } from '@supabase/supabase-js';
import { logout } from '../services/auth';
import { getWalletBalances } from '../services/supabase';
import type { Billetera } from '../services/supabase';
import { getCryptoPrices, getCryptoHistory } from '../services/prices';
import type { PreciosCripto } from '../services/prices';
import { transferFunds, reloadBalance, buyCrypto, getTransactionHistory, getUserNotifications, markNotificationsAsRead } from '../services/wallet';
import type { Movimiento, Notificacion } from '../services/wallet';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import './Dashboard.css';

interface DashboardProps {
  session: Session;
  onNavigate: (view: string) => void;
  userRole?: string | null;
}

export default function Dashboard({ session, onNavigate, userRole }: DashboardProps) {
  const user = session.user;
  const userMetadata = user.user_metadata;
  const avatarUrl = userMetadata?.avatar_url || '';
  const fullName = userMetadata?.full_name || 'Usuario';
  const email = user.email || 'correo@ejemplo.com';

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

  // Estado para el popup de bienvenida (solo primera vez)
  const [showWelcomePopup, setShowWelcomePopup] = useState<boolean>(false);

  // Estados para el historial de transacciones
  const [showTxHistory, setShowTxHistory] = useState<boolean>(false);
  const [transacciones, setTransacciones] = useState<Movimiento[]>([]);
  const [txHistoryLoading, setTxHistoryLoading] = useState<boolean>(false);
  const [txHistoryError, setTxHistoryError] = useState<string | null>(null);

  // Estados para las notificaciones
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [hasNewNotifications, setHasNewNotifications] = useState<boolean>(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (user.id === 'guest-user-id') return;
    try {
      const data = await getUserNotifications(user.id);
      setNotificaciones(data);
      if (data.some((n) => !n.leido)) {
        setHasNewNotifications(true);
      }
    } catch (err) {
      console.error('Error al cargar notificaciones:', err);
    }
  }, [user.id]);

  // Estados para la gráfica interactiva de rendimiento de mercado
  const [selectedCrypto, setSelectedCrypto] = useState<'bitcoin' | 'ethereum' | 'solana'>('bitcoin');
  const [chartData, setChartData] = useState<Array<{ date: string; price: number }>>([]);
  const [chartLoading, setChartLoading] = useState<boolean>(true);
  const [chartError, setChartError] = useState<string | null>(null);

  // Estados para controlar los modales del Sidebar / Saldo
  const [showReloadModal, setShowReloadModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);


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

  // Detectar primera visita del usuario y mostrar popup de bienvenida
  useEffect(() => {
    if (user.id && user.id !== 'guest-user-id') {
      const key = `welcome_shown:${user.id}`;

      // La cuenta debe tener menos de 5 minutos de antigüedad para ser considerada "nueva"
      const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
      const now = Date.now();
      const isNewAccount = (now - createdAt) < 5 * 60 * 1000; // 5 minutos

      if (isNewAccount && !localStorage.getItem(key)) {
        setShowWelcomePopup(true);
        localStorage.setItem(key, 'true');
      } else {
        // Aseguramos que la clave exista para sesiones futuras
        localStorage.setItem(key, 'true');
      }
    }
  }, [user.id, user.created_at]);

  const combinedAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      tipo: 'admin' | 'transaccion';
      fecha: Date;
      mensaje: string;
      dotColor?: string;
      creado_a: string;
    }> = [];

    // 1. Agregar notificaciones del administrador
    notificaciones.forEach((n) => {
      alerts.push({
        id: n.id,
        tipo: 'admin',
        fecha: new Date(n.creado_a),
        mensaje: n.mensaje,
        creado_a: n.creado_a
      });
    });

    // 2. Agregar transacciones del sistema
    transacciones.forEach((tx) => {
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

      alerts.push({
        id: tx.id,
        tipo: 'transaccion',
        fecha: new Date(tx.creado_a),
        mensaje: label,
        dotColor,
        creado_a: tx.creado_a
      });
    });

    // Ordenar descendentemente por fecha
    return alerts.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }, [notificaciones, transacciones]);

  useEffect(() => {
    // Carga inicial
    fetchWallet(true);
    fetchTransactions(false);
    fetchNotifications();

    // Polling en segundo plano cada 10 segundos
    const interval = setInterval(() => {
      fetchWallet(false);
      fetchTransactions(false);
      fetchNotifications();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchWallet, fetchTransactions, fetchNotifications]);

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

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      setChartLoading(true);
      setChartError(null);
      try {
        const rawPrices = await getCryptoHistory(selectedCrypto);
        if (isMounted) {
          const formatted = rawPrices.map(([timestamp, price]) => {
            const dateObj = new Date(timestamp);
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            return {
              date: `${day}/${month} ${hours}:${minutes}`,
              simpleDate: `${day}/${month}`,
              price: price
            };
          });

          // Filtrar a aproximadamente 30 puntos para un rendimiento y visualización impecable
          const step = Math.max(1, Math.floor(formatted.length / 30));
          const filtered = formatted.filter((_, idx) => idx % step === 0);

          setChartData(filtered);
        }
      } catch (err: unknown) {
        console.error('Error al cargar historial para gráfica:', err);
        if (isMounted) {
          setChartError('No se pudo sincronizar el historial del mercado.');
        }
      } finally {
        if (isMounted) {
          setChartLoading(false);
        }
      }
    };

    loadHistory();
    const interval = setInterval(loadHistory, 300000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedCrypto]);


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

  const handleToggleNotifications = async () => {
    const nextShow = !showNotifications;
    setShowNotifications(nextShow);
    if (nextShow) {
      if (user.id !== 'guest-user-id') {
        await markNotificationsAsRead(user.id);
        setNotificaciones(prev => prev.map(n => ({ ...n, leido: true })));
      }
      if (transacciones.length > 0) {
        localStorage.setItem(`lastSeenTx:${user.id}`, transacciones[0].id);
      }
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
      if (user.id === 'guest-user-id') {
        onNavigate('welcome');
        return;
      }
      await logout();
    } catch (err: unknown) {
      console.error('Error al cerrar sesión:', err);
      const msg = err instanceof Error ? err.message : 'Error al intentar cerrar la sesión.';
      setErrorMsg(msg);
    }
  };

  // Helper para obtener configuración visual de colores según cripto seleccionada
  const getCryptoGradientConfig = () => {
    switch (selectedCrypto) {
      case 'bitcoin':
        return {
          stroke: '#f59e0b',
          gradientStart: 'rgba(245, 158, 11, 0.35)',
          gradientEnd: 'rgba(245, 158, 11, 0)'
        };
      case 'ethereum':
        return {
          stroke: '#3b82f6',
          gradientStart: 'rgba(59, 130, 246, 0.35)',
          gradientEnd: 'rgba(59, 130, 246, 0)'
        };
      case 'solana':
        return {
          stroke: '#14b8a6',
          gradientStart: 'rgba(20, 184, 166, 0.35)',
          gradientEnd: 'rgba(20, 184, 166, 0)'
        };
      default:
        return {
          stroke: '#22d3ee',
          gradientStart: 'rgba(34, 211, 238, 0.35)',
          gradientEnd: 'rgba(34, 211, 238, 0)'
        };
    }
  };

  const { stroke: chartStroke, gradientStart, gradientEnd } = getCryptoGradientConfig();

  // Tooltip personalizado estilizado
  const CustomChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div style={{
          background: 'rgba(9, 10, 18, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '0.75rem 1rem',
          borderRadius: '12px',
          boxShadow: '0 8px 25px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>{dataPoint.date}</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.95rem', color: '#fff', fontWeight: 800 }}>
            ${dataPoint.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </p>
        </div>
      );
    }
    return null;
  };

  // Formateador para el eje Y de la gráfica
  const formatYAxisTick = (value: number) => {
    return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  if (user.id === 'guest-user-id') {
    return (
      <div className="dashboard-container-new" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '2rem', boxSizing: 'border-box', background: '#090a12', position: 'relative', overflow: 'hidden' }}>
        {/* Glow Ambient Effects */}
        <div className="dash-glow sphere-purple" style={{ top: '-10%', left: '-10%', width: '50vw', height: '50vw', opacity: 0.15 }}></div>
        <div className="dash-glow sphere-cyan" style={{ bottom: '-10%', right: '-10%', width: '50vw', height: '50vw', opacity: 0.15 }}></div>

        {/* Top Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', width: '100%', maxWidth: '900px', margin: '0 auto 3rem auto', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="logo-icon" style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              Mi Billetera <span style={{ color: '#22d3ee' }}>Virtual</span>
            </span>
          </div>
          
          <button 
            onClick={() => onNavigate('welcome')}
            style={{
              background: 'linear-gradient(135deg, #a855f7, #6366f1)',
              border: 'none',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.85rem',
              padding: '0.6rem 1.25rem',
              borderRadius: '10px',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(168, 85, 247, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(168, 85, 247, 0.3)';
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Salir
          </button>
        </header>

        {/* Content Container */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', width: '100%', maxWidth: '900px', margin: '0 auto', zIndex: 10 }}>
          {/* Ticker de precios en vivo */}
          {precios && (
            <div className="p2p-prices-ticker glass-card" style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '2.5rem',
              padding: '1.2rem 2rem',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(25, 20, 38, 0.25)',
              borderRadius: '20px',
              flexWrap: 'wrap',
              boxSizing: 'border-box',
              width: '100%',
              backdropFilter: 'blur(20px)'
            }}>
              <span style={{ fontSize: '0.85rem', color: '#9ca3af', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Precios en Vivo:
              </span>
              <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.95rem', color: '#f3f4f6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#f59e0b', fontSize: '1.2rem' }}>₿</span> Bitcoin (BTC): 
                  <strong style={{ color: '#fff' }}>${precios.bitcoin.usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</strong>
                </span>
                <span style={{ fontSize: '0.95rem', color: '#f3f4f6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#a855f7', fontSize: '1.2rem' }}>Ξ</span> Ethereum (ETH): 
                  <strong style={{ color: '#fff' }}>${precios.ethereum.usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</strong>
                </span>
                <span style={{ fontSize: '0.95rem', color: '#f3f4f6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#14b8a6', fontSize: '1.2rem' }}>S</span> Solana (SOL): 
                  <strong style={{ color: '#fff' }}>${precios.solana.usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</strong>
                </span>
              </div>
            </div>
          )}

          {/* Gráfica de Rendimiento de Mercado */}
          <div className="market-chart-card glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '2rem', position: 'relative', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>Rendimiento del Mercado</h3>
                <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: '4px 0 0 0' }}>Historial de precios de los últimos 7 días</p>
              </div>
              {/* Tabs para BTC, ETH, SOL */}
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <button 
                  type="button"
                  onClick={() => setSelectedCrypto('bitcoin')}
                  style={{
                    background: selectedCrypto === 'bitcoin' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'transparent',
                    color: selectedCrypto === 'bitcoin' ? '#fff' : '#9ca3af',
                    border: 'none',
                    padding: '0.45rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 750,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  BTC
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedCrypto('ethereum')}
                  style={{
                    background: selectedCrypto === 'ethereum' ? 'linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)' : 'transparent',
                    color: selectedCrypto === 'ethereum' ? '#fff' : '#9ca3af',
                    border: 'none',
                    padding: '0.45rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 750,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  ETH
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedCrypto('solana')}
                  style={{
                    background: selectedCrypto === 'solana' ? 'linear-gradient(135deg, #14b8a6 0%, #a855f7 100%)' : 'transparent',
                    color: selectedCrypto === 'solana' ? '#fff' : '#9ca3af',
                    border: 'none',
                    padding: '0.45rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 750,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  SOL
                </button>
              </div>
            </div>

            {/* Área del Gráfico con Recharts */}
            <div style={{ width: '100%', height: 320, position: 'relative', marginTop: '1rem' }}>
              {chartLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px' }}>
                  <div className="spinner" style={{ width: '30px', height: '30px' }}></div>
                  <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Cargando rendimiento...</span>
                </div>
              ) : chartError ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ef4444', fontSize: '0.85rem' }}>
                  <span>{chartError}</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="selectedCryptoGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={gradientStart} />
                        <stop offset="100%" stopColor={gradientEnd} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.04)" />
                    <XAxis 
                      dataKey="simpleDate" 
                      stroke="#6b7280" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      dy={10}
                    />
                    <YAxis 
                      stroke="#6b7280" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false}
                      domain={['auto', 'auto']}
                      tickFormatter={formatYAxisTick}
                      dx={-5}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke={chartStroke} 
                      strokeWidth={2.5} 
                      fillOpacity={1} 
                      fill="url(#selectedCryptoGradient)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <footer style={{ marginTop: 'auto', textAlign: 'center', padding: '2rem 0 1rem 0', fontSize: '0.8rem', color: '#6b7280', zIndex: 10 }}>
          <p>© 2026 Mi Billetera Virtual. Panel de control financiero seguro para Invitados.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="dashboard-container-new">
      {/* Glow Ambient Effects */}
      <div className="dash-glow sphere-purple"></div>
      <div className="dash-glow sphere-cyan"></div>

      {/* POPUP DE BIENVENIDA - Solo primera vez */}
      {showWelcomePopup && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 2, 15, 0.85)',
          backdropFilter: 'blur(12px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          animation: 'fadeIn 0.4s ease'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, rgba(30, 15, 55, 0.98) 0%, rgba(15, 10, 30, 0.98) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.35)',
            borderRadius: '24px',
            padding: '3rem 2.5rem',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 0 60px rgba(168, 85, 247, 0.25), 0 25px 50px rgba(0,0,0,0.6)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Decorative top glow */}
            <div style={{
              position: 'absolute',
              top: '-60px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '200px',
              height: '200px',
              background: 'radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, transparent 70%)',
              pointerEvents: 'none'
            }} />

            {/* Wallet icon */}
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(139, 92, 246, 0.15) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              boxShadow: '0 0 30px rgba(168, 85, 247, 0.3)'
            }}>
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 10V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v4" />
                <rect x="3" y="10" width="18" height="10" rx="2" />
                <path d="M17 14h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2" />
                <circle cx="18" cy="15" r="1.2" fill="#a855f7" />
              </svg>
            </div>

            {/* Badge */}
            <div style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.1) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '20px',
              padding: '0.3rem 1rem',
              fontSize: '0.75rem',
              color: '#10b981',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              marginBottom: '1.25rem'
            }}>
              ¡Bono de Bienvenida!
            </div>

            {/* Title */}
            <h2 style={{
              fontSize: '1.65rem',
              fontWeight: 900,
              color: '#fff',
              margin: '0 0 0.75rem 0',
              lineHeight: 1.2,
              letterSpacing: '-0.5px'
            }}>
              Bienvenido a tu<br />
              <span style={{ background: 'linear-gradient(135deg, #a855f7, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Billetera Virtual
              </span>
            </h2>

            {/* Amount highlight */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.08) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '16px',
              padding: '1rem 1.5rem',
              margin: '1.25rem 0',
            }}>
              <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.85rem', marginBottom: '4px' }}>
                Por crear tu cuenta has obtenido
              </p>
              <p style={{
                margin: 0,
                fontSize: '2.2rem',
                fontWeight: 900,
                color: '#10b981',
                letterSpacing: '-1px',
                fontFamily: 'monospace'
              }}>
                $10,000
              </p>
              <p style={{ margin: '4px 0 0 0', color: '#6ee7b7', fontSize: '0.8rem' }}>
                dólares disponibles en tu billetera
              </p>
            </div>

            {/* Message */}
            <p style={{
              color: '#9ca3af',
              fontSize: '0.9rem',
              lineHeight: 1.6,
              margin: '0 0 2rem 0'
            }}>
              Utilízalos en transacciones para compra de criptomonedas como Bitcoin, Ethereum y Solana.
              <br /><br />
              <span style={{ color: '#d1d5db' }}>Gracias por ser parte de <strong style={{ color: '#a855f7' }}>Billetera Virtual</strong>.</span>
            </p>

            {/* CTA Button */}
            <button
              onClick={() => setShowWelcomePopup(false)}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                border: 'none',
                borderRadius: '14px',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 700,
                padding: '0.9rem 2rem',
                cursor: 'pointer',
                boxShadow: '0 8px 25px rgba(168, 85, 247, 0.35)',
                transition: 'all 0.2s ease',
                letterSpacing: '0.5px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(168, 85, 247, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(168, 85, 247, 0.35)';
              }}
            >
              ¡Empezar a invertir!
            </button>
          </div>
        </div>
      )}

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
          <button className="menu-item" onClick={() => onNavigate('profile')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Mi Perfil
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
          {/* Left Column: Total Balance Card & Interactive Chart Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', minWidth: 0 }}>
            {/* Total Balance Card */}
            <div className="total-balance-card glass-card" style={{ padding: '1.75rem' }}>
              <div className="balance-header-row">
                <div>
                  <span className="balance-label">Saldo Actual (USD)</span>
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

              {/* Acciones Rápidas con Degradados */}
              <div className="balance-actions-row" style={{ marginTop: '1.5rem' }}>
                <button className="balance-action-btn reload" onClick={() => setShowReloadModal(true)}>
                  Cargar Billetera
                </button>
                <button className="balance-action-btn transfer" onClick={() => setShowTransferModal(true)}>
                  Transferir Fondos
                </button>
              </div>
            </div>

            {/* Ticker de precios en vivo horizontal */}
            {precios && (
              <div className="p2p-prices-ticker glass-card" style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '2.5rem',
                padding: '0.8rem 1.5rem',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(25, 20, 38, 0.25)',
                borderRadius: '16px',
                flexWrap: 'wrap',
                boxSizing: 'border-box',
                width: '100%'
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

            {/* Nueva Tarjeta: Gráfica de Rendimiento de Mercado */}
            <div className="market-chart-card glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.75rem', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: 0 }}>Rendimiento del Mercado</h3>
                  <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '4px 0 0 0' }}>Historial de precios de los últimos 7 días</p>
                </div>
                {/* Tabs para BTC, ETH, SOL */}
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <button 
                    type="button"
                    onClick={() => setSelectedCrypto('bitcoin')}
                    style={{
                      background: selectedCrypto === 'bitcoin' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'transparent',
                      color: selectedCrypto === 'bitcoin' ? '#fff' : '#9ca3af',
                      border: 'none',
                      padding: '0.4rem 0.85rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 750,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    BTC
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSelectedCrypto('ethereum')}
                    style={{
                      background: selectedCrypto === 'ethereum' ? 'linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)' : 'transparent',
                      color: selectedCrypto === 'ethereum' ? '#fff' : '#9ca3af',
                      border: 'none',
                      padding: '0.4rem 0.85rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 750,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    ETH
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSelectedCrypto('solana')}
                    style={{
                      background: selectedCrypto === 'solana' ? 'linear-gradient(135deg, #14b8a6 0%, #a855f7 100%)' : 'transparent',
                      color: selectedCrypto === 'solana' ? '#fff' : '#9ca3af',
                      border: 'none',
                      padding: '0.4rem 0.85rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 750,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    SOL
                  </button>
                </div>
              </div>

              {/* Área del Gráfico con Recharts */}
              <div style={{ width: '100%', height: 260, position: 'relative' }}>
                {chartLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px' }}>
                    <div className="spinner" style={{ width: '30px', height: '30px' }}></div>
                    <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Cargando rendimiento...</span>
                  </div>
                ) : chartError ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ef4444', fontSize: '0.85rem' }}>
                    <span>{chartError}</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="selectedCryptoGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={gradientStart} />
                          <stop offset="100%" stopColor={gradientEnd} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.04)" />
                      <XAxis 
                        dataKey="simpleDate" 
                        stroke="#6b7280" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        dy={10}
                      />
                      <YAxis 
                        stroke="#6b7280" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        domain={['auto', 'auto']}
                        tickFormatter={formatYAxisTick}
                        dx={-5}
                      />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="price" 
                        stroke={chartStroke} 
                        strokeWidth={2.5} 
                        fillOpacity={1} 
                        fill="url(#selectedCryptoGradient)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
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
          <p>© 2026 Mi Billetera Virtual. Panel de control financiero seguro.</p>
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
              {combinedAlerts.length === 0 ? (
                <span style={{ color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>No tienes notificaciones recientes.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {combinedAlerts.slice(0, 15).map((alert) => {
                    if (alert.tipo === 'admin') {
                      return (
                        <div key={alert.id} style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          borderLeft: '3px solid #ef4444',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          color: '#f3f4f6',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          textAlign: 'left'
                        }}>
                          <span style={{ fontSize: '1.1rem', marginTop: '-2px' }}>⚠️</span>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, lineHeight: '1.4', fontWeight: 600 }}>{alert.mensaje}</p>
                            <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '4px', display: 'block' }}>
                              {alert.fecha.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div key={alert.id} style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          borderLeft: `3px solid ${alert.dotColor}`,
                          padding: '0.75rem',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          color: '#f3f4f6',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          textAlign: 'left'
                        }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: alert.dotColor, flexShrink: 0 }}></div>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, lineHeight: '1.4' }}>{alert.mensaje}</p>
                            <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '4px', display: 'block' }}>
                              {alert.fecha.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
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
