import { supabase } from './supabase';

export interface SupportTicket {
  id: string;
  usuario_id: string;
  titulo: string;
  descripcion: string;
  estado: string;
  creado_a: string;
  actualizado_a: string;
  user_email?: string;
  user_name?: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  remitente_id: string;
  es_admin: boolean;
  mensaje: string;
  creado_a: string;
}

/**
  Crea un nuevo ticket de soporte e inserta el primer mensaje.
 */
export async function createSupportTicket(usuarioId: string, titulo: string, descripcion: string): Promise<SupportTicket> {
  const { data, error } = await supabase
    .from('soporte_tickets')
    .insert({
      usuario_id: usuarioId,
      titulo,
      descripcion,
      estado: 'abierto'
    })
    .select()
    .single();

  if (error) throw error;

  // Insertar primer mensaje
  const { error: msgError } = await supabase
    .from('soporte_mensajes')
    .insert({
      ticket_id: data.id,
      remitente_id: usuarioId,
      es_admin: false,
      mensaje: descripcion
    });

  if (msgError) {
    console.error('Error al insertar el primer mensaje del ticket:', msgError);
  }

  return data;
}

/**
  Obtiene los tickets creados por un usuario.
 */
export async function getUserTickets(usuarioId: string): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from('soporte_tickets')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('actualizado_a', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
  Obtiene todos los tickets de soporte del sistema enriquecidos con datos del usuario.
 */
export async function getAllTickets(): Promise<SupportTicket[]> {
  const { data: tickets, error: ticketError } = await supabase
    .from('soporte_tickets')
    .select('*')
    .order('actualizado_a', { ascending: false });

  if (ticketError) throw ticketError;
  if (!tickets) return [];

  // Enriquecer con los datos de perfiles de los usuarios
  const enrichedTickets = await Promise.all(
    tickets.map(async (t) => {
      try {
        const { data: profileData } = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', t.usuario_id)
          .maybeSingle();

        if (profileData) {
          const name = (profileData as any).nombre_completo || (profileData as any).nombre || (profileData as any).full_name || profileData.email || `Usuario #${t.usuario_id.substring(0, 6)}`;
          return {
            ...t,
            user_name: name,
            user_email: profileData.email || 'Sin correo'
          };
        }
      } catch (err) {
        console.error('Error al obtener perfil en soporte:', err);
      }
      return {
        ...t,
        user_name: `Usuario #${t.usuario_id.substring(0, 6)}`,
        user_email: 'Usuario de la Plataforma'
      };
    })
  );

  return enrichedTickets;
}

/**
  Obtiene la lista de mensajes de una conversación de ticket.
 */
export async function getTicketMessages(ticketId: string): Promise<SupportMessage[]> {
  const { data, error } = await supabase
    .from('soporte_mensajes')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('creado_a', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
  Envía un nuevo mensaje dentro de un ticket de soporte.
 */
export async function sendSupportMessage(
  ticketId: string,
  remitenteId: string,
  esAdmin: boolean,
  mensaje: string
): Promise<SupportMessage> {
  const { data, error } = await supabase
    .from('soporte_mensajes')
    .insert({
      ticket_id: ticketId,
      remitente_id: remitenteId,
      es_admin: esAdmin,
      mensaje
    })
    .select()
    .single();

  if (error) throw error;

  // Actualizar la marca de tiempo de la conversación
  await supabase
    .from('soporte_tickets')
    .update({ actualizado_a: new Date().toISOString() })
    .eq('id', ticketId);

  return data;
}

/**
  Se suscribe a la llegada de nuevos mensajes de un ticket en tiempo real.
 */
export function subscribeToTicketMessages(ticketId: string, onNewMessage: (msg: SupportMessage) => void) {
  return supabase
    .channel(`ticket-${ticketId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'soporte_mensajes'
      },
      (payload) => {
        const newMsg = payload.new as SupportMessage;
        if (newMsg.ticket_id === ticketId) {
          onNewMessage(newMsg);
        }
      }
    )
    .subscribe();
}

/**
  Se suscribe a la actualización de cualquier ticket en tiempo real.
 */
export function subscribeToTickets(onUpdate: () => void) {
  return supabase
    .channel('tickets-global-channel')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'soporte_tickets'
      },
      () => {
        onUpdate();
      }
    )
    .subscribe();
}
