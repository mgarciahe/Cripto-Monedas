import { supabase } from './supabase';

/**
 * Realiza una transferencia de fondos entre dos usuarios llamando a la función RPC 'transferir_fondos' en Supabase.
 * 
 * @param remitenteId ID del usuario que envía los fondos.
 * @param destinatarioId ID del usuario que recibe los fondos.
 * @param moneda Nombre de la columna de moneda en la tabla (ej. 'balance_usd', 'balance_btc', 'balance_eth', 'balance_sol').
 * @param monto Cantidad de fondos a transferir.
 * @returns Un objeto indicando el éxito de la operación y el mensaje resultante.
 */
export async function transferFunds(
  remitenteId: string,
  destinatarioId: string,
  moneda: string,
  monto: number
): Promise<{ success: boolean; message: string }> {
  try {
    // Llamar a la función RPC 'transferir_fondos' pasándole los parámetros esperados por Supabase
    const { error } = await supabase.rpc('transferir_fondos', {
      remitente_id: remitenteId,
      destinatario_id: destinatarioId,
      columna_moneda: moneda,
      monto: monto
    });

    // Si Supabase devuelve un objeto de error (ej: Saldo insuficiente o destinatario inexistente)
    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      message: 'Transferencia realizada con éxito.'
    };
  } catch (err: any) {
    console.error('Error al transferir fondos:', err);
    
    // Capturar el mensaje devuelto por Supabase o por la excepción local de forma segura
    const msg = err.message || 'Ocurrió un error inesperado al procesar la transferencia.';
    
    return {
      success: false,
      message: msg
    };
  }
}
