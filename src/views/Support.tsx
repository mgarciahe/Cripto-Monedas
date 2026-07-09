import { useState, useEffect, useRef, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { logout } from '../services/auth';
import {
  createSupportTicket,
  getUserTickets,
  getTicketMessages,
  sendSupportMessage,
  subscribeToTicketMessages,
  subscribeToTickets,
  type SupportTicket,
  type SupportMessage
} from '../services/support';
import './Dashboard.css';

interface SupportProps {
  session: Session;
  onNavigate: (view: string) => void;
  userRole: string | null;
}

export default function Support({ session, onNavigate, userRole }: SupportProps) {
  const user = session.user;
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  
  // Estados de formulario para crear ticket
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  
  // Estado para enviar mensaje en chat
  const [chatMessage, setChatMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cargar tickets del usuario
  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getUserTickets(user.id);
      setTickets(data);
      
      // Si hay un ticket seleccionado, actualizar sus datos por si cambió de estado
      if (selectedTicket) {
        const updated = data.find(t => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    } catch (err) {
      console.error('Error al cargar tickets:', err);
    } finally {
      setLoading(false);
    }
  }, [user.id, selectedTicket]);

  // Cargar mensajes de un ticket
  const fetchMessages = useCallback(async (ticketId: string) => {
    try {
      const data = await getTicketMessages(ticketId);
      setMessages(data);
      scrollToBottom();
    } catch (err) {
      console.error('Error al cargar mensajes:', err);
    }
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Cargar tickets inicialmente
  useEffect(() => {
    fetchTickets();
  }, []);

  // Suscribirse a actualizaciones de los tickets del usuario
  useEffect(() => {
    const sub = subscribeToTickets(() => {
      fetchTickets();
    });
    return () => {
      sub.unsubscribe();
    };
  }, [fetchTickets]);

  // Suscribirse a los mensajes del ticket seleccionado en tiempo real
  useEffect(() => {
    if (!selectedTicket) {
      setMessages([]);
      return;
    }

    // Cargar mensajes existentes
    fetchMessages(selectedTicket.id);

    // Escuchar nuevos mensajes en tiempo real
    const sub = subscribeToTicketMessages(selectedTicket.id, (newMsg) => {
      setMessages((prev) => {
        // Evitar duplicados si el mensaje ya fue insertado localmente
        if (prev.some(m => m.id === newMsg.id)) return prev;
        const updated = [...prev, newMsg];
        scrollToBottom();
        return updated;
      });
    });

    return () => {
      sub.unsubscribe();
    };
  }, [selectedTicket, fetchMessages]);

  // Enviar inicializador del ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;

    try {
      setSending(true);
      const newTicket = await createSupportTicket(user.id, newTitle.trim(), newDesc.trim());
      setNewTitle('');
      setNewDesc('');
      setIsCreating(false);
      await fetchTickets();
      setSelectedTicket(newTicket);
    } catch (err) {
      alert('Error al crear ticket de soporte.');
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  // Enviar mensaje en el chat
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !selectedTicket) return;

    const messageText = chatMessage.trim();
    setChatMessage('');

    try {
      // Enviar a la base de datos
      await sendSupportMessage(selectedTicket.id, user.id, false, messageText);
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      alert('No se pudo enviar el mensaje.');
    }
  };

  const handleLogoutClick = async () => {
    const confirmation = window.confirm("¿Estás seguro de que deseas cerrar la sesión?");
    if (confirmation) {
      try {
        await logout();
      } catch (err) {
        console.error('Error al cerrar sesión:', err);
      }
    }
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
          <button className="menu-item" onClick={() => onNavigate('profile')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Mi Perfil
          </button>
          <button className="menu-item active" onClick={() => onNavigate('support')}>
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
      <div className="main-content-wrapper" style={{ display: 'flex', flexDirection: 'column' }}>
        <header className="dashboard-header-premium">
          <h2 className="header-title">Soporte Técnico</h2>
          <div className="header-right">
            <button className="btn-logout-premium" onClick={handleLogoutClick}>
              Cerrar Sesión
            </button>
          </div>
        </header>

        {/* CONTENEDOR GRID SOPORTE */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: '1.5rem',
          marginTop: '1rem',
          flex: 1,
          minHeight: 'calc(100vh - 140px)',
          boxSizing: 'border-box'
        }}>
          {/* COLUMNA IZQUIERDA: LISTA DE TICKETS */}
          <div className="glass-card" style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '1.25rem',
            borderRadius: '20px',
            gap: '1rem',
            maxHeight: 'calc(100vh - 140px)',
            overflowY: 'auto'
          }}>
            <button
              onClick={() => {
                setIsCreating(true);
                setSelectedTicket(null);
              }}
              style={{
                background: 'linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)',
                border: 'none',
                borderRadius: '12px',
                color: '#fff',
                padding: '0.75rem 1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '0.9rem',
                boxShadow: '0 4px 15px rgba(168, 85, 247, 0.25)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
            >
              + Nuevo Mensaje / Ticket
            </button>

            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem', fontSize: '0.85rem', color: '#9ca3af', fontWeight: 'bold', textAlign: 'left' }}>
              Tus Mensajes de Soporte
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflowY: 'auto' }}>
              {loading && tickets.length === 0 ? (
                <span style={{ fontSize: '0.85rem', color: '#6b7280', textAlign: 'center', marginTop: '2rem' }}>Cargando conversaciones...</span>
              ) : tickets.length === 0 ? (
                <span style={{ fontSize: '0.85rem', color: '#6b7280', textAlign: 'center', padding: '1rem', fontStyle: 'italic' }}>No tienes tickets creados.</span>
              ) : (
                tickets.map((t) => {
                  const isActive = selectedTicket?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedTicket(t);
                        setIsCreating(false);
                      }}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        border: isActive ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(255,255,255,0.05)',
                        background: isActive ? 'rgba(168, 85, 247, 0.08)' : 'rgba(255,255,255,0.01)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          background: t.estado === 'abierto' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(107, 114, 128, 0.15)',
                          color: t.estado === 'abierto' ? '#10b981' : '#9ca3af',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}>{t.estado}</span>
                        <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                          {new Date(t.creado_a).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.titulo}
                      </h4>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA: PANTALLA DETALLADA / CHAT */}
          <div className="glass-card" style={{
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100vh - 140px)',
            overflow: 'hidden'
          }}>
            {isCreating ? (
              /* FORMULARIO DE NUEVO TICKET */
              <form onSubmit={handleCreateTicket} style={{
                padding: '2.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                textAlign: 'left',
                height: '100%',
                boxSizing: 'border-box',
                overflowY: 'auto'
              }}>
                <h3 style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 800, margin: 0 }}>Iniciar Conversación con Soporte</h3>
                <p style={{ color: '#9ca3af', fontSize: '0.9rem', margin: 0 }}>Describe tu duda o problema técnico. Un administrador del sistema te responderá a la brevedad.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#d1d5db', fontWeight: 'bold' }}>Asunto o Título:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Problema con depósito en USD, Error al comprar SOL..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    style={{
                      background: 'rgba(25, 20, 38, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '0.85rem 1rem',
                      color: '#fff',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', color: '#d1d5db', fontWeight: 'bold' }}>Mensaje o Descripción Detallada:</label>
                  <textarea
                    required
                    placeholder="Describe detalladamente qué sucedió o cuál es tu consulta..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    style={{
                      background: 'rgba(25, 20, 38, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '1rem',
                      color: '#fff',
                      fontSize: '0.9rem',
                      resize: 'none',
                      height: '100%',
                      minHeight: '150px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#d1d5db',
                      borderRadius: '10px',
                      padding: '0.75rem 1.5rem',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    style={{
                      background: 'linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: '10px',
                      padding: '0.75rem 2rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      boxShadow: '0 4px 15px rgba(168, 85, 247, 0.25)'
                    }}
                  >
                    {sending ? 'Iniciando...' : 'Enviar Mensaje'}
                  </button>
                </div>
              </form>
            ) : selectedTicket ? (
              /* CHAT ROOM */
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Cabecera del chat */}
                <div style={{
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  background: 'rgba(255,255,255,0.01)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', fontWeight: 700 }}>{selectedTicket.titulo}</h3>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>ID Conversación: {selectedTicket.id}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      background: selectedTicket.estado === 'abierto' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(107, 114, 128, 0.15)',
                      color: selectedTicket.estado === 'abierto' ? '#10b981' : '#9ca3af',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}>
                      {selectedTicket.estado === 'abierto' ? 'Soporte Abierto' : 'Cerrado'}
                    </span>
                  </div>
                </div>

                {/* Historial de mensajes */}
                <div style={{
                  flex: 1,
                  padding: '1.5rem',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  background: 'rgba(10, 5, 20, 0.2)'
                }}>
                  {messages.map((msg) => {
                    const isMyMessage = !msg.es_admin;
                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
                          width: '100%'
                        }}
                      >
                        <div style={{
                          maxWidth: '70%',
                          textAlign: 'left'
                        }}>
                          {/* Emisor y fecha */}
                          <div style={{
                            fontSize: '0.7rem',
                            color: '#9ca3af',
                            marginBottom: '4px',
                            display: 'flex',
                            gap: '8px',
                            justifyContent: isMyMessage ? 'flex-end' : 'flex-start'
                          }}>
                            <span style={{ fontWeight: 'bold', color: isMyMessage ? '#a855f7' : '#06b6d4' }}>
                              {isMyMessage ? 'Tú' : 'Soporte Técnico'}
                            </span>
                            <span>
                              {new Date(msg.creado_a).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          {/* Globo del mensaje */}
                          <div style={{
                            background: isMyMessage
                              ? 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)'
                              : 'rgba(255, 255, 255, 0.05)',
                            border: isMyMessage
                              ? 'none'
                              : '1px solid rgba(255, 255, 255, 0.08)',
                            padding: '0.85rem 1.15rem',
                            borderRadius: isMyMessage ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                            color: '#fff',
                            fontSize: '0.9rem',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            boxShadow: isMyMessage ? '0 4px 10px rgba(168, 85, 247, 0.15)' : 'none'
                          }}>
                            {msg.mensaje}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input de envío */}
                {selectedTicket.estado === 'abierto' ? (
                  <form onSubmit={handleSendMessage} style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(25, 20, 38, 0.3)',
                    display: 'flex',
                    gap: '0.75rem'
                  }}>
                    <input
                      type="text"
                      placeholder="Escribe tu mensaje aquí..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'rgba(15, 10, 25, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        padding: '0.75rem 1rem',
                        color: '#fff',
                        fontSize: '0.9rem',
                        outline: 'none'
                      }}
                    />
                    <button
                      type="submit"
                      style={{
                        background: 'linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '12px',
                        padding: '0 1.5rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(168, 85, 247, 0.2)'
                      }}
                    >
                      Enviar
                    </button>
                  </form>
                ) : (
                  <div style={{
                    padding: '1.25rem',
                    textAlign: 'center',
                    color: '#6b7280',
                    fontSize: '0.85rem',
                    background: 'rgba(25,20,38,0.2)',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    fontStyle: 'italic'
                  }}>
                    Esta conversación ha sido cerrada por el administrador. No se pueden enviar más respuestas.
                  </div>
                )}
              </div>
            ) : (
              /* PANTALLA VACIA (BIENVENIDA SOPORTE) */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#9ca3af',
                padding: '2rem',
                textAlign: 'center',
                gap: '1rem'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(168, 85, 247, 0.1)',
                  color: '#a855f7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.75rem',
                  marginBottom: '0.5rem'
                }}>
                  💬
                </div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', fontWeight: 700 }}>Canal de Soporte Directo</h3>
                <p style={{ margin: 0, maxWidth: '400px', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  Selecciona una conversación del listado de la izquierda para abrir el chat en vivo, o haz clic en **Nuevo Mensaje** para iniciar una consulta.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
