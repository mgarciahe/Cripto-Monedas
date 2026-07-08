import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createP2POffer, buyP2POffer, getActiveOffers } from '../services/wallet';
import type { OfertaP2P } from '../services/wallet';
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

  // Form states
  const [moneda, setMoneda] = useState<string>('BTC');
  const [monto, setMonto] = useState<string>('');
  const [precioUnidad, setPrecioUnidad] = useState<string>('');

  const user = session.user;

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

      // Consultar balances actuales del usuario para mostrarlos en el panel P2P
      const walletData = await getWalletBalances(user.id);
      setBilletera(walletData);
    } catch (err: unknown) {
      console.error('Error al cargar datos del Mercado P2P:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al sincronizar datos del mercado.');
    } finally {
      setLoading(false);
    }
  }, [user.id]);

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
        // Recargar mercado y balances
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
        // Recargar mercado y balances
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

  return (
    <div className="p2p-container">
      {/* Glow ambient design */}
      <div className="p2p-glow sphere-purple"></div>
      <div className="p2p-glow sphere-cyan"></div>

      <header className="p2p-header">
        <div className="header-left">
          <button className="btn-back-dashboard" onClick={() => onNavigate('welcome')}>
            ← Volver al Panel
          </button>
          <h1 className="p2p-title">Mercado P2P en Vivo</h1>
        </div>

        {/* Panel de balances del usuario */}
        {billetera && (
          <div className="p2p-balances-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
            <span className="p2p-balances-title" style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Saldos de mi billetera
            </span>
            <div className="p2p-user-balances glass-card">
              <span className="balance-pill usd">USD: ${(billetera.balance_usd).toFixed(2)}</span>
              <span className="balance-pill btc">BTC: {(billetera.balance_btc).toFixed(4)}</span>
              <span className="balance-pill eth">ETH: {(billetera.balance_eth).toFixed(4)}</span>
              <span className="balance-pill sol">SOL: {(billetera.balance_sol).toFixed(2)}</span>
            </div>
          </div>
        )}
      </header>

      {/* Ticker de precios en vivo horizontal */}
      {precios && (
        <div className="p2p-prices-ticker glass-card" style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '2.5rem',
          padding: '0.8rem 1.5rem',
          margin: '0 2rem 1.5rem 2rem',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '12px',
          flexWrap: 'wrap',
          boxSizing: 'border-box'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Precios en Vivo (API):
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

      <main className="p2p-content" style={{ position: 'relative' }}>
        {loading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p className="loading-msg">Actualizando ofertas y balances...</p>
          </div>
        )}

        {successMsg && <div className="p2p-alert success">{successMsg}</div>}
        {errorMsg && <div className="p2p-alert error">{errorMsg}</div>}

        <div className="p2p-grid">
          {/* Columna Izquierda: Formulario Publicar Anuncio */}
          <section className="p2p-form-section glass-card">
            <h2 className="p2p-section-title">Publicar Oferta de Venta</h2>
            <p className="p2p-subtitle">Vende tus criptomonedas y recibe saldo en dólares directamente en tu cuenta.</p>
            
            <form onSubmit={handleCreateOffer} className="p2p-form">
              <div className="form-group">
                <label htmlFor="monedaSelect">Criptomoneda a vender</label>
                <select
                  id="monedaSelect"
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value)}
                  disabled={submitting}
                  className="form-select"
                >
                  <option value="BTC">Bitcoin (BTC)</option>
                  <option value="ETH">Ethereum (ETH)</option>
                  <option value="SOL">Solana (SOL)</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="montoInput">Cantidad a vender</label>
                  <input
                    id="montoInput"
                    type="number"
                    step="any"
                    min="0.000001"
                    placeholder="ej. 0.05"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    disabled={submitting}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="precioUnidadInput">Precio Unitario (USD)</label>
                  <input
                    id="precioUnidadInput"
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="ej. 65000"
                    value={precioUnidad}
                    onChange={(e) => setPrecioUnidad(e.target.value)}
                    disabled={submitting}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              {monto && precioUnidad && !isNaN(parseFloat(monto)) && !isNaN(parseFloat(precioUnidad)) && (
                <div className="p2p-estimated-total">
                  <span>Recibirás:</span>
                  <strong>${(parseFloat(monto) * parseFloat(precioUnidad)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong>
                </div>
              )}

              <button type="submit" disabled={submitting} className="btn-p2p-submit">
                {submitting ? 'Publicando...' : 'Publicar Anuncio de Venta'}
              </button>
            </form>
          </section>

          {/* Columna Derecha: Tablón de Ofertas (Orderbook) */}
          <section className="p2p-market-section glass-card">
            <h2 className="p2p-section-title">Anuncios en Vivo</h2>
            <p className="p2p-subtitle">Compra criptomonedas al instante utilizando tu balance de dólares (USD).</p>

            <div className="orderbook-container">
              {ofertas.length === 0 ? (
                <div className="orderbook-empty">
                  <p>No hay ofertas de venta activas en este momento.</p>
                  <span>¡Sé el primero en publicar una oferta!</span>
                </div>
              ) : (
                <table className="orderbook-table">
                  <thead>
                    <tr>
                      <th>Moneda</th>
                      <th>Cantidad</th>
                      <th>Precio Unitario</th>
                      <th>Total (USD)</th>
                      <th>Vendedor</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ofertas.map((offer) => {
                      const isOwner = offer.vendedor_id === user.id;
                      const totalUSD = offer.monto * offer.precio_unid;
                      return (
                        <tr key={offer.id} className={isOwner ? 'own-offer-row' : ''}>
                          <td>
                            <span className={`token-badge ${offer.moneda_cripto.toLowerCase()}`}>
                              {offer.moneda_cripto}
                            </span>
                          </td>
                          <td className="font-numeric">{offer.monto}</td>
                          <td className="font-numeric">${offer.precio_unid.toFixed(2)}</td>
                          <td className="font-numeric font-highlight">${totalUSD.toFixed(2)}</td>
                          <td className="vendedor-id" title={offer.vendedor_id}>
                            {isOwner ? 'Tú' : formatUserId(offer.vendedor_id)}
                          </td>
                          <td>
                            <button
                              onClick={() => setSelectedOfferForBuy(offer)}
                              disabled={isOwner || submitting}
                              className={`btn-p2p-buy ${isOwner ? 'own-offer' : ''}`}
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
        </div>
      </main>

      {/* Modal de Confirmación de Compra P2P */}
      {selectedOfferForBuy && (
        <div className="p2p-modal-overlay">
          <div className="p2p-modal-card">
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

              <div className="p2p-details-list">
                <div className="p2p-detail-item">
                  <span className="p2p-detail-label">Criptomoneda:</span>
                  <span className={`token-badge ${selectedOfferForBuy.moneda_cripto.toLowerCase()}`}>
                    {selectedOfferForBuy.moneda_cripto}
                  </span>
                </div>
                <div className="p2p-detail-item">
                  <span className="p2p-detail-label">Cantidad a comprar:</span>
                  <span className="p2p-detail-val">{selectedOfferForBuy.monto} {selectedOfferForBuy.moneda_cripto}</span>
                </div>
                <div className="p2p-detail-item">
                  <span className="p2p-detail-label">Precio Unitario:</span>
                  <span className="p2p-detail-val">${selectedOfferForBuy.precio_unid.toFixed(2)} USD</span>
                </div>
                <div className="p2p-detail-item" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.8rem', marginTop: '0.4rem' }}>
                  <span className="p2p-detail-label" style={{ color: '#fff', fontWeight: 700 }}>Total a Pagar:</span>
                  <span className="p2p-detail-val total">
                    ${(selectedOfferForBuy.monto * selectedOfferForBuy.precio_unid).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </span>
                </div>
              </div>
            </div>

            <div className="p2p-modal-footer">
              <button className="btn-modal-cancel" onClick={() => setSelectedOfferForBuy(null)} disabled={submitting}>
                Cancelar
              </button>
              <button className="btn-modal-confirm" onClick={handleConfirmBuy} disabled={submitting}>
                {submitting ? 'Procesando...' : 'Confirmar Compra'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
